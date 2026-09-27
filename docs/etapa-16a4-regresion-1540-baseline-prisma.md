# Etapa 16A.4 — regresión 1540 y baseline Prisma

Fecha de ejecución local: 2026-09-27. Esta etapa no conectó con producción,
Hostinger, Render ni Mercado Pago. Todas las escrituras se limitaron a
`cafeteria_pos_test` y al clon desechable
`cafeteria_pos_prod_clone_transaction_test` en `localhost:3306`, usando un
usuario local no `root`.

## 1. Objetivo

Demostrar que una orden pagada ya no puede volver al flujo normal de edición y
cobro, y validar cómo incorporar Prisma Migrate a una base MySQL histórica sin
`_prisma_migrations`, sin recrear tablas ni alterar información histórica.

## 2. Evidencia de Order 1540

- Order 1540: `completed`, total `$378.00`, tres items que suman `$378.00`.
- Payment 1455: Order 1540, `$115.00`, `cash`.
- CashRegister 150: `closed`, `cashSales = 716.00`, `cardSales = 638.00` y
  `totalTransactions = 8`.
- Sólo existe un Payment persistido para Order 1540.

## 3. Confirmación de cobros reales

La confirmación externa del negocio establece dos cobros reales sobre la misma
orden: primero `$115.00` en efectivo y después `$378.00` con tarjeta. El total
físicamente cobrado entre ambos eventos fue `$493.00`, pero el total final de la
Order permanece correctamente en `$378.00`. El segundo cobro aparece en caja y
no como un segundo Payment.

## 4. Comportamiento histórico

El flujo antiguo permitía `completed -> pending`, editar la orden y volver a
completarla. En la segunda finalización reutilizaba el Payment anterior sin
actualizar importe o método, mientras incrementaba de nuevo la caja y el número
de transacciones. Ésta es la causa de la discrepancia 1540/1455.

## 5. Comportamiento actual y transiciones

La ruta activa es `backend/src/modules/orders/order.routes.ts`, montada en
`/api/orders`. Está protegida para `admin`, `barista`, `mesero` y `waiter`.

| Origen | Destino | Resultado actual |
| --- | --- | --- |
| `pending` | `completed` | Permitido; Payment, Order y CashRegister se actualizan en una transacción |
| `pending` | `cancelled` | Permitido mediante cancelación explícita y reclamo condicional |
| `pending` | edición `pending` | Permitido dentro de transacción y sólo mientras siga pendiente |
| `completed` | `completed` | Reintento idempotente; devuelve la orden sin nuevo impacto financiero ni Socket.IO |
| `completed` | `pending` u otro estado | `409 Conflict` |
| `cancelled` | `completed` | `409 Conflict` |
| `completed` o `cancelled` | cancelación | `409 Conflict` |

No se encontró un flujo de refund. Una devolución futura debe ser una operación
explícita, autorizada y auditable; nunca debe reutilizar
`completed -> pending -> completed`. El árbol legado
`backend/src/controllers` no está montado por `backend/src/app.ts`; conservar
esa duplicación es deuda técnica y no constituye una ruta secundaria activa.

## 6. Prueba de regresión

`backend/tests/integration/order-reopen-regression.mysql.spec.ts` crea una orden
local de `$115.00`, la cobra en efectivo y lanza intentos concurrentes de
reapertura/modificación a `$378.00` y de finalización repetida con tarjeta.
Verifica:

- cinco reaperturas rechazadas con `409`;
- Order final `completed`, total `$115.00` y sin modificación parcial;
- un único Payment `$115.00 cash`;
- CashRegister con un solo incremento de `$115.00`, `cardSales = 0` y una sola
  transacción;
- cero eventos Socket.IO de éxito después de los rechazos/reintentos.

El comentario dentro de la prueba documenta el patrón histórico protegido sin
incluir datos personales.

## 7. Cambios de código

En el controlador activo:

1. una Order `completed` no puede cambiar de estado;
2. sólo `pending` puede reclamar la transición a `completed`;
3. edición incremental y reemplazo de items reclaman atómicamente el estado
   `pending` dentro de la transacción;
4. cancelación sólo reclama una Order `pending`;
5. el reintento sobre una Order ya `completed` conserva la respuesta idempotente
   sin Payment, caja ni evento adicional.

El backend sigue siendo la barrera principal. El frontend no ofrece una acción
normal para reabrir órdenes completadas y no necesitó cambios.

