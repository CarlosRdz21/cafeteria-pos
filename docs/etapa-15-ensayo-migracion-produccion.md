# Etapa 15 — Ensayo de migración con copia real de producción

## 1. Origen del dump

Respaldo productivo importado manualmente por el propietario en una base MySQL local. Codex no descargó ni reimportó el dump.

## 2. Nombre del clon

`cafeteria_pos_prod_clone`, en `localhost:3306`.

## 3. Tablas encontradas

Se encontraron 13 tablas: `cashregister`, `expense`, `order`, `orderitem`, `payment`, `printersetting`, `product`, `productcategory`, `productsupply`, `promotion`, `supplycategory`, `supplymovement` y `user`.

## 4. Línea base

La línea base externa coincidió exactamente. El detalle completo está en [etapa-15-produccion-pre-migracion.md](./etapa-15-produccion-pre-migracion.md).

## 5. Anomalías preexistentes

Se encontró un `orderId` con pagos múltiples: la orden `1023` contiene tres pagos en efectivo de `$190.00` cada uno, IDs `953`, `954` y `955`. Este hallazgo activa un bloqueo obligatorio.

## 6. Estado Prisma

El clon no contiene `_prisma_migrations`. En el repositorio se observaron preliminarmente las migraciones:

- `20260723135000_mysql_initial`
- `20260723153500_payment_order_unique`
- `20260827211000_expense_idempotency`

La auditoría detallada de compatibilidad no se continuó después del bloqueo.

## 7. Migraciones necesarias

No determinadas. Está prohibido aplicar `Payment.orderId UNIQUE` mientras exista el duplicado histórico.

## 8. Cambios aplicados

Ninguno sobre la base de datos.

## 9. Comparación antes/después

No existe estado posterior porque no se ejecutó ninguna migración.

## 10–18. Datos históricos

- Ventas/Pagos: 1526 pagos por `$221,755.00`.
- Gastos: 546 por `$125,756.40`.
- Cajas: 160; 159 cerradas y 1 abierta, preservada sin cambios.
- Usuarios: 2.
- Productos: 77.
- Promociones: 2.
- Inventario: `productsupply`, `supplycategory` y `supplymovement` contienen 0 registros.
- OrderItem: 3219 registros y 0 huérfanos detectados.

## 19. Reportes

No ejecutado debido al bloqueo previo a migración.

## 20. Prueba de aplicación

No ejecutada contra el clon.

## 21. Pruebas transaccionales

No se creó `cafeteria_pos_prod_clone_transaction_test` y no se ejecutaron operaciones de escritura.

## 22. Riesgos

1. Crear el índice `UNIQUE` actual fallaría o exigiría alterar datos históricos.
2. El usuario local dedicado posee `ALL PRIVILEGES` sobre el clon; para futuras auditorías debe reducirse a `SELECT`, `SHOW VIEW` y, si fuera necesario, `TRIGGER`/`EVENT` únicamente para exportación.
3. La diferencia entre `SUM(Payment.amount)` (`$221,755.00`) y el total de órdenes completadas (`$221,638.00`) debe analizarse después de resolver expresamente el bloqueo, sin modificar historia.
4. La ausencia de `_prisma_migrations` requiere una estrategia de baseline controlada; no debe usarse `db push`, `migrate reset` ni `migrate deploy` a ciegas.

## 23. Pasos necesarios antes de producción

1. Revisar la orden `1023` y sus tres pagos con el propietario.
2. Decidir explícitamente qué interpretación contable debe conservarse.
3. Autorizar por escrito cualquier corrección histórica, si corresponde.
4. Repetir esta etapa desde una copia restaurada y verificar nuevamente la línea base.
5. Reducir los privilegios del usuario de auditoría o mantener una defensa equivalente de sesión `READ ONLY`.

## 24. Rollback propuesto

No fue necesario rollback porque no se aplicaron cambios. Para un ensayo posterior debe crearse y validarse `cafeteria_pos_prod_clone_pre_migration.sql` antes de cualquier ALTER.

## Resultado de la etapa

| Elemento | Resultado |
|---|---|
| Dump real validado | PASS |
| Clon local creado | PASS (creado previamente por el propietario) |
| Backup del clon | NO EJECUTADO |
| Datos históricos íntegros | FAIL — pagos múltiples detectados |
| Migraciones | NO EJECUTADO |
| Pedidos | PASS en línea base |
| Pagos | FAIL — orden 1023 con 3 pagos |
| Gastos | PASS en línea base |
| Cajas | PASS en línea base; caja abierta preservada |
| Productos | PASS en línea base |
| Usuarios | PASS en línea base |
| Promociones | PASS en línea base |
| Inventario | PASS en conteo previo; migración no evaluada |
| Reportes | NO EJECUTADO |
| Reconciliación antes/después | NO EJECUTADO |
| Nueva app con datos reales | NO EJECUTADO |
| Pruebas transaccionales aisladas | NO EJECUTADO |
| Producción intacta | PASS |

