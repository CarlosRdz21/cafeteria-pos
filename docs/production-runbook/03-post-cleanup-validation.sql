-- ETAPA 16B / CHECKPOINT 5 — VALIDACIÓN READ-ONLY POST-SANEAMIENTO
-- Ejecutar sólo si 02-payment-1023-cleanup.sql informó cleanup_committed = 1.

START TRANSACTION READ ONLY;

SELECT id, status, subtotal, tax, total, discountTotal, createdAt,
       paymentMethod, amountPaid, `change`
FROM `Order` WHERE id = 1023;

SELECT id, orderId, method, amount, provider, reference, paidAt
FROM Payment WHERE orderId = 1023 ORDER BY id;

SELECT id, openingAmount, closingAmount, expectedAmount, difference,
       cashSales, cardSales, expenses, totalTransactions,
       openedAt, closedAt, status
FROM CashRegister WHERE id = 96;

SELECT COUNT(*) AS payment_count,
       ROUND(COALESCE(SUM(amount), 0), 2) AS payment_sum
FROM Payment;

-- Debe devolver cero filas.
SELECT orderId, COUNT(*) AS payment_count, ROUND(SUM(amount), 2) AS payment_sum
FROM Payment GROUP BY orderId HAVING COUNT(*) > 1;

-- Debe ser: Payment 953 presente; 954 y 955 ausentes.
SELECT id, orderId, amount, paidAt
FROM Payment WHERE id IN (953, 954, 955) ORDER BY id;

COMMIT;
