const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const {
  validarConfiguracionBasePruebas,
} = require('./test-database-safety.js');

function cargarEntornoPruebas() {
  const resultado = dotenv.config({
    path: path.resolve(process.cwd(), '.env.test'),
    override: true,
    quiet: true,
  });
  if (resultado.error) {
    throw new Error('No se pudo cargar backend/.env.test');
  }
}

function argumentosPrisma(argumentos) {
  if (argumentos.length === 0) {
    return [
      'migrate',
      'deploy',
      '--schema',
      'prisma/schema.mysql.prisma',
    ];
  }

  if (argumentos.length === 1 && argumentos[0] === 'status') {
    return [
      'migrate',
      'status',
      '--schema',
      'prisma/schema.mysql.prisma',
    ];
  }

  if (
    argumentos[0] === 'resolve-rolled-back'
    && /^[0-9]{14}_[a-z0-9_]+$/.test(String(argumentos[1] || ''))
    && argumentos.length === 2
  ) {
    return [
      'migrate',
      'resolve',
      '--rolled-back',
      argumentos[1],
      '--schema',
      'prisma/schema.mysql.prisma',
    ];
  }

  throw new Error('Accion de migracion de pruebas no permitida');
}

function ejecutarMigracionesPruebas(argumentos = process.argv.slice(2)) {
  cargarEntornoPruebas();
  const resumen = validarConfiguracionBasePruebas(process.env, {
    requerirDestructiva: true,
  });
  console.info(
    `MYSQL_LOCAL_CONFIRMADO entorno=${resumen.entorno} host=${resumen.host} puerto=${resumen.puerto} base=${resumen.nombreBaseDatos}`,
  );

  const prismaCli = require.resolve('prisma/build/index.js');
  const resultado = spawnSync(
    process.execPath,
    [prismaCli, ...argumentosPrisma(argumentos)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`Prisma migrate deploy termino con codigo ${resultado.status}`);
  }
}

if (require.main === module) {
  try {
    ejecutarMigracionesPruebas();
  } catch (error) {
    console.error('MIGRACION_MYSQL_PRUEBAS_FALLIDA');
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    process.exitCode = 1;
  }
}

module.exports = {
  argumentosPrisma,
  cargarEntornoPruebas,
  ejecutarMigracionesPruebas,
};