## Veredicto

**ENSAYO BLOQUEADO — NO MIGRAR PRODUCCIÓN**

---

## Anexo forense read-only — Order 1023

Fecha de auditoría: 2026-09-14. Todas las consultas se ejecutaron contra `localhost:3306/cafeteria_pos_prod_clone` dentro de transacciones `READ ONLY` finalizadas con `ROLLBACK`. No se utilizó `root` ni se accedió a otra base o servicio.

### Esquema real aplicable

`Order` no contiene `updatedAt` ni `cashRegisterId`. Sus campos reales son `id`, `status`, `subtotal`, `tax`, `total`, `tableNumber`, `customerName`, `notes`, `createdAt`, `paymentMethod`, `amountPaid`, `change`, `appliedPromotions` y `discountTotal`.

`Payment` no contiene `cashRegisterId` ni `status`. Sus campos reales son `id`, `orderId`, `method`, `amount`, `provider`, `reference`, `metadata` y `paidAt`.

No existen triggers sobre `order`, `orderitem`, `payment` o `cashregister`.

### Order 1023

| Campo | Valor |
|---|---|
| id | 1023 |
| status | completed |
| subtotal | $190.00 |
| tax | $0.00 |
| total | $190.00 |
| discountTotal | $0.00 |
| paymentMethod | NULL |
| amountPaid | NULL |
| change | NULL |
| appliedPromotions | `[]` |
| createdAt | 2026-07-02 15:37:20.542 |
| tableNumber | cadena vacía |
| customerName | Para llevar |
| notes | NULL |

### OrderItems y recálculo

| OrderItem.id | Product.id | Producto | Cantidad | Precio unitario | Subtotal |
|---:|---:|---|---:|---:|---:|
| 4182 | 14 | Mocca - Caliente 16 oz - Leche Entera - Extra Canela | 2 | $95.00 | $190.00 |

- `SUM(price × quantity)`: `$190.00`.
- `SUM(OrderItem.subtotal)`: `$190.00`.
- `Order.total`: `$190.00`.
- Diferencia: `$0.00`.

El pedido requería un único pago por el total completo de `$190.00`.

### Payments 953, 954 y 955

| ID | orderId | method | amount | provider | reference | metadata | paidAt |
|---:|---:|---|---:|---|---|---|---|
| 953 | 1023 | cash | $190.00 | NULL | NULL | `null` | 2026-07-02 15:40:47.551 |
| 954 | 1023 | cash | $190.00 | NULL | NULL | `null` | 2026-07-02 15:40:48.679 |
| 955 | 1023 | cash | $190.00 | NULL | NULL | `null` | 2026-07-02 15:41:09.492 |

Los tres registros son idénticos en todos los datos de negocio y solo cambian en `id` y `paidAt`. Cada uno equivale al 100% del pedido; no hay referencia, proveedor, metadata, estado o identificador externo que sustente pagos parciales o transacciones independientes.

- Total real de Order 1023: `$190.00`.
- Total de Payments asociados: `$570.00`.
- Exceso de Payments sobre Order.total: **`$380.00`**.
- Separación 953 → 954: `1.128 segundos`.
- Separación 954 → 955: `20.813 segundos`.

### Caja relacionada y reconciliación

Como no existe una clave foránea hacia caja, se reconstruyó la relación por la ventana temporal de `paidAt`. Los tres Payments coinciden con una sola caja: `CashRegister 96`.

| Campo | Valor |
|---|---:|
| id | 96 |
| openingAmount | $170.00 |
| cashSales | $1,148.00 |
| cardSales | $160.00 |
| expenses | $0.00 |
| expectedAmount | $1,318.00 |
| closingAmount | $1,345.00 |
| difference | $27.00 |
| totalTransactions | 12 |
| status | closed |
| openedAt | 2026-07-02 14:21:40.183 |
| closedAt | 2026-07-03 03:14:17.768 |

Reconciliación de la ventana de caja:

| Métrica | Valor |
|---|---:|
| Filas Payment | 14 |
| orderId distintos pagados | 12 |
| SUM de filas Payment cash | $1,528.00 |
| SUM de Order.total cash por orderId único | $1,148.00 |
| CashRegister.cashSales persistido | $1,148.00 |
| SUM de filas Payment card | $160.00 |
| CashRegister.cardSales persistido | $160.00 |
| CashRegister.totalTransactions | 12 |