## 8. Resultados de regresión

- Prueba focal: 19 aprobadas y 1 integración omitida al ejecutarse sin bandera
  MySQL.
- Unitarias completas: 231/231.
- Integración MySQL completa: 64/64, incluida la nueva regresión concurrente.
- TypeScript de aplicación y tests: PASS.
- ESLint: PASS.
- Build backend: PASS.

## 9. Excepción histórica exacta

Order 1540, Payment 1455 y CashRegister 150 se conservan sin cambios. La
excepción no autoriza diferencias nuevas ni una exclusión general. En especial,
`SUM(Payment.amount)` no representa todos los cobros históricos porque omite el
segundo cobro real de `$378.00` con tarjeta. No se debe corregir artificialmente
esa suma.

Los SQL de preflight y post-migración producen `PASS_KNOWN_EXCEPTION` sólo si
la huella completa permanece exacta; si falta una fila, aparece otro Payment o
cambia caja, producen `NO_GO_EXCEPTION_CHANGED`. Cualquier otra diferencia
`Payment.amount != Order.total` devuelve filas y es NO-GO.

## 10. Estado Prisma productivo conocido

La evidencia read-only de 16A.2 indicó que producción no contiene
`_prisma_migrations`, aunque su esquema físico representa ampliamente el estado
inicial MySQL. Esa evidencia no se volvió a consultar en 16A.4. Accesos a
producción durante esta etapa: cero.

## 11. Migraciones auditadas

El directorio activo `backend/prisma/migrations` contiene exactamente:

1. `20260723135000_mysql_initial`;
2. `20260723153500_payment_order_unique`;
3. `20260827211000_expense_idempotency`.

`20260201003637_init` está archivada en `backend/prisma/archive/sqlite` y no se
debe ejecutar contra MySQL. `inventory_recipes_core` no existe en el historial
activo y no debe inventarse ni registrarse.

## 12. Matriz de migraciones

| Migración | Motor/origen | Objetivo | Representada antes | Marcar aplicada | Ejecutar | Riesgo y evidencia |
| --- | --- | --- | --- | --- | --- | --- |
| `20260201003637_init` | SQLite archivada | Init histórico SQLite | No aplicable a MySQL | No | No | Incompatible; fuera del directorio activo |
| `20260723135000_mysql_initial` | MySQL activa | Crear esquema base | Sí, físicamente | Sí, sólo tras preflight | No | Ejecutarla recrearía tablas; `resolve --applied` fue validado |
| `20260723153500_payment_order_unique` | MySQL activa | `UNIQUE Payment.orderId` | No antes del ensayo | No | Sí, después de sanear 1023 y validar cero duplicados | Fallaría o sería incorrecta con duplicados |
| `20260827211000_expense_idempotency` | MySQL activa | Columna/índice único nullable | No antes del ensayo | No | Sí | 546 gastos preservados; claves históricas quedan `NULL` |
| `inventory_recipes_core` | Ausente | No determinado | No auditada porque no existe | No | No | Prohibido inventarla |

## 13. Estrategia de baseline

Con `DATABASE_URL` apuntando exclusivamente a la base local/objetivo verificada:

```powershell
npx prisma migrate resolve --applied 20260723135000_mysql_initial --schema prisma/schema.mysql.prisma
npx prisma migrate status --schema prisma/schema.mysql.prisma
```

El primer comando registra como aplicada únicamente la migración inicial que el
preflight demuestre ya representada físicamente. No se marcan ciegamente las
migraciones incrementales. No se usa `migrate reset` ni `db push`.

Después del saneamiento explícito de Order 1023 y de comprobar cero duplicados:

```powershell
npx prisma migrate deploy --schema prisma/schema.mysql.prisma
npx prisma migrate status --schema prisma/schema.mysql.prisma
```

## 14. Simulación local

Fuente: `backups/cafeteria_pos_prod_clone_pre_migration.sql`, 10,322,978 bytes,
SHA-256
`8A7BA6E141A5CAF9A9BDB561FFB4432E550DCEA167F4A07508347BAA3D2C6325`.
Es una copia local saneada de 1023, anterior a las migraciones incrementales.
Se restauró en `cafeteria_pos_prod_clone_transaction_test`; se eliminó solamente
la tabla residual `_prisma_migrations` de esa copia desechable para reproducir
el estado histórico ausente y se restauró nuevamente.

Snapshot previo:

| Métrica | Antes |
| --- | ---: |
| Order | 1602 |
| OrderItem | 3219 |
| Payment | 1524 |
| SUM Payment | 221375.00 |
| Expense | 546 |
| SUM Expense | 125756.40 |
| CashRegister | 160 |
| Product | 77 |
| User | 2 |
| Promotion | 2 |

Antes del baseline no existía `_prisma_migrations`, Payment tenía el índice no
único `Payment_orderId_idx` y Expense no tenía `idempotencyKey`. Se ejecutó
`migrate resolve` sólo para el init. El status intermedio mostró exactamente las
otras dos migraciones como pendientes. `migrate deploy` aplicó únicamente
`payment_order_unique` y `expense_idempotency`; el status final fue
`Database schema is up to date!`.

Las tres filas de `_prisma_migrations` quedaron finalizadas, sin rollback. El
índice final `Payment_orderId_key` es único. Los 546 `idempotencyKey` históricos
son `NULL`. Los campos JSON compatibles con MariaDB permanecieron `LONGTEXT`;
no hubo conversión automática.

## 15. Reconciliación

Los conteos y sumas posteriores fueron idénticos al snapshot previo. La
verificación de integridad de 13 tablas produjo el mismo SHA-256 de negocio en
origen y destino:
`51FC9AB9E62B73095B2C08694F5E7EDBA051FCE04DA74B059639A13A8B9B6236`.

Además:

- órdenes con Payments duplicados: 0;
- Order 1023: sólo Payment 953, `$190.00 cash`;
- Order 1540: `$378.00 completed` intacta;
- Payment 1455: `$115.00 cash` intacto;
- CashRegister 150: `716.00 / 638.00 / 8 / closed` intacta;
- Expense count y suma: sin cambios;
- no se alteraron OrderItem ni tipos JSON/LONGTEXT.

## 16. Procedimiento futuro 16B

No ejecutar sin autorización expresa y ventana de mantenimiento:

1. activar mantenimiento y bloquear escrituras de aplicación;
2. verificar identidad de host, base y usuario; detenerse ante cualquier duda;
3. crear y verificar backup final independiente;
4. ejecutar snapshot/preflight read-only y guardar evidencia;
5. detenerse si 1023, 1540 o cualquier métrica difiere de la evidencia;
6. confirmar equivalencia física del init MySQL;
7. registrar sólo `20260723135000_mysql_initial` con `migrate resolve --applied`;
8. comprobar que únicamente las dos migraciones incrementales quedan pendientes;
9. ejecutar el saneamiento transaccional controlado de 1023;
10. validar Payment 953, ausencia de 954/955, cero duplicados y reconciliación;
11. ejecutar `prisma migrate deploy` para Payment UNIQUE e idempotencia Expense;
12. ejecutar `prisma migrate status`, validación post-migración y reconciliación;
13. desplegar backend y frontend sólo si todos los checkpoints son PASS;
14. ejecutar smoke tests y reabrir operación.

El orden baseline → saneamiento → UNIQUE es obligatorio: el init sólo se
registra; la restricción UNIQUE no puede desplegarse hasta eliminar de forma
controlada los duplicados 954/955.

## 17. Riesgos y puntos de parada

Detener 16B ante: duplicados distintos de 1023; huella 1023 inesperada; huella
1540/1455/150 distinta; una nueva discrepancia financiera; init no equivalente;
drift inesperado; migración destructiva o desconocida; intento de aplicar SQLite
o inventory recipes; conteos, sumas o hashes no reconciliados; estado Prisma
ambiguo; backup no verificable.

La ruta de cancelación ahora evita cancelar una orden pagada, pero aún no existe
un dominio de refunds. Diseñarlo queda fuera de 16A.4 y debe incluir asiento
financiero inverso, autorización, motivo y auditoría.

## 18. Pendientes

1. 16B debe volver a comprobar producción en read-only dentro de la ventana;
   la evidencia de 16A.2 puede haber cambiado.
2. Order 1023 sigue pendiente de saneamiento explícito en producción. El clon
   limpio no autoriza asumir que producción ya fue saneada.
3. Verificar el backup final y registrar hashes antes de cualquier escritura.
4. Diseñar un flujo explícito de refund/corrección administrativa si el negocio
   lo necesita.
5. Retirar en una etapa separada el árbol backend legado duplicado, con pruebas
   de rutas, sin mezclarlo con la migración productiva.

