const path = require('node:path');
const dotenv = require('dotenv');
const {
  validarConfiguracionBasePruebas,
} = require('./test-database-safety.js');

function cargarEntornoPruebas() {
  const rutaEntorno = path.resolve(process.cwd(), '.env.test');
  const resultado = dotenv.config({
    path: rutaEntorno,
    override: true,
    quiet: true,
  });
  if (resultado.error) {
    throw new Error('No se pudo cargar backend/.env.test');
  }
}

function ejecutarValidacion() {
  cargarEntornoPruebas();
  const resumen = validarConfiguracionBasePruebas(process.env, {
    requerirDestructiva: false,
  });

  console.info('CONFIGURACION_MYSQL_PRUEBAS_VALIDA');
  console.info(
    `entorno=${resumen.entorno} host=${resumen.host} puerto=${resumen.puerto} base=${resumen.nombreBaseDatos}`,
  );
}

if (require.main === module) {
  try {
    ejecutarValidacion();
  } catch (error) {
    console.error('CONFIGURACION_MYSQL_PRUEBAS_INVALIDA');
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    process.exitCode = 1;
  }
}

module.exports = { cargarEntornoPruebas, ejecutarValidacion };
