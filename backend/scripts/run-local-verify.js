const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { validarConfiguracionBasePruebas } = require('./test-database-safety');

const backendRoot = path.resolve(__dirname, '..');
const resultadoEntorno = dotenv.config({
  path: path.join(backendRoot, '.env.test'),
  override: true,
  quiet: true,
});

if (resultadoEntorno.error) {
  throw new Error('No se pudo cargar backend/.env.test');
}

validarConfiguracionBasePruebas(process.env);

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('No se pudo localizar npm para ejecutar la verificacion local');
}

const resultado = spawnSync(process.execPath, [npmCli, 'run', 'verify'], {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
});

if (resultado.error) throw resultado.error;
process.exitCode = resultado.status ?? 1;