`cashSales` coincide exactamente con las órdenes únicas, no con las tres filas de Order 1023. `totalTransactions` coincide con las 12 órdenes distintas y no con las 14 filas Payment. Por tanto, Order 1023 impactó caja y contador **una sola vez**; Payments 954 y 955 no incrementaron esos acumulados.

### Impacto en reportes

- El endpoint backend `/api/payments/reports` obtiene filas de `Payment` por `paidAt` y devolvería los tres registros.
- La interfaz actual deduplica por `order.id`, conserva el Payment más antiguo y utiliza preferentemente `Order.total`; actualmente Order 1023 aporta **$190.00** a ventas, efectivo y gráficas.
- La pantalla e impresión de caja utilizan `CashRegister.cashSales`, `cardSales` y `totalTransactions`; allí la orden está contabilizada una sola vez.
- Antes del commit correctivo del 4 de julio de 2026, Reportes no deduplicaba las filas recibidas. Aunque tomaba `Order.total`, procesaba cada Payment; para el periodo del incidente habría sumado **$570.00** y repetido la orden en estadísticas derivadas.
- Una consulta contable que sume directamente `Payment.amount` también cuenta `$570.00`.

### Evidencia del origen probable

El incidente ocurrió el 2 de julio de 2026. El commit `fae10fd`, fechado el 4 de julio, se titula **“Corregir reportes y duplicados de pago”** y añadió tres defensas que no existían cuando se generaron estos registros:

1. `completePayment()` empezó a rechazar nuevas invocaciones cuando `processing` ya era verdadero.
2. `PaymentService.registerPayment()` empezó a buscar un Payment existente por `orderId` antes de insertar.
3. Reportes empezó a deduplicar Payments por Order.

En la versión anterior, el servicio insertaba incondicionalmente un Payment. El controlador registraba Payment incluso si la orden ya estaba completada, mientras que solo incrementaba caja cuando el estado leído inicialmente todavía no era `completed`. Ese comportamiento explica exactamente el patrón persistido: tres Payments, pero un solo incremento de `cashSales` y `totalTransactions`.

La interfaz ya mostraba el botón deshabilitado durante `processing`, pero el método no tenía una guarda reentrante, el backend no tenía idempotencia y la base no tenía `UNIQUE(orderId)`. Por ello seguían siendo posibles invocaciones casi simultáneas, reenvíos o un reintento posterior. Las marcas de tiempo son compatibles con dos solicitudes muy próximas y otra 20.813 segundos después. No hay evidencia suficiente para atribuir el evento exclusivamente a doble clic, pero sí para concluir que la ruta aceptó reenvíos no idempotentes.

### Búsqueda global

| orderId | cantidadPayments | totalOrder | totalPayments | diferencia | primerPayment | últimoPayment |
|---:|---:|---:|---:|---:|---|---|
| 1023 | 3 | $190.00 | $570.00 | $380.00 | 2026-07-02 15:40:47.551 | 2026-07-02 15:41:09.492 |

Order 1023 es el único pedido con más de un Payment en todo el clon.

### Clasificación

**A. DUPLICACIÓN CONFIRMADA**

La clasificación se sustenta en: total e items consistentes por `$190.00`; tres cobros por el total completo; Payments sin identificadores diferenciadores; caja y transacciones contabilizadas una sola vez; código histórico no idempotente; y commit correctivo inmediatamente posterior al incidente.

### Plan hipotético de saneamiento — no autorizado ni ejecutado

1. Conservar `Payment 953`, por ser la primera fila registrada y la que representa el único pago esperado.
2. Considerar `Payment 954` y `Payment 955` candidatos a eliminación, por ser posteriores e idénticos al pago completo original.
3. No modificar Order 1023, sus OrderItems ni CashRegister 96.
4. No ajustar `cashSales` ni `totalTransactions`, porque ya reflejan una sola venta.
5. Después de un saneamiento autorizado, volver a conciliar todos los conteos y totales antes de crear `UNIQUE Payment.orderId`.

Línea base hipotética después de eliminar exclusivamente 954 y 955:

| Métrica | Antes | Hipotético después | Diferencia |
|---|---:|---:|---:|
| Order | 1602 | 1602 | 0 |
| OrderItem | 3219 | 3219 | 0 |
| Payment | 1526 | 1524 | -2 |
| SUM(Payment.amount) | $221,755.00 | $221,375.00 | -$380.00 |
| Expense | 546 | 546 | 0 |
| SUM(Expense.amount) | $125,756.40 | $125,756.40 | $0.00 |
| CashRegister | 160 | 160 | 0 |
| CashRegister.cashSales de caja 96 | $1,148.00 | $1,148.00 | $0.00 |
| CashRegister.totalTransactions de caja 96 | 12 | 12 | 0 |

