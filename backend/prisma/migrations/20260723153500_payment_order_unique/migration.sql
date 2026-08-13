-- La aplicacion modela un unico pago final por pedido.
CREATE UNIQUE INDEX `Payment_orderId_key` ON `Payment`(`orderId`);
DROP INDEX `Payment_orderId_idx` ON `Payment`;
