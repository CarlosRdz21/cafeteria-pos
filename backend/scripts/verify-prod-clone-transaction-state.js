const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');

dotenv.config({ path: '.env.prod-clone.local' });

const database = 'cafeteria_pos_prod_clone_transaction_test';
const sourceDatabase = 'cafeteria_pos_prod_clone';
const businessTables = [
  'CashRegister',
  'Expense',
  'Order',
  'OrderItem',
  'Payment',
  'PrinterSetting',
  'Product',
  'ProductCategory',
  'ProductSupply',
  'Promotion',
  'SupplyCategory',
  'SupplyMovement',
  'User',
];

function serialize(value) {
  return JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}

async function main() {
  const user = encodeURIComponent(process.env.MYSQL_USER || '');
  const password = encodeURIComponent(process.env.MYSQL_PASSWORD || '');
  const host = process.env.MYSQL_HOST;
  const port = process.env.MYSQL_PORT;
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
  const connection = new PrismaClient();

  try {
    const [metrics] = await connection.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*) FROM Payment) AS paymentCount,
        (SELECT COALESCE(SUM(amount), 0) FROM Payment) AS paymentSum,
        (SELECT COUNT(*) FROM \`Order\`) AS orderCount,
        (SELECT COUNT(*) FROM OrderItem) AS orderItemCount,
        (SELECT COUNT(*) FROM Expense) AS expenseCount,
        (SELECT COALESCE(SUM(amount), 0) FROM Expense) AS expenseSum,
        (SELECT COUNT(*) FROM CashRegister) AS cashRegisterCount,
        (SELECT COUNT(*) FROM CashRegister WHERE status = 'open') AS openCount
    `);
    const box160 = await connection.$queryRawUnsafe(
      'SELECT id, status, openingAmount, closingAmount, expectedAmount, difference, openedAt, closedAt, cashSales, cardSales, expenses, totalTransactions, userRef FROM CashRegister WHERE id = 160',
    );
    const [testBoxes] = await connection.$queryRawUnsafe(
      "SELECT COUNT(*) AS count FROM CashRegister WHERE userRef LIKE 'TEST_integridad_cierre_%'",
    );
    const [testOrders] = await connection.$queryRawUnsafe(
      "SELECT COUNT(*) AS count FROM `Order` WHERE customerName LIKE 'TEST_integridad_cierre_%'",
    );
    const [duplicatePayments] = await connection.$queryRawUnsafe(
      'SELECT COUNT(*) AS count FROM (SELECT orderId FROM Payment GROUP BY orderId HAVING COUNT(*) > 1) AS duplicates',
    );

    const combinedSource = createHash('sha256');
    const combinedTarget = createHash('sha256');
    let exactMatch = true;
    for (const table of businessTables) {
      const quotedTable = `\`${table}\``;
      const sourceRows = await connection.$queryRawUnsafe(
        `SELECT * FROM \`${sourceDatabase}\`.${quotedTable} ORDER BY id`,
      );
      const targetRows = await connection.$queryRawUnsafe(
        `SELECT * FROM ${quotedTable} ORDER BY id`,
      );
      const sourceJson = serialize(sourceRows);
      const targetJson = serialize(targetRows);
      combinedSource.update(table).update(sourceJson);
      combinedTarget.update(table).update(targetJson);
      if (sourceJson !== targetJson) exactMatch = false;
    }

    console.log(`CLON_TRANSACCIONAL_ESTADO base=${database}`);
    console.log(`METRICAS ${serialize(metrics)}`);
    console.log(`CAJA_160 ${serialize(box160)}`);
    console.log(`REMANENTES cajas=${testBoxes.count} ordenes=${testOrders.count}`);
    console.log(`PAGOS_DUPLICADOS ordenes=${duplicatePayments.count}`);
    console.log(
      `INTEGRIDAD_13_TABLAS exacta=${exactMatch} origen=${combinedSource.digest('hex').toUpperCase()} destino=${combinedTarget.digest('hex').toUpperCase()}`,
    );
    if (!exactMatch) process.exitCode = 2;
  } finally {
    await connection.$disconnect();
  }
}

main().catch(error => {
  console.error(`VERIFICACION_FALLIDA ${error.message}`);
  process.exitCode = 1;
});
