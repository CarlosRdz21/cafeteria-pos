-- ETAPA 16A.2 — PREFLIGHT PRODUCTIVO SÓLO LECTURA
-- No requiere mantenimiento y no reemplaza el backup final de 16B.
-- Confirmar manualmente que DATABASE() es la base productiva esperada.
-- Este archivo no sanea, no migra y no cambia datos.

SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION READ ONLY;

SELECT VERSION() AS mysql_version,
       DATABASE() AS database_name,
       @@hostname AS database_host,
       CURRENT_USER() AS authenticated_account,
       NOW(3) AS snapshot_at;

SELECT default_character_set_name AS database_charset,
       default_collation_name AS database_collation
FROM information_schema.schemata
WHERE schema_name = DATABASE();

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
SHOW CREATE TABLE OrderItem;
SHOW CREATE TABLE Payment;
SHOW CREATE TABLE Expense;
SHOW CREATE TABLE CashRegister;
SHOW INDEX FROM `Order`;
SHOW INDEX FROM OrderItem;
SHOW INDEX FROM Payment;
SHOW INDEX FROM Expense;
SHOW INDEX FROM CashRegister;

SELECT table_name, constraint_name, column_name,
       referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
  AND referenced_table_name IS NOT NULL
  AND table_name IN ('Order', 'OrderItem', 'Payment', 'Expense', 'CashRegister')
ORDER BY table_name, constraint_name, ordinal_position;

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

-- Actividad más reciente: no devuelve nombres de clientes, notas ni credenciales.
SELECT id, createdAt, status
FROM `Order`
ORDER BY createdAt DESC, id DESC
LIMIT 1;

SELECT id, orderId, paidAt, method
FROM Payment
ORDER BY paidAt DESC, id DESC
LIMIT 1;

SELECT id, `timestamp`, category
FROM Expense
ORDER BY `timestamp` DESC, id DESC
LIMIT 1;

SELECT id, openedAt, closedAt, status
FROM CashRegister
ORDER BY openedAt DESC, id DESC
LIMIT 1;

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

SELECT id, orderId, productId, name, price, quantity, subtotal
FROM OrderItem
WHERE orderId = 1023
ORDER BY id;

SELECT orderId, COUNT(*) AS item_count,
       ROUND(COALESCE(SUM(subtotal), 0), 2) AS items_subtotal,
       ROUND(COALESCE(SUM(price * quantity), 0), 2) AS recalculated_subtotal
FROM OrderItem
WHERE orderId = 1023
GROUP BY orderId;

SELECT id, openingAmount, closingAmount, expectedAmount, difference,
       cashSales, cardSales, expenses, totalTransactions,
       openedAt, closedAt, status
FROM CashRegister
WHERE id = 96;

SELECT id, openedAt, status, userRef
FROM CashRegister
WHERE status = 'open'
ORDER BY openedAt, id;

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

-- Order 1540 es una excepción histórica exacta: dos cobros reales, pero sólo
-- el primer Payment quedó persistido. Cualquier cambio en esta huella es NO-GO.
SELECT CASE
         WHEN (SELECT COUNT(*) FROM `Order`
               WHERE id = 1540 AND total = 378.00 AND status = 'completed') = 1
          AND (SELECT COUNT(*) FROM Payment
               WHERE id = 1455 AND orderId = 1540 AND amount = 115.00
                 AND method = 'cash') = 1
          AND (SELECT COUNT(*) FROM Payment WHERE orderId = 1540) = 1
          AND (SELECT COUNT(*) FROM CashRegister
               WHERE id = 150 AND cashSales = 716.00 AND cardSales = 638.00
                 AND totalTransactions = 8 AND status = 'closed') = 1
         THEN 'PASS_KNOWN_EXCEPTION'
         ELSE 'NO_GO_EXCEPTION_CHANGED'
       END AS order_1540_exception_status;

-- Debe devolver cero filas. La exclusión es exacta y sólo aplica a 1540/1455.
SELECT p.id AS payment_id, p.orderId, p.amount AS payment_amount,
       o.total AS order_total, o.status AS order_status
FROM Payment p
JOIN `Order` o ON o.id = p.orderId
WHERE ABS(p.amount - o.total) > 0.005
  AND NOT (
    o.id = 1540 AND o.total = 378.00 AND o.status = 'completed'
    AND p.id = 1455 AND p.amount = 115.00 AND p.method = 'cash'
  )
ORDER BY p.orderId, p.id;

SELECT 'OrderItem_without_Product' AS anomaly, COUNT(*) AS anomaly_count
FROM OrderItem oi LEFT JOIN Product p ON p.id = oi.productId
WHERE p.id IS NULL
UNION ALL
SELECT 'OrderItem_unexpected_NULL', COUNT(*)
FROM OrderItem
WHERE productId IS NULL OR name IS NULL OR price IS NULL OR quantity IS NULL
   OR subtotal IS NULL OR orderId IS NULL;

SELECT COUNT(*) AS open_cash_registers FROM CashRegister WHERE status = 'open';

-- Estado de objetos de inventario/recetas, incluso si sólo existen parcialmente.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND (
    LOWER(table_name) REGEXP 'recipe|ingredient|inventory'
    OR table_name IN ('ProductSupply', 'SupplyCategory', 'SupplyMovement')
  )
ORDER BY table_name;

-- Tipos JSON/LONGTEXT: sólo se documentan, no se convierten.
SELECT table_name, column_name, column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND data_type IN ('json', 'longtext')
ORDER BY table_name, ordinal_position;

-- AUTO_INCREMENT debe ser mayor al máximo ID (o NULL en tablas sin autoincremento).
SELECT t.table_name, t.auto_increment, ids.max_id,
       CASE
         WHEN t.auto_increment IS NULL THEN 'NOT_APPLICABLE'
         WHEN t.auto_increment > COALESCE(ids.max_id, 0) THEN 'PASS'
         ELSE 'REVIEW'
       END AS auto_increment_status
FROM information_schema.tables t
JOIN (
  SELECT 'Order' AS table_name, MAX(id) AS max_id FROM `Order`
  UNION ALL SELECT 'Payment', MAX(id) FROM Payment
  UNION ALL SELECT 'Expense', MAX(id) FROM Expense
  UNION ALL SELECT 'CashRegister', MAX(id) FROM CashRegister
  UNION ALL SELECT 'Product', MAX(id) FROM Product
  UNION ALL SELECT 'User', MAX(id) FROM `User`
) ids ON ids.table_name = t.table_name
WHERE t.table_schema = DATABASE()
ORDER BY t.table_name;

SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
    (table_name = 'Expense' AND column_name = 'idempotencyKey')
    OR (table_name = 'Payment' AND column_name = 'orderId')
  )
ORDER BY table_name, ordinal_position;

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
  'SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at',
  'SELECT ''ABSENT'' AS migration_name, NULL AS finished_at, NULL AS rolled_back_at, NULL AS applied_steps_count'
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

-- ROLLBACK es deliberado aunque todas las operaciones anteriores son de lectura.
ROLLBACK;
