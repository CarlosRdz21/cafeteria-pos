const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { validarConfiguracionBasePruebas } = require('./test-database-safety.js');

const backendRoot = path.resolve(__dirname, '..');
const targetDatabase = 'cafeteria_pos_prod_clone_transaction_test';

function cargarEntornoTransaccional() {
  const localResult = dotenv.config({
    path: path.join(backendRoot, '.env.test'),
    override: true,
    quiet: true,
  });
  if (localResult.error) throw new Error('No se pudo cargar backend/.env.test');

  const cloneResult = dotenv.config({
    path: path.join(backendRoot, '.env.prod-clone.local'),
    quiet: true,
  });
  if (cloneResult.error || !cloneResult.parsed) {
    throw new Error('No se pudo cargar backend/.env.prod-clone.local');
  }

  const config = cloneResult.parsed;
  const host = String(config.MYSQL_HOST || '').trim().toLowerCase();
  const port = String(config.MYSQL_PORT || '').trim();
  const sourceDatabase = String(config.MYSQL_DATABASE || '').trim();
  const user = String(config.MYSQL_USER || '').trim();
  const password = String(config.MYSQL_PASSWORD || '');

  if (!['localhost', '127.0.0.1'].includes(host) || port !== '3306') {
    throw new Error('La prueba transaccional exige MySQL localhost:3306');
  }
  if (sourceDatabase !== 'cafeteria_pos_prod_clone') {
    throw new Error('El archivo local no corresponde al clon autorizado');
  }
  if (!user || user.toLowerCase() === 'root' || !password) {
    throw new Error('Se requiere el usuario dedicado, distinto de root');
  }

  const url = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${targetDatabase}`;
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = url;
  process.env.TEST_DATABASE_URL = url;
  process.env.ALLOW_DESTRUCTIVE_TESTS = 'true';
  process.env.ALLOW_PROD_CLONE_TRANSACTION_TEST = 'true';
  delete process.env.PRODUCTION_DATABASE_URL;
  delete process.env.MP_ACCESS_TOKEN;
  delete process.env.MP_DEVICE_ID;

  return validarConfiguracionBasePruebas(process.env, {
    requerirDestructiva: true,
  });
}

async function ejecutarPruebasClonTransaccional() {
  const resumen = cargarEntornoTransaccional();
  console.info(
    `CLON_TRANSACCIONAL_CONFIRMADO host=${resumen.host} puerto=${resumen.puerto} base=${resumen.nombreBaseDatos}`,
  );

  const prisma = new PrismaClient();
  let cajaHistorica;
  try {
    cajaHistorica = await prisma.cashRegister.findUnique({ where: { id: 160 } });
    const [cajasPrueba, ordenesPrueba] = await Promise.all([
      prisma.cashRegister.count({ where: { userRef: { startsWith: 'TEST_' } } }),
      prisma.order.count({ where: { customerName: { startsWith: 'TEST_' } } }),
    ]);
    if (!cajaHistorica || cajaHistorica.status !== 'open') {
      throw new Error('La caja histórica 160 no está abierta antes del aislamiento');
    }
    if (cajasPrueba !== 0 || ordenesPrueba !== 0) {
      throw new Error('La copia transaccional contiene remanentes TEST_');
    }

    await prisma.cashRegister.update({
      where: { id: 160 },
      data: { status: 'test-isolated' },
    });
    console.info('CAJA_HISTORICA_AISLADA id=160');

    const vitestCli = path.join(
      path.dirname(require.resolve('vitest/package.json')),
      'vitest.mjs',
    );
    const result = spawnSync(
      process.execPath,
      [
        vitestCli,
        'run',
        'tests/integration',
        '--no-file-parallelism',
        '--maxWorkers=1',
      ],
      {
        cwd: backendRoot,
        env: { ...process.env, RUN_MYSQL_INTEGRATION: 'true' },
        stdio: 'inherit',
      },
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Las pruebas transaccionales terminaron con código ${result.status}`);
    }
  } finally {
    if (cajaHistorica) {
      const { id, ...data } = cajaHistorica;
      await prisma.cashRegister.update({ where: { id }, data });
      console.info('CAJA_HISTORICA_RESTAURADA id=160');
    }
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  ejecutarPruebasClonTransaccional().catch(error => {
    console.error('PRUEBAS_CLON_TRANSACCIONAL_FALLIDAS');
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    process.exitCode = 1;
  });
}

module.exports = {
  cargarEntornoTransaccional,
  ejecutarPruebasClonTransaccional,
};
