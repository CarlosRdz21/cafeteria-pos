# Etapa 16A.3 — auditoría forense read-only de Order 1540

Fecha de investigación: 2026-09-27 (America/Mexico_City). Snapshot productivo
según MariaDB: `2026-09-27 20:37:47.593`.

## Resumen

Order 1540 registra `$378.00`, mientras que su único Payment, 1455, registra
`$115.00` en efectivo. La auditoría de datos, caja y código histórico demuestra
un mecanismo del POS capaz de producir exactamente este estado:

1. la orden fue finalizada inicialmente con total `$115.00` y se creó Payment
   1455 por ese total;
2. el flujo histórico permitía devolver una orden completada a `pending` y
   agregar productos sin validar su estado anterior;
3. al finalizarla de nuevo con total `$378.00`, `PaymentService` reutilizó el
   Payment existente, pero el controlador volvió a incrementar caja con el
   total y método de la segunda finalización;
4. la caja conserva las dos huellas: `$115.00` adicionales en efectivo,
   `$378.00` adicionales en tarjeta y una transacción adicional.

Clasificación: **E. ERROR HISTÓRICO DEL POS**. Confianza: **ALTA** para el
mecanismo técnico. El medio de pago ocurrido realmente en el negocio continúa
sin poder demostrarse; por ello no se propone modificar datos históricos.

La investigación se ejecutó exclusivamente con `SELECT` dentro de
`START TRANSACTION READ ONLY` y terminó con `ROLLBACK`. No se modificó
producción.

## Order

| Campo | Valor |
| --- | --- |
| id | 1540 |
| status | `completed` |
| subtotal | `$378.00` |
| tax | `$0.00` |
| total | `$378.00` |
| discountTotal | `$0.00` |
| appliedPromotions | arreglo vacío |
| createdAt | `2026-09-02 15:01:12.023` |
| paymentMethod | `NULL` |
| amountPaid | `NULL` |
| change | `NULL` |

`tableNumber` y `customerName` estaban presentes, pero sus valores se omitieron
por privacidad. `notes` estaba ausente. El modelo productivo no contiene
`updatedAt`, relación directa con User ni relación directa con CashRegister;
por tanto, esos datos no pueden recuperarse para esta orden.

## OrderItems

| ID | Producto histórico | Product ID | Precio histórico | Cantidad | Subtotal |
| ---: | --- | ---: | ---: | ---: | ---: |
| 6369 | Desayuno Dulce Aroma | 61 | $115.00 | 1 | $115.00 |
| 6370 | Latte - Caliente 12 oz - Leche Entera - Sabor Vainilla | 3 | $65.00 | 1 | $65.00 |
| 6371 | Huevos al gusto - Extra Estrellados | 39 | $99.00 | 2 | $198.00 |

Reconciliación matemática:

`$115.00 + $65.00 + (2 × $99.00) = $378.00`

Los subtotales almacenados y `SUM(price × quantity)` producen `$378.00`. Los
tres productos aún existen. El Latte cuesta actualmente `$60.00`, pero ese
precio actual no sustituye el precio histórico de `$65.00` almacenado en el
OrderItem. El esquema de OrderItem no contiene variant, size, extras, discount
o notes como columnas separadas; la personalización quedó incorporada al
nombre histórico.

## Payment

| Campo | Valor |
| --- | --- |
| id | 1455 |
| orderId | 1540 |
| amount | `$115.00` |
| method | `cash` |
| paidAt | `2026-09-02 15:12:21.685` |
| provider | `NULL` |
| reference | ausente |
| metadata | presente sin claves útiles |

Payment no tiene `updatedAt` ni `cashRegisterId`. Sólo existe un Payment para
Order 1540. No hay estructura de pago parcial o dividido y no se encontraron
referencias externas, proveedor, segundo método ni evidencia de reintento en el
registro.

En la ventana de ±30 minutos sólo aparecieron:

- Payment 1454 / Order 1539, efectivo por `$65.00`, consistente con su Order;
- Payment 1455 / Order 1540, efectivo por `$115.00`.

No aparecieron Payments huérfanos ni importes complementarios de `$263.00` o
`$378.00` en esa ventana. No se amplió porque no surgió evidencia que lo
justificara.

## Timeline