El reporte actual no cambiaría para Order 1023 porque ya conserva un solo Payment y usa `Order.total`. Los reportes o consultas que suman directamente `Payment.amount` disminuirían `$380.00`. La futura restricción `UNIQUE Payment.orderId` dejaría de estar bloqueada por pagos múltiples, aunque todavía requeriría la auditoría de migración completa.

### Verificación final de no alteración

| Métrica | Valor final verificado |
|---|---:|
| Order | 1602 |
| OrderItem | 3219 |
| Payment | 1526 |
| SUM(Payment.amount) | $221,755.00 |
| Expense | 546 |
| SUM(Expense.amount) | $125,756.40 |
| CashRegister | 160 |
| CashRegister abiertas | 1 |
| Product | 77 |
| User | 2 |
| Promotion | 2 |

La línea base permaneció idéntica. No se ejecutó ninguna modificación ni se reanudó la migración.

---

## Saneamiento histórico Payment Order 1023

Fecha de ejecución: 2026-09-14.
Destino exclusivo: `localhost:3306/cafeteria_pos_prod_clone`.
Autorización: eliminar únicamente Payment `954` y `955`, conservando Payment `953`.

No se utilizó `root`, `cafeteria_pos_test`, Hostinger, Render, producción ni Mercado Pago. No se ejecutó Prisma ni se creó todavía `UNIQUE Payment.orderId`.

### Evidencia previa revalidada

| Verificación | Resultado previo |
|---|---:|
| Order 1023 existente | Sí |
| Order 1023 total | $190.00 |
| Payment 953 | $190.00 cash |
| Payment 954 | $190.00 cash |
| Payment 955 | $190.00 cash |
| Caja relacionada | CashRegister 96 |
| Grupos con Payments múltiples | 1: únicamente Order 1023 |
| Payment COUNT | 1526 |
| SUM(Payment.amount) | $221,755.00 |

### Backup utilizado

- Archivo: `backups/cafeteria_pos_prod_clone_pre_payment_cleanup.sql`
- Tamaño: `10,323,108 bytes`
- SHA-256: `A48EBF8EC5D13C1BC2626D246CDDD5B5A56A4DB22C7998C0A55B9951EF3A6DCD`
- Validación: contiene estructura y datos de `payment`, `order` y `cashregister`.
- El dump original de Hostinger no fue localizado, abierto ni modificado.

### Transacción controlada

1. Se inició una transacción MySQL con `autocommit=0`.
2. Se bloquearon con `SELECT ... FOR UPDATE` Order `1023`, Payments `953`, `954`, `955` y CashRegister `96`.
3. Se ejecutó un único `DELETE` limitado por ID, `orderId=1023`, `method='cash'` y `amount=190`.
4. `ROW_COUNT()` confirmó exactamente `2` filas eliminadas.
5. Antes del commit se revalidaron todas las entidades y métricas; `ALL_CHECKS_PASS=1`.
6. Al no existir diferencias inesperadas, se ejecutó `COMMIT`.
7. Una sesión posterior independiente, en transacción `READ ONLY`, confirmó `ALL_POST_CHECKS_PASS=1` y terminó con `ROLLBACK` de lectura.

### Registros afectados

| Payment | Acción | Resultado |
|---:|---|---|
| 953 | Conservar | Existe, Order 1023, cash, $190.00 |
| 954 | Eliminar | Eliminado |
| 955 | Eliminar | Eliminado |

No se modificaron Order `1023`, sus OrderItems, CashRegister `96`, Expense, User, Product ni Promotion.

### Métricas antes y después

| Métrica | Antes | Después | Diferencia |
|---|---:|---:|---:|
| Order | 1602 | 1602 | 0 |
| OrderItem | 3219 | 3219 | 0 |
| Payment | 1526 | 1524 | -2 |
| SUM(Payment.amount) | $221,755.00 | $221,375.00 | -$380.00 |
| Expense | 546 | 546 | 0 |
| SUM(Expense.amount) | $125,756.40 | $125,756.40 | $0.00 |
| CashRegister | 160 | 160 | 0 |
| CashRegister abiertas | 1 | 1 | 0 |
| Product | 77 | 77 | 0 |
| User | 2 | 2 | 0 |
| Promotion | 2 | 2 | 0 |

### CashRegister 96 antes y después

