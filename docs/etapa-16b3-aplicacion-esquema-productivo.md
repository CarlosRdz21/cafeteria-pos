# Etapa 16B.3 — aplicación controlada del esquema productivo

## Resultado y alcance

- Fecha local: 2026-09-28 (`America/Mexico_City`).
- Destino sanitizado: `srv1102.hstgr.io:3306/u349605213_dulceAroma`.
- Usuario sanitizado: `u349605213_carlos`.
- Servidor: MariaDB `11.8.9-MariaDB-log`.
- TLS observado con MySQL y Prisma: `TLSv1.2`.
- Resultado: **PASS**.
- Deploy backend/frontend: **no ejecutado / no autorizado**.
- POS: permanece congelado.

Los únicos cambios realizados fueron el baseline Prisma y las dos migraciones
de esquema aprobadas en 16B.2. No se modificaron filas de negocio.

## Freeze y snapshot pre-DDL

La actividad más reciente permaneció exactamente en:

- Order: ID máximo 1736, `2026-09-26 18:21:35.058`;
- Payment: ID máximo 1650, `2026-09-26 18:47:39.214`;
- Expense: ID máximo 582, `2026-09-26 23:39:56.732`;
- CashRegister: ID máximo 171 y cero abiertas.

No apareció actividad nueva desde 16B.1. `PRODUCTION FREEZE: PASS`.

| Métrica pre-DDL | Valor |
|---|---:|
| Order | 1710 |
| OrderItem | 3459 |
| Payment | 1631 |
| SUM Payment.amount | 239563.00 |
| Expense | 579 |
| SUM Expense.amount | 138266.40 |
| CashRegister | 171 |
| CashRegister abiertas | 0 |
| Payment duplicados | 0 |

Payment 953 estaba presente por `190.00`; 954/955 estaban ausentes. CashRegister
96 coincidió campo por campo con 16B.1. La huella 1540/1455/150 fue
`PASS_KNOWN_EXCEPTION`.

Estado físico pre-DDL:

- `Payment_orderId_key`: ausente;
- `Payment_orderId_idx`: presente, no único;
- `Payment_orderId_fkey`: presente;
- `Expense.idempotencyKey`: ausente;
- `_prisma_migrations`: ausente;
- tablas de usuario: 13.

Todas las consultas de preflight se ejecutaron dentro de una transacción
`READ ONLY` finalizada con `ROLLBACK`.

## Backups

Backup PRE-16B verificado nuevamente:

- archivo: `backups/dulce_aroma_production_pre_16b_20260927_224955.sql`;
- tamaño: `10,363,867` bytes;
- SHA-256: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`;
- resultado: **MATCH**.

Antes del DDL se creó un backup adicional POST-16B.1/PRE-esquema:

- archivo: `backups/dulce_aroma_production_post_16b1_pre_schema_20260928_000858.sql`;
- tamaño: `10,363,683` bytes;
- SHA-256: `66D9D4662F62B7DC030F6251A589418A1BDA8C5C4DD465D8E79B1DFA9586FB87`;
- `mysqldump` exit code: `0`;
- 13 tablas, marca final completa y sin `CREATE DATABASE`;
- sin `_prisma_migrations`, Payment UNIQUE ni Expense idempotency;
- resultado: **PASS**.

Este segundo backup es el rollback preferente porque representa exactamente el
estado POST-16B.1 anterior al esquema. No se restauró ningún backup.

## Conexión Prisma segura

La URL almacenada no tenía parámetros TLS. Para esta ejecución se construyó
únicamente en memoria una URL con `sslaccept=accept_invalid_certs`, equivalente
al modo TLS obligatorio ya aprobado. Una consulta Prisma read-only confirmó:

- base exacta;
- usuario exacto;
- MariaDB `11.8.9`;
- `Ssl_version = TLSv1.2`.

La URL efímera fue eliminada después de cada comando y nunca se imprimió.

## Baseline Prisma

Se registró únicamente:

```text
20260723135000_mysql_initial
```

mediante el procedimiento ensayado `migrate resolve --applied`. El primer
intento no llegó a Prisma ni a producción porque una expresión local de
PowerShell dejó `DATABASE_URL` ausente; Prisma terminó en validación. Una
inspección TLS read-only confirmó inmediatamente que no se había creado
`_prisma_migrations` ni cambiado Payment o Expense. Corregida la construcción
local, el baseline terminó correctamente.

La auditoría posterior mostró una migración terminada, cero revertidas y ningún
cambio físico todavía. `migrate status` mostró exclusivamente:

1. `20260723153500_payment_order_unique`;
2. `20260827211000_expense_idempotency`.

`20260201003637_init` no está en el historial MySQL activo.
`20260730190000_inventory_recipes_core` no existe y no fue ejecutada ni
resuelta. Tratamiento: **PASS / UNSAFE, sin cambio físico**.

## Migraciones de esquema

Tras revalidar cero duplicados, Payment 1631/239563.00, FK presente e índice
anterior presente, se ejecutó el `migrate deploy` exacto ensayado en 16B.2.

Cambios autorizados aplicados:

1. creación de `Payment_orderId_key` UNIQUE;
2. eliminación de `Payment_orderId_idx` no único;
3. conservación de `Payment_orderId_fkey`;
4. adición de `Expense.idempotencyKey VARCHAR(191) NULL`;
5. creación de `Expense_idempotencyKey_key` UNIQUE;
6. registro final de ambas migraciones en `_prisma_migrations`.

No se recreó Payment, no se modificaron Payments y no se aplicaron cambios de
inventory/recipes o LONGTEXT/JSON.

## Esquema e historial final

| Control | Resultado |
|---|---|
| `Payment_orderId_key` | presente, UNIQUE |
| `Payment_orderId_idx` | ausente |
| `Payment_orderId_fkey` | presente |
| `Expense.idempotencyKey` | `VARCHAR(191) NULL` |
| `Expense_idempotencyKey_key` | presente, UNIQUE |
| Expense históricas con clave NULL | 579 |
| `_prisma_migrations` | presente |
| Migraciones terminadas | 3 |
| Migraciones revertidas | 0 |
| Tablas finales | 14, incluyendo historial Prisma |

Las tres migraciones terminadas son exactamente:

1. `20260723135000_mysql_initial`;
2. `20260723153500_payment_order_unique`;
3. `20260827211000_expense_idempotency`.

`prisma migrate status` devolvió `Database schema is up to date!`.

## Drift

El diff Prisma productivo final devolvió `This is an empty migration.`. MariaDB
normalizó la representación de JSON y FKs de forma que Prisma no reportó el
texto representacional observado en el restore MySQL local.

- drift adicional: ninguno;
- drift inesperado: ninguno;
- clasificación operativa: **EXPECTED / sin drift efectivo**;
- SQL del diff ejecutado: ninguno.

El comprobador local que esperaba ocho bloques representacionales terminó con
código 91 por recibir un diff vacío. Fue una comprobación read-only; no indica
un error de Prisma ni produjo cambios.

## Snapshot y reconciliación post-DDL

| Métrica post-DDL | Valor | Resultado |
|---|---:|---|
| Order | 1710 | PASS |
| OrderItem | 3459 | PASS |
| Payment | 1631 | PASS |
| SUM Payment.amount | 239563.00 | PASS |
| Expense | 579 | PASS |
| SUM Expense.amount | 138266.40 | PASS |
| CashRegister | 171 | PASS |
| CashRegister abiertas | 0 | PASS |
| Payment duplicados | 0 | PASS |

- máximos y fechas de actividad: sin cambios;
- Payment 953: presente por `190.00 cash`;
- Payment 954: ausente;
- Payment 955: ausente;
- CashRegister 96: **UNCHANGED**;
- Order 1540: **PASS_KNOWN_EXCEPTION**;
- filas de negocio escritas durante 16B.3: **0**;
- reconciliación financiera: **PASS**.

No se probó el UNIQUE mediante inserciones productivas ni se crearon gastos de
prueba. Las pruebas de escritura permanecen limitadas a la candidata 16B.2.

## Validaciones locales

- `prisma generate`: PASS;
- `prisma validate`: PASS;
- configuración usada: candidata MySQL local;
- escrituras productivas de estos comandos: 0.

## Rollback disponible

MySQL/MariaDB hace commit implícito en DDL; no se asume que `ROLLBACK` revierta
estos cambios. Si aparece una anomalía posterior:

1. mantener el POS congelado;
2. no repetir DDL ni editar `_prisma_migrations` a mano;
3. inspeccionar primero tablas, índices, FKs e historial;
4. preferir una corrección forward sólo con autorización específica;
5. si se exige restauración completa, usar el backup POST-16B.1/PRE-esquema
   verificado y repetir toda la reconciliación antes de reabrir operación.

El backup PRE-16B no debe ser el rollback principal porque contiene Payments
954/955 y requeriría repetir el saneamiento 16B.1.

## Advertencias y seguridad

- El POS debe permanecer congelado hasta autorización posterior.
- No se desplegó ni reinició backend o frontend.
- No se modificaron Render, Hostinger, DNS ni variables persistentes.
- `MYSQL_PWD` y `DATABASE_URL` quedaron ausentes después de cada operación.
- No se mostraron ni documentaron secretos.
- No se ejecutó `git add`, commit, push, merge ni rebase.

## Conclusión

**ETAPA 16B.3 APROBADA — ESQUEMA PRODUCTIVO Y BASELINE PRISMA APLICADOS Y RECONCILIADOS, LISTO PARA PREPARAR 16B.4**
