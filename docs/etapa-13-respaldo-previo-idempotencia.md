# Estado previo a la unicidad de pagos

Antes de aplicar `20260723153500_payment_order_unique` se confirmo:

- base aislada `cafeteria_pos_test`;
- usuario limitado exclusivamente a esa base;
- cero registros de aplicacion;
- cero filas en `Payment`;
- migracion inicial aplicada sin pendientes.

No habia datos que copiar. El rollback en la base aislada consiste en eliminar
`Payment_orderId_key` y recrear `Payment_orderId_idx`. No se debe ejecutar ese
rollback en produccion durante la Etapa 13.
