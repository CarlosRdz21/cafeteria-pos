-- ETAPA 16B / CHECKPOINT 6 Y 9 — VALIDACIÓN READ-ONLY POST-MIGRACIÓN

START TRANSACTION READ ONLY;

SELECT migration_name, started_at, finished_at, rolled_back_at
FROM _prisma_migrations ORDER BY started_at;

SELECT index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_indexed
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'Payment'
GROUP BY index_name, non_unique
ORDER BY index_name;

SELECT column_name, column_type, is_nullable
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Expense'
  AND column_name = 'idempotencyKey';

SELECT index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_indexed
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'Expense'
  AND index_name = 'Expense_idempotencyKey_key'
GROUP BY index_name, non_unique;

SELECT 'Order' AS metric, COUNT(*) AS row_count, ROUND(COALESCE(SUM(total), 0), 2) AS amount FROM `Order`
UNION ALL SELECT 'OrderItem', COUNT(*), ROUND(COALESCE(SUM(subtotal), 0), 2) FROM OrderItem
UNION ALL SELECT 'Payment', COUNT(*), ROUND(COALESCE(SUM(amount), 0), 2) FROM Payment
UNION ALL SELECT 'Expense', COUNT(*), ROUND(COALESCE(SUM(amount), 0), 2) FROM Expense
UNION ALL SELECT 'CashRegister', COUNT(*), NULL FROM CashRegister
UNION ALL SELECT 'Product', COUNT(*), NULL FROM Product
UNION ALL SELECT 'User', COUNT(*), NULL FROM User
UNION ALL SELECT 'Promotion', COUNT(*), NULL FROM Promotion;

SELECT COUNT(*) AS historical_expenses_with_generated_key
FROM Expense WHERE idempotencyKey IS NOT NULL;

-- Debe devolver cero filas.
SELECT orderId, COUNT(*) AS payment_count
FROM Payment GROUP BY orderId HAVING COUNT(*) > 1;

SELECT id, total, status, createdAt FROM `Order` WHERE id = 1023;
SELECT id, orderId, amount, method, paidAt FROM Payment WHERE orderId = 1023;
SELECT id, cashSales, cardSales, expenses, totalTransactions, status,
       openedAt, closedAt
FROM CashRegister WHERE id IN (96) OR status = 'open'
ORDER BY id;

COMMIT;
