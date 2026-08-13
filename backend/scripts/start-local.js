const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { validarConfiguracionBasePruebas } = require('./test-database-safety');

const backendRoot = path.resolve(__dirname, '..');
const localEnvironmentPath = path.join(backendRoot, '.env.test');

dotenv.config({
  path: localEnvironmentPath,
  override: true,
  quiet: true,
});

const resumen = validarConfiguracionBasePruebas(process.env);
process.env.LOCAL_ENV_FILE_LOADED = 'true';
process.env.NODE_ENV = process.env.NODE_ENV === 'test' ? 'test' : 'development';
process.env.PORT = '3000';
process.env.FRONTEND_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
process.env.SOCKET_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
delete process.env.MP_ACCESS_TOKEN;
delete process.env.MP_DEVICE_ID;

console.info(
  `[LOCAL] Entorno validado: ${resumen.entorno}; MySQL ${resumen.host}:${resumen.puerto}/${resumen.nombreBaseDatos}`,
);
console.info('[LOCAL] Mercado Pago externo deshabilitado; frontend permitido: localhost:4200');

const proceso = spawn(
  process.execPath,
  ['-r', 'ts-node/register', 'src/server.ts'],
  {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => proceso.kill(signal));
}

proceso.on('exit', code => {
  process.exitCode = code ?? 1;
});