| Campo | Antes | Después |
|---|---:|---:|
| openingAmount | $170.00 | $170.00 |
| cashSales | $1,148.00 | $1,148.00 |
| cardSales | $160.00 | $160.00 |
| expenses | $0.00 | $0.00 |
| expectedAmount | $1,318.00 | $1,318.00 |
| closingAmount | $1,345.00 | $1,345.00 |
| difference | $27.00 | $27.00 |
| totalTransactions | 12 | 12 |

También permanecieron idénticos `openedAt`, `closedAt`, `status` y `userRef`.

### Auditoría global posterior

La consulta `Payment GROUP BY orderId HAVING COUNT(*) > 1` devolvió **0 órdenes**. Order `1023` conserva exclusivamente Payment `953` por `$190.00`.

### Resultado del saneamiento

El saneamiento autorizado se completó y confirmó mediante `COMMIT`. La corrección quedó limitada a Payment `954` y `955`; no hubo ajustes colaterales. La migración continúa detenida y la restricción `UNIQUE Payment.orderId` todavía no fue creada.

**SANEAMIENTO DEL CLON APROBADO**

---

## Estrategia controlada de migración sobre el clon saneado

Fecha de reanudación: 2026-09-14.

### Respaldo previo a migración

- Archivo: `backups/cafeteria_pos_prod_clone_pre_migration.sql`
- Tamaño: `10,322,978 bytes`
- SHA-256: `8A7BA6E141A5CAF9A9BDB561FFB4432E550DCEA167F4A07508347BAA3D2C6325`
- Restauración de prueba: completada exclusivamente en `cafeteria_pos_prod_clone_restore_verify`.
- Comparación contra el clon saneado: idéntica en conteos, totales, duplicados, Order 1023, Payment 953, CashRegister 96 y la caja abierta 160.

### Alcance autorizado del ensayo

La base física histórica no contiene `_prisma_migrations`, aunque ya posee materialmente el esquema inicial. Por ello, el ensayo usará la migración `20260723135000_mysql_initial` únicamente como línea base registrada y después desplegará las dos migraciones incrementales revisadas:

1. `20260723153500_payment_order_unique`: crear `Payment_orderId_key` y retirar el índice no único `Payment_orderId_idx`.
2. `20260827211000_expense_idempotency`: agregar `Expense.idempotencyKey` nullable y su índice único.

El procedimiento se ensayará primero en `cafeteria_pos_prod_clone_restore_verify`. Sólo si conserva íntegramente los datos y el historial de caja podrá repetirse sobre `cafeteria_pos_prod_clone`.

### Deriva deliberadamente no aplicada

`prisma migrate diff` también propone convertir campos históricos `LONGTEXT` a `JSON` y reconstruir llaves foráneas de Product/ProductSupply. Todos los valores no nulos auditados son JSON válido, pero esas transformaciones no forman parte de las dos migraciones revisadas y ampliarían innecesariamente el riesgo. No se aplicará el diff general, no se convertirán dichas columnas y no se reconstruirán esas llaves.

No se usará `prisma db push`, `prisma migrate reset`, seeds, fixtures ni limpieza de datos. Las escrituras de negocio siguen prohibidas durante esta fase.

### Resultado del ensayo en la restauración

El ensayo en `cafeteria_pos_prod_clone_restore_verify` fue satisfactorio:

- `20260723135000_mysql_initial` quedó registrada como línea base.
- `20260723153500_payment_order_unique` y `20260827211000_expense_idempotency` se aplicaron correctamente.
- Prisma informó `Database schema is up to date!`.
- La huella conjunta de las 13 tablas de negocio, comparando únicamente las columnas históricas comunes, fue idéntica antes y después: `AC13CAA2EA0BA4EB176CDF45C32E26CD792267BD65DDF15C4F0FEEF292AD9A5F`.
- Payment conservó 1,524 filas y suma de $221,375.00; Expense conservó 546 filas y suma de $125,756.40.
- Se mantuvieron 0 órdenes con Payments duplicados.
- Order 1023 conservó únicamente Payment 953.
- CashRegister 96 y la caja abierta 160 permanecieron sin cambios.
- El índice anterior `Payment_orderId_idx` fue sustituido por el índice único `Payment_orderId_key`.
- `Expense.idempotencyKey` quedó como `VARCHAR(191) NULL` con índice único `Expense_idempotencyKey_key`.

El diff posterior sólo conserva la deriva excluida y documentada: tipos `LONGTEXT` frente a `JSON` y el ruido de llaves foráneas Product/ProductSupply causado por el tratamiento de mayúsculas/minúsculas del servidor MySQL local. No se ejecutará ese diff.

---

## Reanudación del ensayo sobre el clon limpio

Esta sección reemplaza el estado preliminar “bloqueado” de las secciones 6–24 para reflejar la reanudación posterior al saneamiento expresamente autorizado.

