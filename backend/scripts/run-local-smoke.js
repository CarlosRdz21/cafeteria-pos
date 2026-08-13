const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { validarConfiguracionBasePruebas } = require('./test-database-safety');
const { ejecutarSmoke } = require('./smoke-api');

const backendRoot = path.resolve(__dirname, '..');
dotenv.config({
  path: path.join(backendRoot, '.env.test'),
  override: true,
  quiet: true,
});

validarConfiguracionBasePruebas(process.env, { requerirDestructiva: true });

function ejecutarProceso(argumentos) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(process.execPath, argumentos, {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
    });
    proceso.once('error', reject);
    proceso.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`El proceso local terminó con código ${code}`));
    });
  });
}

async function esperarHealth(baseUrl, intentos = 40) {
  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // El servidor puede tardar unos segundos en compilar e iniciar.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('El backend local no respondió al health check.');
}

async function validarLogin(baseUrl, username, password, estadoEsperado = 200) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.status !== estadoEsperado) {
    throw new Error(`Login local inesperado para ${username}: HTTP ${response.status}`);
  }
}

async function ejecutar() {
  const password = String(process.env.LOCAL_SEED_PASSWORD || '');
  if (password.length < 12) {
    throw new Error('LOCAL_SEED_PASSWORD es obligatoria para el smoke local.');
  }

  await ejecutarProceso(['scripts/seed-local.js']);

  const servidor = spawn(process.execPath, ['scripts/start-local.js'], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  });
  const baseUrl = 'http://localhost:3000';

  try {
    await esperarHealth(baseUrl);
    await validarLogin(baseUrl, 'admin_local', password);
    await validarLogin(baseUrl, 'barista_local', password);
    await validarLogin(baseUrl, 'mesero_local', password);
    await validarLogin(baseUrl, 'inactivo_local', password, 401);

    await ejecutarSmoke({
      ...process.env,
      TEST_BASE_URL: baseUrl,
      TEST_ADMIN_USERNAME: 'admin_local',
      TEST_ADMIN_PASSWORD: password,
    });
    console.info('[LOCAL] Health, roles, usuario inactivo y pedido temporal validados.');
  } finally {
    servidor.kill('SIGINT');
    await new Promise(resolve => {
      servidor.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
  }
}

ejecutar().catch(error => {
  console.error(error instanceof Error ? error.message : 'Falló el smoke local.');
  process.exitCode = 1;
});
