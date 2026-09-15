-- ETAPA 16B / CHECKPOINT 5 — ESCRITURA CONTROLADA, NO EJECUTAR EN 16A
-- Requiere mantenimiento activo, backup final verificado y aprobación humana.
-- El procedimiento hace ROLLBACK ante cualquier precondición distinta.
-- Después de CALL, continuar sólo si cleanup_committed = 1.

DELIMITER $$

-- No se usa DROP IF EXISTS antes de CREATE: si el nombre ya existe, el script
-- debe fallar y detenerse en vez de borrar una rutina ajena o de una ejecución
-- anterior que aún requiera investigación.
CREATE PROCEDURE etapa16b_cleanup_payment_1023_20260915(OUT p_committed TINYINT)
main: BEGIN
  DECLARE v_error TEXT DEFAULT NULL;
  DECLARE v_order_count BIGINT DEFAULT 0;
  DECLARE v_payment_count_1023 BIGINT DEFAULT 0;
  DECLARE v_other_duplicate_orders BIGINT DEFAULT 0;
  DECLARE v_payment_count_before BIGINT DEFAULT 0;
  DECLARE v_payment_count_after BIGINT DEFAULT 0;
  DECLARE v_payment_sum_before DECIMAL(18,2) DEFAULT 0;
  DECLARE v_payment_sum_after DECIMAL(18,2) DEFAULT 0;
  DECLARE v_payment_ids TEXT;
  DECLARE v_deleted BIGINT DEFAULT 0;
  DECLARE v_order_hash_before CHAR(64);
  DECLARE v_order_hash_after CHAR(64);
  DECLARE v_cash_hash_before CHAR(64);
  DECLARE v_cash_hash_after CHAR(64);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 v_error = MESSAGE_TEXT;
    ROLLBACK;
    SET p_committed = 0;
    SELECT 'ROLLBACK' AS transaction_result, v_error AS reason;
  END;

  SET p_committed = 0;
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  START TRANSACTION;

  -- Los bloqueos son selecciones directas; los agregados posteriores sólo validan.
  SELECT id FROM `Order` WHERE id = 1023 FOR UPDATE;
  SELECT COUNT(*),
         SHA2(CONCAT_WS('|', id, status, subtotal, tax, total, discountTotal,
                        IFNULL(CAST(appliedPromotions AS CHAR), '<NULL>'),
                        IFNULL(tableNumber, '<NULL>'), IFNULL(customerName, '<NULL>'),
                        IFNULL(notes, '<NULL>'), createdAt,
                        IFNULL(paymentMethod, '<NULL>'), IFNULL(amountPaid, '<NULL>'),
                        IFNULL(`change`, '<NULL>')), 256)
    INTO v_order_count, v_order_hash_before
  FROM `Order`
  WHERE id = 1023
  GROUP BY id;

  IF v_order_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order 1023 no existe exactamente una vez';
  END IF;
  IF (SELECT ROUND(total, 2) FROM `Order` WHERE id = 1023) <> 190.00 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order 1023 ya no totaliza 190.00';
  END IF;

  SELECT id FROM Payment WHERE orderId = 1023 ORDER BY id FOR UPDATE;
  SELECT COUNT(*), GROUP_CONCAT(id ORDER BY id)
    INTO v_payment_count_1023, v_payment_ids
  FROM Payment
  WHERE orderId = 1023;

  IF v_payment_count_1023 <> 3 OR v_payment_ids <> '953,954,955' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payments de Order 1023 no son exactamente 953,954,955';
  END IF;
  IF EXISTS (
    SELECT 1 FROM Payment
    WHERE id IN (953, 954, 955)
      AND (orderId <> 1023 OR ROUND(amount, 2) <> 190.00)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order o importe de Payment 953/954/955 no coincide';
  END IF;

  SELECT COUNT(*) INTO v_other_duplicate_orders
  FROM (
    SELECT orderId FROM Payment
    WHERE orderId <> 1023
    GROUP BY orderId HAVING COUNT(*) > 1
  ) AS duplicate_orders;
  IF v_other_duplicate_orders <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Existen Payments duplicados adicionales';
  END IF;

  SELECT SHA2(CONCAT_WS('|', id, openingAmount, IFNULL(closingAmount, '<NULL>'),
                        IFNULL(expectedAmount, '<NULL>'), IFNULL(difference, '<NULL>'),
                        cashSales, cardSales, expenses, totalTransactions, openedAt,
                        IFNULL(closedAt, '<NULL>'), status, userRef), 256)
    INTO v_cash_hash_before
  FROM CashRegister
  WHERE id = 96
  FOR UPDATE;
  IF v_cash_hash_before IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CashRegister 96 no existe';
  END IF;
  IF EXISTS (
    SELECT 1 FROM CashRegister
    WHERE id = 96 AND (
      ROUND(cashSales, 2) <> 1148.00 OR ROUND(cardSales, 2) <> 160.00
      OR totalTransactions <> 12 OR status <> 'closed'
    )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CashRegister 96 no coincide con la evidencia auditada';
  END IF;

  SELECT COUNT(*), ROUND(COALESCE(SUM(amount), 0), 2)
    INTO v_payment_count_before, v_payment_sum_before
  FROM Payment;

  DELETE FROM Payment
  WHERE orderId = 1023 AND id IN (954, 955);
  SET v_deleted = ROW_COUNT();
  IF v_deleted <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se eliminaron exactamente dos Payments';
  END IF;

  SELECT COUNT(*), ROUND(COALESCE(SUM(amount), 0), 2)
    INTO v_payment_count_after, v_payment_sum_after
  FROM Payment;
  IF v_payment_count_after <> v_payment_count_before - 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'COUNT Payment posterior inesperado';
  END IF;
  IF v_payment_sum_after <> v_payment_sum_before - 380.00 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUM Payment posterior inesperado';
  END IF;
  IF (SELECT COUNT(*) FROM Payment WHERE orderId = 1023) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM Payment WHERE id = 953 AND orderId = 1023 AND ROUND(amount, 2) = 190.00
     ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment 953 no quedó como único pago válido';
  END IF;
  IF EXISTS (SELECT 1 FROM Payment GROUP BY orderId HAVING COUNT(*) > 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Persisten Payments duplicados';
  END IF;

  SELECT SHA2(CONCAT_WS('|', id, status, subtotal, tax, total, discountTotal,
                        IFNULL(CAST(appliedPromotions AS CHAR), '<NULL>'),
                        IFNULL(tableNumber, '<NULL>'), IFNULL(customerName, '<NULL>'),
                        IFNULL(notes, '<NULL>'), createdAt,
                        IFNULL(paymentMethod, '<NULL>'), IFNULL(amountPaid, '<NULL>'),
                        IFNULL(`change`, '<NULL>')), 256)
    INTO v_order_hash_after
  FROM `Order` WHERE id = 1023;
  SELECT SHA2(CONCAT_WS('|', id, openingAmount, IFNULL(closingAmount, '<NULL>'),
                        IFNULL(expectedAmount, '<NULL>'), IFNULL(difference, '<NULL>'),
                        cashSales, cardSales, expenses, totalTransactions, openedAt,
                        IFNULL(closedAt, '<NULL>'), status, userRef), 256)
    INTO v_cash_hash_after
  FROM CashRegister WHERE id = 96;
  IF NOT (v_order_hash_before <=> v_order_hash_after) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order 1023 cambió durante el saneamiento';
  END IF;
  IF NOT (v_cash_hash_before <=> v_cash_hash_after) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CashRegister 96 cambió durante el saneamiento';
  END IF;

  COMMIT;
  SET p_committed = 1;
  SELECT 'COMMIT' AS transaction_result,
         v_payment_count_before AS payment_count_before,
         v_payment_count_after AS payment_count_after,
         v_payment_sum_before AS payment_sum_before,
         v_payment_sum_after AS payment_sum_after;
END$$

CALL etapa16b_cleanup_payment_1023_20260915(@cleanup_committed)$$
DROP PROCEDURE etapa16b_cleanup_payment_1023_20260915$$
DELIMITER ;

SELECT @cleanup_committed AS cleanup_committed,
       IF(@cleanup_committed = 1, 'PASS — continuar al checkpoint 6',
          'FAIL — detener migración') AS checkpoint_result;