| Evento | Fecha y hora |
| --- | --- |
| Apertura CashRegister 150 | `2026-09-02 13:32:30.535` |
| Creación Order 1540 | `2026-09-02 15:01:12.023` |
| Creación Payment 1455 | `2026-09-02 15:12:21.685` |
| Cierre CashRegister 150 | `2026-09-03 03:36:21.370` |

Payment se creó 11 minutos y 9.662 segundos después de la Order. Al no existir
`updatedAt` ni historial de estados/items, la base por sí sola no fecha la
reapertura o modificación posterior. Esa secuencia se deduce de la combinación
exacta de caja, Payment final y comportamiento del código histórico.

## CashRegister

La única caja cuya ventana contiene Payment 1455 es CashRegister 150:

| Campo | Valor |
| --- | ---: |
| Estado | `closed` |
| openingAmount | $170.00 |
| cashSales | $716.00 |
| cardSales | $638.00 |
| expenses | $0.00 |
| expectedAmount | $886.00 |
| closingAmount | $886.00 |
| difference | $0.00 |
| totalTransactions | 8 |

La asociación es temporal, no una foreign key: Payment no conserva
`cashRegisterId`.

## Reconciliación

Durante la ventana de CashRegister 150 existen siete Payments para siete Orders:

| Fuente | Efectivo | Tarjeta | Total | Transacciones/Orders |
| --- | ---: | ---: | ---: | ---: |
| Payments registrados | $716.00 | $260.00 | $976.00 | 7 |
| Totales finales de las siete Orders, clasificados por el método del Payment | $979.00 | $260.00 | $1,239.00 | 7 |
| Campos almacenados en CashRegister 150 | $716.00 | $638.00 | $1,354.00 | 8 |

Las diferencias son determinantes:

- `cashSales` coincide exactamente con los Payments en efectivo, incluido
  Payment 1455 por `$115.00`;
- `cardSales` supera a los Payments de tarjeta por exactamente `$378.00`, el
  total final de Order 1540;
- la caja tiene una transacción más que las siete Orders/Payments;
- caja totaliza `$1,354.00`, exactamente `$115.00` más que los totales finales
  de las siete Orders.

Esto equivale a dos impactos de Order 1540 sobre caja: efectivo `$115.00` y
tarjeta `$378.00`, con dos incrementos de `totalTransactions`. El cierre físico
también es consistente: `$170.00 + $716.00 - $0.00 = $886.00`; `cardSales` no
forma parte del efectivo esperado.

## Código histórico

El código disponible inmediatamente antes del incidente está representado por
el commit `ee36227` del 29/08/2026; no hay garantía documental de qué commit fue
desplegado, pero el mecanismo ya existía desde antes:

- `fae10fd` (04/07/2026), “Corregir reportes y duplicados de pago”, evitó crear
  otro Payment si ya existía, pero conservó la posibilidad de volver una Order
  a `pending` y volver a impactar caja si su estado previo ya no era
  `completed`;
- `701ad0f` (12/08/2026) contiene el flujo modular observado en la fecha del
  incidente;
- `cfa69c9` (27/08/2026) hizo atómico el impacto de caja, pero no eliminó esta
  inconsistencia lógica.

En ese flujo:

1. `updateStatus` aceptaba `status='pending'` con items sin verificar que la
   Order siguiera pendiente, por lo que podía reabrir una venta completada;
2. al completar, actualizaba Order e items al total nuevo;
3. `PaymentService.registerPayment` encontraba el Payment anterior y lo
   retornaba sin cambiar su importe o método;
4. el controlador no distinguía Payment creado de Payment reutilizado y
   ejecutaba `applySaleToOpenRegister(paymentMethod, effectiveTotal)` de todos
   modos.

El frontend enviaba `amountPaid` como efectivo recibido, pero PaymentService no
lo usaba como importe contable: persistía `order.total`. Por eso `$115.00` no es
evidencia de efectivo entregado para una Order de `$378.00`; demuestra que el
Payment fue creado cuando el total leído por el servicio era `$115.00`.

No se encontraron logs locales del incidente. No se consultaron ni descargaron
logs remotos.

## Reportes

En la implementación vigente alrededor del incidente, el reporte deduplicaba
Payments por Order y prefería `Order.total` sobre `Payment.amount`. Order 1540
habría contribuido `$378.00` a efectivo porque el método provenía de Payment
1455, aunque la caja también conservaba `$378.00` en tarjeta.

