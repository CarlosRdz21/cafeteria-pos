const HOSTS_MYSQL_LOCALES = new Set(['localhost', '127.0.0.1']);
const BASE_MYSQL_LOCAL = 'cafeteria_pos_test';
const BASE_CLON_TRANSACCIONAL = 'cafeteria_pos_prod_clone_transaction_test';
const MARCADOR_SERVICIO_REMOTO = /(render|hostinger)/i;

function analizarUrlBaseDatos(valor) {
  const urlSinProcesar = String(valor || '').trim();
  if (!urlSinProcesar) {
    throw new Error('La URL de la base de pruebas esta ausente');
  }

  let url;
  try {
    url = new URL(urlSinProcesar);
  } catch {
    throw new Error('La URL de la base de pruebas no se puede analizar');
  }

  const nombreBaseDatos = url.pathname.replace(/^\/+/, '').trim();
  const puerto = Number(url.port);
  if (
    url.protocol !== 'mysql:'
    || !url.hostname
    || !url.username
    || !url.port
    || !Number.isInteger(puerto)
    || puerto <= 0
    || puerto > 65535
    || !nombreBaseDatos
  ) {
    throw new Error('La URL de pruebas debe incluir protocolo MySQL, host, puerto, usuario y base');
  }

  return {
    host: url.hostname,
    puerto,
    usuario: decodeURIComponent(url.username),
    nombreBaseDatos: decodeURIComponent(nombreBaseDatos),
    urlOculta: `${url.protocol}//***:***@${url.hostname}:${url.port}/${nombreBaseDatos}`,
  };
}

function ocultarCredencialesBaseDatos(valor) {
  return analizarUrlBaseDatos(valor).urlOculta;
}

function validarConfiguracionBasePruebas(env = process.env, opciones = {}) {
  if (String(env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    throw new Error('Las operaciones de pruebas MySQL estan bloqueadas con NODE_ENV=production');
  }

  const testDatabaseUrl = String(env.TEST_DATABASE_URL || '').trim();
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!testDatabaseUrl || !databaseUrl) {
    throw new Error('Se requieren TEST_DATABASE_URL y DATABASE_URL');
  }
  if (databaseUrl !== testDatabaseUrl) {
    throw new Error('DATABASE_URL debe apuntar exactamente a TEST_DATABASE_URL durante las pruebas');
  }

  const productionDatabaseUrl = String(env.PRODUCTION_DATABASE_URL || '').trim();
  if (productionDatabaseUrl && testDatabaseUrl === productionDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL no puede coincidir con PRODUCTION_DATABASE_URL');
  }

  const resumen = analizarUrlBaseDatos(testDatabaseUrl);
  if (!HOSTS_MYSQL_LOCALES.has(resumen.host.toLowerCase())) {
    throw new Error('La base de pruebas debe usar exclusivamente localhost o 127.0.0.1');
  }
  const usarClonTransaccional = env.ALLOW_PROD_CLONE_TRANSACTION_TEST === 'true';
  const basePermitida = usarClonTransaccional
    ? BASE_CLON_TRANSACCIONAL
    : BASE_MYSQL_LOCAL;
  if (resumen.nombreBaseDatos !== basePermitida) {
    throw new Error(`La base local permitida es exclusivamente ${basePermitida}`);
  }
  if (
    MARCADOR_SERVICIO_REMOTO.test(testDatabaseUrl)
    || MARCADOR_SERVICIO_REMOTO.test(databaseUrl)
  ) {
    throw new Error('La URL local no puede contener referencias a servicios remotos');
  }

  if (opciones.requerirDestructiva === true && env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    throw new Error('Se requiere ALLOW_DESTRUCTIVE_TESTS=true para esta operacion');
  }

  return {
    host: resumen.host,
    puerto: resumen.puerto,
    nombreBaseDatos: resumen.nombreBaseDatos,
    entorno: String(env.NODE_ENV || 'development').trim().toLowerCase(),
    urlOculta: resumen.urlOculta,
  };
}

module.exports = {
  analizarUrlBaseDatos,
  ocultarCredencialesBaseDatos,
  validarConfiguracionBasePruebas,
};
