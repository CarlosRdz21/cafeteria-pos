# Etapa 15 — Snapshot previo a migración

Fecha de auditoría: 2026-09-14
Destino: `localhost:3306/cafeteria_pos_prod_clone`
Modo: sesión MySQL con transacción `READ ONLY`, finalizada con `ROLLBACK`

## Aislamiento verificado

- La conexión utilizada fue exclusivamente local.
- La base seleccionada fue `cafeteria_pos_prod_clone`.
- No se utilizó `root`.
- No se utilizó `cafeteria_pos_test`.
- No se accedió a Hostinger, Render, Mercado Pago ni otro servicio productivo.
- El usuario dedicado está limitado al schema del clon, pero actualmente tiene `ALL PRIVILEGES` dentro de ese schema. Las consultas de esta auditoría se protegieron forzando `@@session.transaction_read_only = 1`.

## Línea base externa obligatoria

| Métrica | Esperado | Calculado | Diferencia |
|---|---:|---:|---:|
| Order | 1602 | 1602 | 0 |
| OrderItem | 3219 | 3219 | 0 |
| Payment | 1526 | 1526 | 0 |
| SUM(Payment.amount) | $221,755.00 | $221,755.00 | $0.00 |
| Expense | 546 | 546 | 0 |
| SUM(Expense.amount) | $125,756.40 | $125,756.40 | $0.00 |
| CashRegister | 160 | 160 | 0 |
| CashRegister abiertas | 1 | 1 | 0 |
| Product | 77 | 77 | 0 |
| User | 2 | 2 | 0 |
| Promotion | 2 | 2 | 0 |

La línea base coincide exactamente. Los importes `DOUBLE` se compararon redondeados a dos decimales.

## Conteos de todas las tablas encontradas

| Tabla | Registros |
|---|---:|
| cashregister | 160 |
| expense | 546 |
| order | 1602 |
| orderitem | 3219 |
| payment | 1526 |
| printersetting | 1 |
| product | 77 |
| productcategory | 16 |
| productsupply | 0 |
| promotion | 2 |
| supplycategory | 0 |
| supplymovement | 0 |
| user | 2 |

No se encontró la tabla `_prisma_migrations`.

## Métricas financieras y operativas

| Métrica | Valor |
|---|---:|
| Pedidos totales | 1602 |
| Pedidos completados | 1524 |
| Pedidos pendientes | 0 |
| Pedidos cancelados | 78 |
| Pagos | 1526 |
| Ventas según Payment.amount | $221,755.00 |
| Total de Order completadas | $221,638.00 |
| Pagos en efectivo | 1146 / $161,325.00 |
| Pagos con tarjeta | 380 / $60,430.00 |
| Gastos | 546 / $125,756.40 |
| Cajas abiertas | 1 |
| Cajas cerradas | 159 |
| Movimientos de inventario | 0 |

## Integridad referencial revisada

| Validación | Hallazgos |
|---|---:|
| OrderItem sin Order | 0 |
| Payment sin Order | 0 |
| Order completada sin Payment | 0 |
| Payment asociado a Order no completada | 0 |
| Cajas abiertas adicionales | 0 |
| Expense con userId inválido | 0 |
| Expense con cashRegisterId inválido | 0 |
| Product con categoryId inválido | 0 |
| ProductSupply con categoryId inválido | 0 |
| SupplyMovement con supplyId inválido | 0 |
| SupplyMovement con userId inválido | 0 |
| orderId con pagos duplicados | **1** |

## Bloqueo obligatorio: Payment.orderId duplicado

La orden `1023` tiene tres pagos históricos:

| Payment.id | Método | Importe | paidAt |
|---:|---|---:|---|
| 953 | cash | $190.00 | 2026-07-02 15:40:47.551 |
| 954 | cash | $190.00 | 2026-07-02 15:40:48.679 |
| 955 | cash | $190.00 | 2026-07-02 15:41:09.492 |

Total de pagos asociados a la orden: **$570.00**.

De acuerdo con la regla crítica de la etapa, no se creó el índice `UNIQUE` de `Payment.orderId`, no se modificaron estos pagos y el ensayo se detuvo.

## Caja abierta preservada

La caja real abierta se observó sin modificarla:

| Campo | Valor |
|---|---|
| id | 160 |
| openingAmount | $118.00 |
| cashSales | $620.00 |
| cardSales | $264.00 |
| expenses | $0.00 |
| totalTransactions | 6 |
| openedAt | 2026-09-14 14:15:13.311 |
| status | open |
| userRef | Usuario real anonimizado |

No se modificó `status`, `closedAt` ni ningún importe.

## Resultado

**MIGRACIÓN BLOQUEADA.** No se ejecutaron backup pre-migración, migraciones, Prisma, backend, frontend ni pruebas transaccionales después de detectar los pagos múltiples.

---

## Addendum posterior al saneamiento autorizado

El bloqueo anterior describe fielmente la primera auditoría. Posteriormente, el propietario autorizó un saneamiento controlado exclusivo de Order 1023. Se conservaron Payment 953 y se eliminaron únicamente Payment 954 y 955 dentro de una transacción validada. El detalle y su respaldo están documentados en `etapa-15-ensayo-migracion-produccion.md`.

La línea base usada para reanudar el ensayo quedó así:

| Métrica | Valor saneado |
|---|---:|
| Order | 1602 |
| OrderItem | 3219 |
| Payment | 1524 |
| SUM(Payment.amount) | $221,375.00 |
| Expense | 546 |
| SUM(Expense.amount) | $125,756.40 |
| CashRegister | 160 |
| CashRegister abiertas | 1 |
| Product | 77 |
| User | 2 |
| Promotion | 2 |
| orderId con Payments múltiples | 0 |

Todas las demás métricas permanecieron iguales. Esta diferencia autorizada de dos pagos y $380.00 es el único cambio de datos entre la línea base externa original y la línea base saneada de migración.