El commit `76f94c0` del 15/09/2026 invirtió esa prioridad. El código actual usa
primero `Payment.amount`; por ello Order 1540 aporta actualmente `$115.00` en
efectivo a los reportes basados en Payments y queda `$263.00` por debajo de su
total final.

Impacto global actual demostrado:

- 1631 Orders completadas suman `$239,826.00`;
- Payments de Orders completadas, sin deduplicar, suman `$239,943.00` debido
  también al caso independiente de Order 1023;
- el conjunto deduplicado por Order usado por reportes suma `$239,563.00`;
- la diferencia entre Orders completadas y reporte deduplicado es `$263.00`,
  atribuible íntegramente a Order 1540.

## Casos similares

Excluyendo Order 1023, existe exactamente una discrepancia global:

- Payment menor que Order.total: 1, Order 1540;
- Payment mayor que Order.total: 0.

Order 1023 continúa fuera de esta auditoría y no fue modificado.

## Hipótesis y evidencia

| Hipótesis | Evaluación |
| --- | --- |
| A. Pago parcial legítimo | Rechazada: no existe modelo de parcialidades/split y el código persistía `order.total`, no `amountPaid`. |
| B. Payment histórico incorrecto | Es un efecto observable, pero `$115.00` fue coherente con el primer estado que explica el código; no demuestra corrupción aislada. |
| C. Order modificada después del pago | Fuertemente respaldada por los importes y el flujo, pero no puede fecharse directamente porque no existe `updatedAt`. |
| D. Payment faltante | Rechazada como explicación principal: no hubo Payment complementario/huérfano y el código reutilizaba deliberadamente el existente. |
| E. Error histórico del POS | Confirmada: el código permite reapertura, reutiliza Payment y vuelve a incrementar caja; la aritmética coincide exactamente. |
| F. Otra causa demostrable | No identificada. |
| G. Inconcluso | No para la causa técnica; sí permanece inconcluso cuál fue el medio de pago real del negocio. |

## Clasificación y confianza

- Tipo: **E. ERROR HISTÓRICO DEL POS**.
- Confianza: **ALTA**.

La confianza se sustenta en cuatro coincidencias independientes: Payment
`$115.00`, incremento de efectivo `$115.00`, incremento adicional de tarjeta
`$378.00` y una transacción extra. Todas son producidas exactamente por el
camino de código histórico identificado.

La confianza no se extiende al medio de pago real. Sin ticket, comprobante de
terminal, arqueo detallado o logs del incidente, no puede decidirse si el cobro
económico correcto fue efectivo, tarjeta o una operación anulada/repetida.

## Impacto

- Payment 1455 está `$263.00` por debajo de Order 1540.
- El reporte actual basado en Payment queda `$263.00` por debajo del total de
  Orders completadas.
- CashRegister 150 contiene una transacción adicional y registra ambos impactos
  (`$115.00` efectivo y `$378.00` tarjeta).
- La suma global de Payments no debe ajustarse automáticamente en `+$263.00`:
  hacerlo sin corregir coordinadamente método, caja y transacciones produciría
  otra inconsistencia.

## Propuesta

Saneamiento histórico: **NO**.

No existe evidencia suficiente para elegir valores finales de Payment y
CashRegister sin conocer el medio de pago real. No se debe cambiar Payment 1455
de `$115.00` a `$378.00`, crear otro Payment ni ajustar CashRegister 150 por
suposición.

En una etapa futura separada se recomienda:

1. buscar evidencia externa autorizada del cobro (ticket o comprobante de
   terminal) y sólo entonces diseñar una corrección coordinada;
2. impedir transiciones de `completed` a `pending`;
3. hacer que el servicio indique si creó o reutilizó un Payment y no incrementar
   caja cuando lo reutilice;
4. relacionar Payment con CashRegister o mantener un ledger auditable;
5. conservar el futuro UNIQUE de `Payment.orderId` después del saneamiento
   independiente de Order 1023.

Ninguna de estas acciones se ejecutó en esta etapa.

## Seguridad

- INSERT ejecutados: **0**.
- UPDATE ejecutados: **0**.
- DELETE ejecutados: **0**.
- ALTER ejecutados: **0**.
- CREATE ejecutados: **0**.
- DROP ejecutados: **0**.
- Migraciones: **0**.
- Deploy: **NO**.
- Push: **NO**.
- Producción modificada: **NO**.

**ETAPA 16A.3 APROBADA — CAUSA DE ORDER 1540 DETERMINADA**
