const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
const sharedLocalEnvironmentPath = path.join(backendRoot, '.env.test');
const cloneEnvironmentPath = path.join(backendRoot, '.env.prod-clone.local');

dotenv.config({
  path: sharedLocalEnvironmentPath,
  override: true,
  quiet: true,
});

const cloneConfig = dotenv.config({
  path: cloneEnvironmentPath,
  quiet: true,
}).parsed;

if (!cloneConfig) {
  throw new Error('No se pudo leer .env.prod-clone.local');
}

const host = String(cloneConfig.MYSQL_HOST || '').trim().toLowerCase();
const port = String(cloneConfig.MYSQL_PORT || '').trim();
const database = String(cloneConfig.MYSQL_DATABASE || '').trim();
const user = String(cloneConfig.MYSQL_USER || '').trim();
const password = String(cloneConfig.MYSQL_PASSWORD || '');

if (!['localhost', '127.0.0.1'].includes(host)) {
  throw new Error('El clon debe usar exclusivamente MySQL local');
}
if (port !== '3306' || database !== 'cafeteria_pos_prod_clone') {
  throw new Error('El destino no coincide con el clon histórico autorizado');
}
if (!user || user.toLowerCase() === 'root' || !password) {
  throw new Error('Se requiere el usuario local dedicado del clon');
}

process.env.DATABASE_URL = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
process.env.LOCAL_ENV_FILE_LOADED = 'true';
process.env.CLONE_READ_ONLY = 'true';
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.CLONE_READ_ONLY_PORT || '3000';
process.env.FRONTEND_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
process.env.SOCKET_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
delete process.env.TEST_DATABASE_URL;
delete process.env.PRODUCTION_DATABASE_URL;
delete process.env.MP_ACCESS_TOKEN;
delete process.env.MP_DEVICE_ID;

console.info(`[CLONE READ-ONLY] MySQL ${host}:${port}/${database}`);
console.info('[CLONE READ-ONLY] Escrituras de API bloqueadas; Mercado Pago deshabilitado');

const processChild = spawn(
  process.execPath,
  ['-r', 'ts-node/register', 'src/server.ts'],
  {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => processChild.kill(signal));
}

processChild.on('exit', code => {
  process.exitCode = code ?? 1;
});
