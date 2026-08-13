const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const {
  validarConfiguracionBasePruebas,
} = require('./test-database-safety.js');

function ejecutarPruebasMysql() {
  const resultadoEntorno = dotenv.config({
    path: path.resolve(process.cwd(), '.env.test'),
    override: true,
    quiet: true,
  });
  if (resultadoEntorno.error) {
    throw new Error('No se pudo cargar backend/.env.test');
  }

  const resumen = validarConfiguracionBasePruebas(process.env, {
    requerirDestructiva: true,
  });
  console.info(
    `MYSQL_LOCAL_CONFIRMADO entorno=${resumen.entorno} host=${resumen.host} puerto=${resumen.puerto} base=${resumen.nombreBaseDatos}`,
  );

  const vitestCli = path.join(
    path.dirname(require.resolve('vitest/package.json')),
    'vitest.mjs',
  );
  const resultado = spawnSync(
    process.execPath,
    [
      vitestCli,
      'run',
      'tests/integration',
      '--no-file-parallelism',
      '--maxWorkers=1',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RUN_MYSQL_INTEGRATION: 'true',
      },
      stdio: 'inherit',
    },
  );
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`Las pruebas MySQL terminaron con codigo ${resultado.status}`);
  }
}

if (require.main === module) {
  try {
    ejecutarPruebasMysql();
  } catch (error) {
    console.error('PRUEBAS_MYSQL_FALLIDAS');
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    process.exitCode = 1;
  }
}

module.exports = { ejecutarPruebasMysql };
