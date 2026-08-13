const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const {
  validarConfiguracionBasePruebas,
} = require('./test-database-safety.js');

function analizarPermisos(lineasPermisos, nombreBaseDatos) {
  const baseEscapada = nombreBaseDatos.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alcanceBase = new RegExp(`ON\\s+\`?${baseEscapada}\`?\\.\\*`, 'i');
  const privilegiosProhibidos = /\b(GRANT OPTION|SUPER|PROCESS|FILE)\b/i;
  const alcanceGlobal = /ON\s+\*\.\*/i;

  const permisosFueraDeBase = lineasPermisos.filter(linea => {
    if (!alcanceGlobal.test(linea)) return !alcanceBase.test(linea);
    return !/^GRANT\s+USAGE\s+ON\s+\*\.\*/i.test(linea);
  });
  const permisosProhibidos = lineasPermisos.filter(linea =>
    privilegiosProhibidos.test(linea),
  );

  return {
    exclusivoBasePruebas:
      permisosFueraDeBase.length === 0 && permisosProhibidos.length === 0,
    cantidadPermisos: lineasPermisos.length,
    cantidadAlcancesExternos: permisosFueraDeBase.length,
    cantidadPrivilegiosProhibidos: permisosProhibidos.length,
  };
}

async function inspeccionarBasePruebas(env = process.env) {
  const resumenUrl = validarConfiguracionBasePruebas(env, {
    requerirDestructiva: false,
  });
  const prisma = new PrismaClient({
    datasources: { db: { url: String(env.TEST_DATABASE_URL) } },
  });

  try {
    const conexion = await prisma.$queryRawUnsafe(
      'SELECT DATABASE() AS nombreBaseDatos',
    );
    const nombreBaseActiva = String(conexion?.[0]?.nombreBaseDatos || '');
    if (nombreBaseActiva !== resumenUrl.nombreBaseDatos) {
      throw new Error('La base activa no coincide con TEST_DATABASE_URL');
    }

    const filasPermisos = await prisma.$queryRawUnsafe('SHOW GRANTS');
    const lineasPermisos = filasPermisos.flatMap(fila =>
      Object.values(fila).map(valor => String(valor)),
    );
    const permisos = analizarPermisos(
      lineasPermisos,
      resumenUrl.nombreBaseDatos,
    );

    const tablas = await prisma.$queryRawUnsafe(
      'SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME',
    );
    const conteos = {};
    for (const tabla of tablas) {
      const nombre = String(tabla.nombre || '');
      if (!/^[A-Za-z0-9_$]+$/.test(nombre)) {
        throw new Error('Se encontro un nombre de tabla no seguro para inspeccion');
      }
      const resultado = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS total FROM \`${nombre}\``,
      );
      conteos[nombre] = Number(resultado?.[0]?.total || 0);
    }

    const filasIdentificadores = await prisma.$queryRawUnsafe(
      "SELECT TABLE_NAME AS tabla, COLUMN_TYPE AS tipo, COLUMN_KEY AS clave, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'id' ORDER BY TABLE_NAME",
    );
    const filasClavesForaneas = await prisma.$queryRawUnsafe(
      "SELECT TABLE_NAME AS tabla, CONSTRAINT_NAME AS nombre, REFERENCED_TABLE_NAME AS tablaReferenciada, UPDATE_RULE AS reglaActualizacion, DELETE_RULE AS reglaEliminacion FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() ORDER BY TABLE_NAME, CONSTRAINT_NAME",
    );
    const filasIndices = await prisma.$queryRawUnsafe(
      "SELECT TABLE_NAME AS tabla, INDEX_NAME AS nombre, NON_UNIQUE AS noUnico, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columnas FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY TABLE_NAME, INDEX_NAME",
    );
    const identificadores = filasIdentificadores.map(fila => ({
      tabla: String(fila.tabla),
      tipo: String(fila.tipo),
      clave: String(fila.clave),
      extra: String(fila.extra),
    }));
    const clavesForaneas = filasClavesForaneas.map(fila => ({
      tabla: String(fila.tabla),
      nombre: String(fila.nombre),
      tablaReferenciada: String(fila.tablaReferenciada),
      reglaActualizacion: String(fila.reglaActualizacion),
      reglaEliminacion: String(fila.reglaEliminacion),
    }));
    const indices = filasIndices.map(fila => ({
      tabla: String(fila.tabla),
      nombre: String(fila.nombre),
      noUnico: Number(fila.noUnico),
      columnas: String(fila.columnas),
    }));
    const cantidadRegistrosAplicacion = Object.entries(conteos)
      .filter(([tabla]) => tabla !== '_prisma_migrations')
      .reduce((total, [, cantidad]) => total + cantidad, 0);

    return {
      entorno: resumenUrl.entorno,
      host: resumenUrl.host,
      puerto: resumenUrl.puerto,
      nombreBaseDatos: nombreBaseActiva,
      permisos,
      cantidadTablas: tablas.length,
      cantidadRegistros: Object.values(conteos).reduce(
        (total, cantidad) => total + cantidad,
        0,
      ),
      cantidadRegistrosAplicacion,
      conteos,
      identificadores,
      clavesForaneas,
      indices,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function ejecutarInspeccion() {
  const rutaEntorno = path.resolve(process.cwd(), '.env.test');
  const resultado = dotenv.config({
    path: rutaEntorno,
    override: true,
    quiet: true,
  });
  if (resultado.error) {
    throw new Error('No se pudo cargar backend/.env.test');
  }

  const inspeccion = await inspeccionarBasePruebas(process.env);
  console.info('INSPECCION_MYSQL_PRUEBAS');
  console.info(JSON.stringify(inspeccion, null, 2));
  if (!inspeccion.permisos.exclusivoBasePruebas) {
    throw new Error('El usuario MySQL tiene permisos fuera del alcance permitido');
  }
}

if (require.main === module) {
  ejecutarInspeccion().catch(error => {
    console.error('INSPECCION_MYSQL_PRUEBAS_FALLIDA');
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    process.exitCode = 1;
  });
}

module.exports = { analizarPermisos, inspeccionarBasePruebas };
