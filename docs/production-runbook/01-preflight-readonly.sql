-- ETAPA 16B / CHECKPOINT 3-4 — SÓLO LECTURA
-- Ejecutar después de activar mantenimiento y confirmar el backup final.
-- Confirmar manualmente que DATABASE() es la base productiva esperada.
-- Este archivo no sanea, no migra y no cambia datos.

SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION READ ONLY;

SELECT VERSION() AS mysql_version,
       DATABASE() AS database_name,
       @@hostname AS database_host,
       NOW(3) AS snapshot_at;

SELECT table_name, engine, table_collation
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY table_name;

SELECT table_name, ordinal_position, column_name, column_type, is_nullable,
       column_default, extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('Order', 'OrderItem', 'Payment', 'Expense', 'CashRegister')
ORDER BY table_name, ordinal_position;

SHOW CREATE TABLE `Order`;
SHOW CREATE TABLE Payment;
SHOW CREATE TABLE Expense;
SHOW CREATE TABLE CashRegister;
SHOW INDEX FROM Payment;
SHOW INDEX FROM Expense;

SELECT 'Order' AS metric, COUNT(*) AS row_count, ROUND(COALESCE(SUM(total), 0), 2) AS amount FROM `Order`
UNION ALL SELECT 'OrderItem', COUNT(*), ROUND(COALESCE(SUM(subtotal), 0), 2) FROM OrderItem
UNION ALL SELECT 'Payment', COUNT(*), ROUND(COALESCE(SUM(amount), 0), 2) FROM Payment
UNION ALL SELECT 'Expense', COUNT(*), ROUND(COALESCE(SUM(amount), 0), 2) FROM Expense
UNION ALL SELECT 'CashRegister', COUNT(*), NULL FROM CashRegister
UNION ALL SELECT 'Product', COUNT(*), NULL FROM Product
UNION ALL SELECT 'User', COUNT(*), NULL FROM User
UNION ALL SELECT 'Promotion', COUNT(*), NULL FROM Promotion
UNION ALL SELECT 'ProductSupply', COUNT(*), NULL FROM ProductSupply
UNION ALL SELECT 'SupplyCategory', COUNT(*), NULL FROM SupplyCategory
UNION ALL SELECT 'SupplyMovement', COUNT(*), NULL FROM SupplyMovement
UNION ALL SELECT 'PrinterSetting', COUNT(*), NULL FROM PrinterSetting;

SELECT status, COUNT(*) AS orders FROM `Order` GROUP BY status ORDER BY status;
SELECT method, COUNT(*) AS payments, ROUND(COALESCE(SUM(amount), 0), 2) AS amount
FROM Payment GROUP BY method ORDER BY method;
SELECT status, COUNT(*) AS registers FROM CashRegister GROUP BY status ORDER BY status;

-- Debe devolver sólo Order 1023 con tres pagos. Cualquier caso adicional es NO-GO.
SELECT orderId, COUNT(*) AS payment_count, ROUND(SUM(amount), 2) AS payment_sum,
       GROUP_CONCAT(id ORDER BY id) AS payment_ids
FROM Payment
GROUP BY orderId
HAVING COUNT(*) > 1
ORDER BY orderId;

SELECT id, status, subtotal, tax, total, discountTotal, createdAt,
       paymentMethod, amountPaid, `change`
FROM `Order`
WHERE id = 1023;

SELECT id, orderId, method, amount, provider, reference, paidAt
FROM Payment
WHERE orderId = 1023
ORDER BY id;

SELECT id, openingAmount, closingAmount, expectedAmount, difference,
       cashSales, cardSales, expenses, totalTransactions,
       openedAt, closedAt, status
FROM CashRegister
WHERE id = 96;

-- Integridad referencial y financiera. Todos estos conteos deben ser cero.
SELECT 'OrderItem_without_Order' AS anomaly, COUNT(*) AS anomaly_count
FROM OrderItem oi LEFT JOIN `Order` o ON o.id = oi.orderId WHERE o.id IS NULL
UNION ALL
SELECT 'Payment_without_Order', COUNT(*)
FROM Payment p LEFT JOIN `Order` o ON o.id = p.orderId WHERE o.id IS NULL
UNION ALL
SELECT 'Completed_Order_without_Payment', COUNT(*)
FROM `Order` o LEFT JOIN Payment p ON p.orderId = o.id
WHERE o.status = 'completed' AND p.id IS NULL
UNION ALL
SELECT 'Payment_for_non_completed_Order', COUNT(*)
FROM Payment p JOIN `Order` o ON o.id = p.orderId
WHERE o.status <> 'completed'
UNION ALL
SELECT 'Expense_without_User', COUNT(*)
FROM Expense e LEFT JOIN `User` u ON u.id = e.userId
WHERE e.userId IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'Expense_without_CashRegister', COUNT(*)
FROM Expense e LEFT JOIN CashRegister c ON c.id = e.cashRegisterId
WHERE e.cashRegisterId IS NOT NULL AND c.id IS NULL;

SELECT COUNT(*) AS open_cash_registers FROM CashRegister WHERE status = 'open';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations';

-- Funciona tanto si Prisma ya tiene historial como si la tabla aún no existe.
SET @has_prisma_migrations = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations'
);
SET @migration_history_sql = IF(
  @has_prisma_migrations = 1,
  'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at',
  'SELECT ''ABSENT'' AS migration_name, NULL AS finished_at, NULL AS rolled_back_at'
);
PREPARE migration_history_statement FROM @migration_history_sql;
EXECUTE migration_history_statement;
DEALLOCATE PREPARE migration_history_statement;

-- SHOW CREATE condicional, sin fallar cuando aún no existe el historial Prisma.
SET @migration_definition_sql = IF(
  @has_prisma_migrations = 1,
  'SHOW CREATE TABLE _prisma_migrations',
  'SELECT ''ABSENT'' AS prisma_migrations_definition'
);
PREPARE migration_definition_statement FROM @migration_definition_sql;
EXECUTE migration_definition_statement;
DEALLOCATE PREPARE migration_definition_statement;

COMMIT;
