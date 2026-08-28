-- La clave identifica una intención de gasto, no sus datos contables.
-- NULL conserva compatibilidad con clientes anteriores que aún no envían clave.
ALTER TABLE `Expense`
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Expense_idempotencyKey_key`
    ON `Expense`(`idempotencyKey`);
