const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: '.env.prod-clone.local' });

const sourceDatabase = 'cafeteria_pos_prod_clone';
const targetDatabase = 'cafeteria_pos_prod_clone_transaction_test';

function serialize(value) {
  return JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}

async function main() {
  if (process.env.MYSQL_HOST !== 'localhost' || process.env.MYSQL_USER === 'root') {
    throw new Error('Entorno local dedicado no confirmado');
  }

  const user = encodeURIComponent(process.env.MYSQL_USER || '');
  const password = encodeURIComponent(process.env.MYSQL_PASSWORD || '');
  process.env.DATABASE_URL = `mysql://${user}:${password}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${targetDatabase}`;
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(async tx => {
      const source = await tx.$queryRawUnsafe(
        `SELECT * FROM \`${sourceDatabase}\`.CashRegister WHERE id = 160`,
      );
      const target = await tx.$queryRawUnsafe(
        'SELECT * FROM CashRegister WHERE id = 160 FOR UPDATE',
      );
      const [remnants] = await tx.$queryRawUnsafe(
        "SELECT (SELECT COUNT(*) FROM CashRegister WHERE userRef LIKE 'TEST_integridad_cierre_%') AS boxes, (SELECT COUNT(*) FROM `Order` WHERE customerName LIKE 'TEST_integridad_cierre_%') AS orders",
      );

      if (source.length !== 1 || target.length !== 1) {
        throw new Error('No se encontró exactamente una caja 160 en origen y destino');
      }
      if (source[0].status !== 'open' || target[0].status !== 'closed') {
        throw new Error('Los estados esperados para restaurar la caja 160 no coinciden');
      }
      if (Number(remnants.boxes) !== 0 || Number(remnants.orders) !== 0) {
        throw new Error('Existen remanentes de prueba; se cancela la restauración puntual');
      }

      const affected = await tx.$executeRawUnsafe(`
        UPDATE CashRegister AS target
        JOIN \`${sourceDatabase}\`.CashRegister AS source ON source.id = target.id
        SET
          target.openingAmount = source.openingAmount,
          target.closingAmount = source.closingAmount,
          target.expectedAmount = source.expectedAmount,
          target.difference = source.difference,
          target.cashSales = source.cashSales,
          target.cardSales = source.cardSales,
          target.expenses = source.expenses,
          target.totalTransactions = source.totalTransactions,
          target.openedAt = source.openedAt,
          target.closedAt = source.closedAt,
          target.status = source.status,
          target.userRef = source.userRef
        WHERE target.id = 160
      `);
      if (affected !== 1) throw new Error(`Restauración inesperada: filas=${affected}`);

      const restored = await tx.$queryRawUnsafe(
        'SELECT * FROM CashRegister WHERE id = 160',
      );
      if (serialize(restored[0]) !== serialize(source[0])) {
        throw new Error('La caja restaurada no coincide exactamente con el clon histórico');
      }
    });

    console.log(`CAJA_160_RESTAURADA origen=${sourceDatabase} destino=${targetDatabase}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(`RESTAURACION_FALLIDA ${error.message}`);
  process.exitCode = 1;
});