### Migración aplicada al clon principal

Después del ensayo satisfactorio en la restauración, se repitió exactamente la estrategia sobre `localhost:3306/cafeteria_pos_prod_clone`:

1. Registro de `20260723135000_mysql_initial` como línea base, sin ejecutar su DDL inicial.
2. Aplicación de `20260723153500_payment_order_unique`.
3. Aplicación de `20260827211000_expense_idempotency`.

Prisma registra las tres migraciones como terminadas y sin rollback. `migrate status` se validó previamente en la restauración como `Database schema is up to date!`.

### Reconciliación antes/después

| Métrica | Antes saneado | Después | Diferencia |
|---|---:|---:|---:|
| Order | 1602 | 1602 | 0 |
| OrderItem | 3219 | 3219 | 0 |
| Payment | 1524 | 1524 | 0 |
| SUM(Payment.amount) | $221,375.00 | $221,375.00 | $0.00 |
| Expense | 546 | 546 | 0 |
| SUM(Expense.amount) | $125,756.40 | $125,756.40 | $0.00 |
| CashRegister | 160 | 160 | 0 |
| CashRegister abiertas | 1 | 1 | 0 |
| Product | 77 | 77 | 0 |
| User | 2 | 2 | 0 |
| Promotion | 2 | 2 | 0 |
| Payment duplicados por orderId | 0 | 0 | 0 |

La comparación exacta de las columnas históricas de las 13 tablas de negocio produjo la misma huella conjunta antes y después: `AC13CAA2EA0BA4EB176CDF45C32E26CD792267BD65DDF15C4F0FEEF292AD9A5F`. Esto cubre IDs, fechas, usuarios, hashes de contraseña, productos, precios, imágenes, promociones, órdenes, artículos, pagos, gastos, cajas e inventario.

Se creó además el snapshot post-migración `backups/cafeteria_pos_prod_clone_post_migration.sql`, de `10,327,573 bytes`, SHA-256 `54EF6CC1613E5C0CEF5A9EDA1200CDD676B292CE7B0C3E36F1673FB0E16AC7B8`. Contiene las tablas de negocio, `_prisma_migrations` y el marcador de finalización del dump. Este archivo será la fuente exclusiva de la futura copia transaccional.

CashRegister 96 permaneció en `$1,148.00` de efectivo, `$160.00` de tarjeta, 12 transacciones y estado cerrado. CashRegister 160 permaneció abierta con apertura `$118.00`, efectivo `$620.00`, tarjeta `$264.00`, gastos `$0.00`, 6 transacciones y `openedAt=2026-09-14 14:15:13.311`. El nombre real de `userRef` se omitió de esta documentación.

Los 546 gastos históricos conservan `idempotencyKey=NULL`; no se generaron claves retroactivas.

### Validación de lectura con la nueva aplicación

Se añadió un inicio local específico, `npm run dev:prod-clone:readonly`, que exige host local, puerto 3306, base `cafeteria_pos_prod_clone`, usuario distinto de `root`, elimina credenciales de Mercado Pago y activa `CLONE_READ_ONLY=true`. El backend rechaza POST/PUT/PATCH/DELETE con HTTP 403, salvo login; AuthService evita incluso la migración de hashes legacy bajo esa bandera. La configuración normal y producción no activan esta guarda.

El backend protegido se levantó en `localhost:3100` para no interferir con el servidor local del propietario. Se usó un JWT local efímero asociado a un usuario real con rol admin, únicamente para endpoints GET. El identificador y el nombre se omitieron; no se conoció ni modificó ninguna contraseña.

| Endpoint/dato | Resultado |
|---|---:|
| Health | PASS |
| Products | 77 |
| ProductCategory | 16 |
| Orders completed/pending/cancelled | 1524 / 0 / 78 |
| Expenses | 546 |
| Users | 2 |
| ProductSupply / SupplyCategory / SupplyMovement | 0 / 0 / 0 |
| Promotions | 2 |
| PrinterSetting | 1 |
| Payments históricos | 1524 / $221,375.00 |
| Guarda de escritura | PASS, POST rechazado con 403 |

El login real no se marcó como probado porque sólo existen hashes bcrypt y no se conoce una credencial en texto plano. No se reemplazó ni modificó contraseña alguna.

### Reconciliación de Reportes

Las respuestas GET de Payments y Expenses se compararon con SQL directo usando los mismos límites temporales:

| Periodo | Órdenes | Ventas | Efectivo | Tarjeta | Gastos | Resultado |
|---|---:|---:|---:|---:|---:|---|
| Hoy | 6 | $884.00 | $620.00 | $264.00 | $120.00 | PASS |
| Esta semana | 6 | $884.00 | $620.00 | $264.00 | $120.00 | PASS |
| Este mes | 102 | $15,335.00 | $11,281.00 | $4,054.00 | $5,574.50 | PASS |
| Personalizado, julio 2026 | 272 | $42,358.00 | $30,945.00 | $11,413.00 | $27,585.53 | PASS |

### Compatibilidad histórica de Payment 1455 / Order 1540

Se detectó una anomalía histórica adicional, no causada por la migración: Payment 1455 registra `$115.00` y Order 1540 totaliza `$378.00`. Sus tres OrderItems suman `$378.00`, pero CashRegister 150 contabiliza los pagos recibidos: `$716.00` de efectivo. La suma de `Payment.amount` de esa caja también es `$716.00`; sumar `Order.total` produciría `$979.00`.

No se modificó la base. Se corrigió únicamente la compatibilidad del reporte para usar primero `Payment.amount`, que representa el importe cobrado y concilia con caja, dejando `Order.total` como fallback cuando el pago no tenga un importe válido. La prueba ChromeHeadless focalizada pasó 9/9.

### Muestras de órdenes históricas

| Tipo | Order | Total | Items | Payment/método | Resultado |
|---|---:|---:|---:|---|---|
| Antigua | 27 | $160.00 | 2 | 18 / card | PASS |
| Intermedia | 845 | $389.00 | 6 | 780 / cash | PASS |
| Reciente | 1628 | $45.00 | 1 | 1543 / cash | PASS |
| Efectivo | 32 | $65.00 | 1 | 21 / cash | PASS |
| Tarjeta | 27 | $160.00 | 2 | 18 / card | PASS |
| Con promoción | 82 | $130.00 | 2 | 59 / cash | PASS |
| Sin promoción | 27 | $160.00 | 2 | 18 / card | PASS |

Cada muestra coincidió entre API y SQL en ID, estado, total, descuento, cantidad/suma de items y pago.

### Cajas históricas

Las 159 cajas cerradas cumplen:

- `expectedAmount = openingAmount + cashSales - expenses`.
- `difference = closingAmount - expectedAmount`.

Se recalcularon además las cajas 1, 80 y 159 como muestras antigua, intermedia y reciente; todas tuvieron diferencia calculada cero respecto de los valores persistidos. No se corrigió ningún dato.

### Validación técnica acumulada

- Frontend TypeScript: PASS.
- Frontend lint: PASS con 96 advertencias existentes y 0 errores.
- Frontend build posterior al ajuste de Payment 1455: PASS, con advertencia de presupuesto SCSS de Reportes.
- Prueba focalizada de Reportes en ChromeHeadless: 9/9 PASS.
- Backend TypeScript: PASS.
- Backend unit tests: 224/224 PASS; las pruebas focalizadas de entorno y autenticación suman 13/13 PASS e incluyen la guarda de hash del clon.
- Backend lint: PASS con 215 advertencias existentes y 0 errores.
- Prisma validate: PASS.
- Prisma generate/build: pendiente de repetir; una DLL quedó bloqueada por el backend local del propietario iniciado antes de la auditoría. No se cerró ese proceso sin autorización.

## Cierre de la copia transaccional

El usuario dedicado obtuvo acceso únicamente a `cafeteria_pos_prod_clone_transaction_test`, restaurada desde `backups/cafeteria_pos_prod_clone_post_migration.sql`. La configuración exige MySQL `localhost:3306`, usuario distinto de `root`, la base exacta y las dos guardas destructivas explícitas. El clon histórico sigue rechazado incluso al activar el modo transaccional.

### Hallazgo y corrección del aislamiento de caja

La primera ejecución obtuvo 62/63 pruebas satisfactorias. Después de cerrar una caja temporal, solicitudes rezagadas encontraron la caja histórica abierta 160 y la cerraron dentro de la copia transaccional. No se afectó el clon histórico.

La caja 160 de la copia se restauró exactamente desde la fila intacta del clon histórico, dentro de una transacción y con precondiciones de base, usuario, estado y ausencia de remanentes. El ejecutor quedó reforzado para verificar que no existan filas `TEST_`, aislar temporalmente la caja 160 sólo en la copia transaccional, ejecutar Vitest de manera serial y restaurar siempre todos sus campos mediante `finally`.

| Componente | Resultado |
|---|---:|
| Archivos de integración | 8/8 PASS |
| Pruebas de integración | 63/63 PASS |
| Payment idempotency | PASS |
| Cierre concurrente | PASS |
| Pago vs cierre | PASS |
| Expense idempotency | PASS |
| Expense vs cierre | PASS |
| Expense vs pago | PASS |
| Inventario transaccional | PASS |

