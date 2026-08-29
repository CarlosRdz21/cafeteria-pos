# Salud del esquema MySQL y Prisma

## 1. Estado Git inicial

- Rama: `test/integridad-contable-pos`.
- Commit inicial: `68c9fc5 docs: completa evidencia de gastos`.
- El árbol ya contenía cambios visuales del frontend y artefactos regenerados en
  `backend/dist`. Se conservaron y no forman parte de esta etapa.
- No se realizó push, merge, rebase ni despliegue.

## 2. Base utilizada y aislamiento

Toda la auditoría se ejecutó con:

- `NODE_ENV=test`;
- `DATABASE_URL === TEST_DATABASE_URL`;
- host `localhost`;
- puerto `3306`;
- base `cafeteria_pos_test`.

La compuerta `npm run db:test:validate` confirmó el aislamiento. El usuario
MySQL sólo tiene permisos sobre la base de pruebas. No se accedió a Render,
Hostinger, producción ni Mercado Pago real.

## 3. Respaldo

Antes de cualquier modificación se creó un dump con `mysqldump --single-transaction`
fuera del repositorio:

`C:\Users\Carlos\AppData\Local\Temp\cafeteria-pos-backups\cafeteria_pos_test_2026-08-29T00-11-30-311Z.sql`

- fecha UTC: `2026-08-29T00:11:30.771Z`;
- tamaño: 9,746,396 bytes;
- SHA-256: `3be622626adb1d5d7a0c3394e48f8487a17ec7d8eb6afe383cc4b5ab867503df`;
- contiene sentencias de estructura `CREATE TABLE`;
- contiene datos `INSERT INTO`;
- contiene el marcador final completo de `mysqldump`.

No fue necesario restaurarlo porque ninguna operación modificó físicamente la
base de datos.

## 4. Línea base

| Métrica | Inicial | Final |
| --- | ---: | ---: |
| Tablas | 14 | 14 |
| Registros funcionales | 144 | 144 |
| Registros totales | 148 | 148 |
| Registros de migración | 4 | 4 |
| Order | 11 | 11 |
| OrderItem | 22 | 22 |
| Payment | 10 | 10 |
| Expense | 2 | 2 |
| CashRegister | 2 | 2 |
| ProductSupply | 3 | 3 |
| SupplyMovement | 0 | 0 |

## 5. `migrate status` inicial

Prisma encontró cinco directorios y reportó dos pendientes:

- `20260201003637_init`;
- `20260730190000_inventory_recipes_core`.

No había una migración MySQL fallida pendiente. El historial conserva un
primer intento de `20260723153500_payment_order_unique` marcado como
`rolled_back`, seguido por su aplicación correcta.

## 6. Auditoría de `20260201003637_init`

El archivo crea únicamente User, Order, OrderItem y Payment, además del índice
único de email. Usa sintaxis de SQLite:

- identificadores entre comillas dobles;
- `INTEGER PRIMARY KEY AUTOINCREMENT`;
- tipos `TEXT`, `REAL` y `DATETIME`;
- FKs OrderItem/Payment con `ON DELETE RESTRICT`.

La estructura física actual fue creada por la migración MySQL
`20260723135000_mysql_initial` y es diferente:

- usa `AUTO_INCREMENT`, `VARCHAR(191)`, `DOUBLE`, JSON y `DATETIME(3)`;
- User incluye `username` único y otros campos actuales;
- Order incluye promociones y datos de pago;
- las FKs de OrderItem y Payment usan `ON DELETE CASCADE`;
- existen diez tablas adicionales que el init SQLite no conoce.

Clasificación: **histórica, obsoleta e incompatible con MySQL (D/E)**. No estaba
físicamente aplicada ni registrada en `_prisma_migrations`. Marcarla con
`migrate resolve --applied` habría falseado el historial. Se preservó en:

`backend/prisma/archive/sqlite/20260201003637_init/migration.sql`

## 7. Auditoría de `20260730190000_inventory_recipes_core`

El directorio no contenía `migration.sql` ni ningún otro archivo y nunca estuvo
versionado en Git. Por tanto, no existían tablas, columnas, DECIMAL, relaciones,
cambios de Order/OrderItem, índices o FKs que pudieran auditarse o aplicarse.

Clasificación: **placeholder vacío, no migración (D)**. Prisma lo interpretaba
como pendiente sólo por el nombre del directorio. Se verificó que tenía cero
elementos y se retiró. No se ejecutó SQL ni `migrate resolve`.

## 8. Historial `_prisma_migrations`

| Migración | Estado | Checksum actual coincide |
| --- | --- | --- |
| `20260723135000_mysql_initial` | aplicada | Sí |
| `20260723153500_payment_order_unique` | primer intento rolled back | Registro histórico |
| `20260723153500_payment_order_unique` | aplicada | Sí |
| `20260827211000_expense_idempotency` | aplicada/resuelta | Sí |

Los checksums SHA-256 de las tres migraciones MySQL activas coinciden con los
registros aplicados. No se insertaron ni editaron filas manualmente.

## 9. Deriva exacta de `OrderItem.orderId`

Antes de corregir:

- `schema.mysql.prisma`: `orderId Int @unique` y `@@index([orderId])`;
- MySQL: índice normal `OrderItem_orderId_idx`, no único;
- FK: `OrderItem_orderId_fkey`, `ON DELETE CASCADE`, `ON UPDATE CASCADE`;
- tipo y nullability: `INT NOT NULL`, coherentes;
- `prisma migrate diff`: proponía crear `OrderItem_orderId_key UNIQUE`.

Los datos demuestran una relación uno-a-muchos: siete de once órdenes tienen
más de un OrderItem, el máximo es cuatro y existen 22 artículos en total. Crear
el índice único habría fallado y además habría roto la regla funcional de un
pedido con varios productos.

Se quitó únicamente `@unique` del schema y se conservó `@@index([orderId])`.
No se modificó MySQL. Después, `prisma migrate diff` devolvió una migración
vacía.

## 10. Datos huérfanos y duplicados protegidos

Todos los siguientes conteos fueron cero:

- OrderItem sin Order;
- Payment sin Order;
- Expense con User inexistente;
- Expense con CashRegister inexistente;
- SupplyMovement sin ProductSupply;
- SupplyMovement con User inexistente;
- ProductSupply sin SupplyCategory;
- Payment.orderId duplicado;
- Expense.idempotencyKey no nulo duplicado.

## 11. Estrategia y operaciones ejecutadas

Se eligió reconciliar los archivos con la estructura real, sin alterar tablas:

1. quitar el `@unique` incorrecto de `OrderItem.orderId`;
2. preservar el SQL SQLite fuera de `prisma/migrations`;
3. retirar el directorio vacío de inventario;
4. no usar `migrate resolve`, porque no había una aplicación física que
   registrar;
5. no usar `migrate deploy`, `migrate dev`, `migrate reset` ni `db push`.

No se creó una migración correctiva porque MySQL ya tenía la estructura correcta
y el diff final es vacío.

## 12. Índices y FKs finales

- `OrderItem_orderId_idx`: no único, correcto para uno-a-muchos.
- `OrderItem_productId_idx`: no único.
- `OrderItem_orderId_fkey`: Order, CASCADE/CASCADE.
- `Payment_orderId_key`: UNIQUE e intacto.
- `Payment_orderId_fkey`: Order, CASCADE/CASCADE.
- `Expense_idempotencyKey_key`: UNIQUE e intacto; la columna sigue nullable.
- FKs de Expense: User y CashRegister con SET NULL/CASCADE.
- FKs de ProductSupply y SupplyMovement: intactas.

## 13. Validaciones

- `npm run db:test:validate`: PASS.
- Prisma validate: PASS.
- Prisma generate: PASS.
- Prisma migrate diff: PASS, migración vacía.
- Prisma migrate status: PASS, esquema actualizado.
- TypeScript de producción y pruebas: PASS.
- Lint: PASS con 0 errores y 215 advertencias heredadas.
- Formato: PASS.
- Pruebas unitarias: 222 PASS.
- Integración MySQL: 63/63 PASS, repetida después de reconciliar.
- Build backend: PASS.
- `npm run verify:local`: PASS.

Las suites conservaron `Payment.orderId UNIQUE`, cierre concurrente,
`Expense.idempotencyKey UNIQUE`, gasto contra caja y pago contra cierre.
El frontend no cambió y no requirió build en esta etapa.

## 14. `migrate status` final

Prisma encuentra tres migraciones MySQL activas y responde:

```text
Database schema is up to date!
```

No hay migraciones pendientes ni fallidas activas. El registro rolled-back del
primer intento de Payment es historial válido, no una falla pendiente.

## 15. Commits locales

- `55d6f37 fix: corrige indice orderitem orderid`
- `a7920b6 fix: documenta historial mysql y sqlite`

No se hizo push, merge, rebase ni despliegue.

## 16. Conclusión

`schema.mysql.prisma`, las tres migraciones MySQL activas y la estructura física
de `cafeteria_pos_test` son coherentes. La base y sus 144 registros funcionales
fueron preservados. No se aplicó ningún cambio estructural ni se modificaron las
reglas financieras aprobadas.

## 17. Riesgos pendientes

- El archivo histórico `prisma/schema.prisma` continúa representando SQLite y
  no debe usarse para comandos MySQL. Los scripts activos ya apuntan a
  `schema.mysql.prisma`.
- El archivo archivado de SQLite es sólo evidencia; no debe volver a moverse al
  directorio activo de migraciones MySQL.
- Cualquier futura funcionalidad de recetas debe introducirse mediante una nueva
  migración MySQL completa, revisable y con pruebas; no reutilizando el nombre
  del placeholder vacío.

## 18. Criterio de aprobación

| Criterio | Resultado |
| --- | --- |
| Prisma schema válido | PASS |
| Migraciones entendidas | PASS |
| No migraciones fallidas activas | PASS |
| Pendientes justificadas/resueltas | PASS |
| OrderItem.orderId coherente | PASS |
| Payment.orderId UNIQUE intacto | PASS |
| Expense.idempotencyKey intacto | PASS |
| Foreign keys | PASS |
| Datos huérfanos = 0 | PASS |
| Integración MySQL | PASS |
| Pruebas financieras | PASS |
| Base preservada | PASS |