Después de la limpieza automática hay cero cajas y órdenes de prueba, cero órdenes con Payments duplicados y CashRegister 160 está abierta e idéntica al clon histórico. Las 13 tablas de negocio coinciden fila por fila entre ambas bases, con la huella lógica `51FC9AB9E62B73095B2C08694F5E7EDBA051FCE04DA74B059639A13A8B9B6236` en origen y destino.

La copia conserva 1,602 órdenes, 3,219 OrderItems, 1,524 Payments por `$221,375.00`, 546 Expenses por `$125,756.40`, 160 cajas y una caja abierta. Los valores `AUTO_INCREMENT` de la copia de pruebas pueden avanzar por operaciones temporales; no forman parte de los datos históricos y no afectan el clon principal.

## Validación técnica final

| Validación | Resultado |
|---|---|
| Frontend TypeScript | PASS |
| Frontend lint | PASS, 0 errores y 96 advertencias existentes |
| Frontend build | PASS; advertencia de presupuesto SCSS en Reportes |
| Reportes ChromeHeadless focalizado | 9/9 PASS |
| Suite Angular ChromeHeadless completa | NO EJECUTADA: Chrome no inició por fallo ambiental de GPU/cache en Windows |
| Backend TypeScript y tipos de tests | PASS |
| Backend unit tests | 226/226 PASS |
| Backend integration MySQL aislada | 63/63 PASS |
| Backend lint | PASS, 0 errores y 215 advertencias existentes |
| Prisma validate | PASS |
| Prisma generate 6.19.3 | PASS |
| Backend build | PASS |

El fallo ambiental de ChromeHeadless se documenta sin presentarlo como PASS y, conforme a la regla 52, no bloquea el ensayo de datos. La compatibilidad con datos reales quedó comprobada mediante API GET protegida, SQL directo, reconciliación de Reportes, muestras históricas y compilación Angular. La revisión visual manual completa deberá repetirse antes de un despliegue real.

## Riesgos residuales

1. La anomalía histórica Payment 1455 / Order 1540 permanece sin modificar; el frontend ya usa `Payment.amount` para conciliar con caja.
2. La deriva `LONGTEXT`/`JSON` y las llaves Product/ProductSupply quedaron deliberadamente fuera de esta migración.
3. El login con contraseña real y la revisión visual manual completa siguen siendo controles previos al despliegue; no justifican alterar hashes o datos.
4. Producción puede haber cambiado desde este snapshot, por lo que el procedimiento futuro debe partir de un respaldo nuevo.

## Pasos propuestos para una migración real futura

1. Programar mantenimiento y detener escrituras productivas.
2. Crear y verificar un respaldo productivo nuevo.
3. Recalcular línea base, huérfanos y Payments duplicados; detenerse ante diferencias.
4. Ensayar el respaldo nuevo en otra copia local.
5. Registrar la migración inicial como baseline sólo si conserva la misma precondición.
6. Aplicar únicamente `payment_order_unique` y `expense_idempotency` de forma controlada.
7. Reconciliar conteos, sumas, IDs, fechas, caja abierta y reportes.
8. Realizar login real y revisión visual manual en preparación.
9. Desplegar sólo con autorización independiente; esta etapa no lo autoriza.

## Rollback propuesto

Ante una anomalía futura: detener la aplicación nueva, impedir nuevas escrituras, conservar evidencias y restaurar el respaldo completo previo a migración. No revertir parcialmente datos financieros. Reactivar la versión anterior sólo después de reconciliar conteos, sumas y caja abierta. Los dumps de esta etapa son evidencia del ensayo y no sustituyen un respaldo fresco.

## Resultado final de la Etapa 15

| Elemento | Resultado |
|---|---|
| Dump real validado | PASS |
| Clon local creado | PASS |
| Backup del clon | PASS |
| Datos históricos íntegros | PASS |
| Migraciones | PASS |
| Pedidos | PASS |
| Pagos | PASS |
| Gastos | PASS |
| Cajas | PASS |
| Productos | PASS |
| Usuarios | PASS |
| Promociones | PASS |
| Inventario | PASS |
| Reportes | PASS |
| Reconciliación antes/después | PASS |
| Nueva app con datos reales | PASS |
| Pruebas transaccionales aisladas | PASS |
| Producción intacta | PASS |

**ENSAYO APROBADO PARA PREPARAR MIGRACIÓN PRODUCTIVA**

Esta aprobación permite preparar un procedimiento posterior; no autoriza migrar, desplegar ni modificar producción. Producción, Hostinger, Render, Mercado Pago y `cafeteria_pos_test` permanecieron fuera del alcance.
