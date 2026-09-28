# Etapa 16B.2-R1 — baseline Prisma y migraciones productivas

## Estado y alcance

- Fecha local de finalización: 2026-09-28 (`America/Mexico_City`).
- Resultado: **APROBADA EN CANDIDATA LOCAL**.
- Base ensayada: `cafeteria_pos_16b2_candidate_20260927`.
- Host: `localhost:3306`.
- Usuario: `usuario_prod_clone@localhost`.
- Conexiones a producción: **0**.
- Escrituras productivas: **0**.
- Cambios de esquema productivo: **0**.
- Deploy de aplicación: **no ejecutado**.

La intervención administrativa previa creó únicamente la base candidata y
otorgó privilegios limitados a esa base. El ensayo no utilizó `root`, no cargó
credenciales productivas y no conectó con `srv1102.hstgr.io`.

## Backup utilizado

| Control | Resultado |
|---|---|
| Archivo | `backups/dulce_aroma_production_pre_16b_20260927_224955.sql` |
| Tamaño | `10,363,867` bytes |
| SHA-256 | `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56` |
| Hash esperado | MATCH |
| Archivo modificado | No |

La candidata existía, era accesible por el usuario dedicado y contenía
exactamente **0 tablas de usuario** antes de la importación. El restore terminó
con exit code `0`, sin errores. MySQL emitió únicamente avisos `1681` por anchos
de enteros obsoletos.

## Estado PRE-16B restaurado

| Métrica | Valor | Resultado |
|---|---:|---|
| Order | 1710 | PASS |
| OrderItem | 3459 | PASS |
| Payment | 1633 | PASS |
| SUM Payment.amount | 239943.00 | PASS |
| Expense | 579 | PASS |
| SUM Expense.amount | 138266.40 | PASS |
| CashRegister | 171 | PASS |
| ProductCategory | 16 | PASS |
| CashRegister abiertas | 0 | PASS |

Order 1023 estaba `completed`, total `190.00`, con Payments 953, 954 y 955
por `190.00` cada uno. Era el único grupo duplicado. Antes del ensayo no
existían `Payment_orderId_key`, `Expense.idempotencyKey` ni
`_prisma_migrations`.

CashRegister 96 coincidió con la evidencia: apertura `170.00`, cierre
`1345.00`, esperado `1318.00`, diferencia `27.00`, ventas efectivo `1148.00`,
tarjeta `160.00`, gastos `0.00`, 12 transacciones y estado `closed`.

La excepción 1540 también coincidió exactamente: orden `completed` por
`378.00`, tres items por `378.00`, Payment 1455 `cash` por `115.00` y
CashRegister 150 con `716.00 / 638.00 / 8 / closed`.

## Reproducción local de 16B.1

Se ejecutó una transacción local `REPEATABLE READ`. Se bloquearon Order 1023,
su item, Payments 953/954/955 y CashRegister 96. El único borrado fue:

```sql
DELETE FROM Payment
WHERE id IN (954, 955)
  AND orderId = 1023
  AND amount = 190.00;
```

`DELETE_ROW_COUNT = 2`. Antes del commit, se reconciliaron todas las métricas,
Payment 953, CashRegister 96 y la excepción 1540. Resultado: **COMMIT local**.

## Estado POST-16B.1

| Métrica | Valor | Resultado |
|---|---:|---|
| Order | 1710 | PASS |
| OrderItem | 3459 | PASS |
| Payment | 1631 | PASS |
| SUM Payment.amount | 239563.00 | PASS |
| Expense | 579 | PASS |
| SUM Expense.amount | 138266.40 | PASS |
| CashRegister | 171 | PASS |
| CashRegister abiertas | 0 | PASS |
| Grupos Payment duplicados | 0 | PASS |

- Payment 953: presente por `190.00`.
- Payments 954/955: ausentes.
- Order 1023: intacta.
- CashRegister 96: **UNCHANGED**.
- Order 1540: **PASS_KNOWN_EXCEPTION**.

## Inventario completo de migraciones

El directorio activo contiene exactamente tres migraciones:

| Migración | Estado físico antes del ensayo | Acción local |
|---|---|---|
| `20260723135000_mysql_initial` | PHYSICALLY APPLIED | Sólo `migrate resolve --applied` |
| `20260723153500_payment_order_unique` | NOT APPLIED | Aplicada mediante `migrate deploy` |
| `20260827211000_expense_idempotency` | NOT APPLIED | Aplicada mediante `migrate deploy` |

Migraciones mencionadas históricamente pero no activas:

| Nombre | Clasificación | Acción |
|---|---|---|
| `20260201003637_init` | SQLite archivada, incompatible con MySQL | No ejecutar ni resolver |
| `20260730190000_inventory_recipes_core` | Placeholder vacío retirado; no existe en Git ni en el candidato | **UNSAFE TO APPLY LITERALLY**; no inventar ni resolver |

Hashes SHA-256 de las migraciones activas:

- init MySQL: `8F9604C6E3E20C7C567971A1BD776ECA3779B2BA678B5F6AE70012292945F818`;
- Payment UNIQUE: `7F585890E66FB04B2FEF686031C058B48FAC15E5E74B59B9AF35A32C003A994D`;
- Expense idempotency: `EBD1418884956D340C53A34469B1C80BF75897131046F5E0675EF27605A3B2D6`.

## Equivalencia del init y deriva representacional

Las 13 tablas del init están materializadas con sus PK, índices y FKs. Los 16
campos que Prisma modela como JSON llegaron desde MariaDB como `LONGTEXT`, pero
cada uno conserva una restricción `CHECK(json_valid(...))`; no son texto libre.
MySQL también expone como `NO ACTION` las dos FKs que Prisma declara
`RESTRICT`, comportamientos equivalentes en este caso.

Por ello el init se clasificó **PHYSICALLY APPLIED** y se registró únicamente:

```text
prisma migrate resolve --applied 20260723135000_mysql_initial
```

Después del baseline, `migrate status` mostró exclusivamente las dos
migraciones incrementales pendientes. No se utilizó `migrate reset`, `db push`
ni `migrate dev`.

## Migraciones incrementales ensayadas

`prisma migrate deploy` aplicó localmente, en orden:

1. `20260723153500_payment_order_unique`;
2. `20260827211000_expense_idempotency`.

Resultado Payment:

- `Payment_orderId_key`: UNIQUE presente;
- `Payment_orderId_idx`: ausente;
- `Payment_orderId_fkey`: presente;
- conteo: 1631;
- suma: 239563.00.

Resultado Expense:

- `idempotencyKey VARCHAR(191) NULL`: presente;
- `Expense_idempotencyKey_key`: UNIQUE presente;
- 579 gastos históricos preservados;
- 579 claves históricas `NULL`;
- conteo: 579;
- suma: 138266.40.

`_prisma_migrations` contiene tres filas finalizadas y cero filas con
`rolled_back_at`.

## Prueba funcional de Payment UNIQUE

Dentro de una transacción controlada se intentó insertar un segundo Payment
para Order 1023. MySQL rechazó la fila por duplicado. La transacción fue
revertida explícitamente y la reconciliación posterior confirmó 1631 Payments
y únicamente Payment 953 para Order 1023. No quedaron datos de prueba.

## Prisma y pruebas

| Control | Resultado |
|---|---|
| `prisma generate` | PASS |
| `prisma validate` | PASS |
| `prisma migrate status` | PASS — schema up to date |
| Pruebas unitarias | PASS — 23 archivos, 231 pruebas |
| Integración MySQL relevante | PASS — 6 archivos, 54 pruebas |

Las integraciones cubrieron Payment, Expense, CashRegister, idempotencia,
integridad financiera, concurrencia y regresión de reapertura. Se ejecutaron en
serie contra la candidata local. Al finalizar quedaron cero órdenes, cajas y
gastos con prefijos temporales de prueba.

## Drift final

No existe drift inesperado en Payment, Expense ni en el historial de
migraciones. El diff restante es **EXPECTED** y se limita a:

1. `LONGTEXT + CHECK(json_valid(...))` frente al tipo nativo `JSON` del
   datamodel;
2. representación `NO ACTION` frente a `RESTRICT` en las FKs de Product y
   ProductSupply.

No se alteraron esos campos ni se ejecutó el SQL sugerido por el diff. Aplicar
ese diff automáticamente sería innecesario y queda fuera de alcance.

## Reconciliación final

| Métrica | Valor final | Resultado |
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
| Registros temporales de pruebas | 0 | PASS |

- Payment 953: presente.
- Payments 954/955: ausentes.
- CashRegister 96: **UNCHANGED** campo por campo.
- Order 1540: **PASS_KNOWN_EXCEPTION**.
- Reconciliación financiera: **PASS**.

## Plan productivo propuesto — no autorizado todavía

Este plan sólo puede ejecutarse en una ventana futura expresamente autorizada:

1. congelar todas las escrituras de la aplicación y confirmar mantenimiento;
2. comprobar identidad exacta de host, base y usuario productivos;
3. crear y verificar un **nuevo backup POST-16B.1 y PRE-esquema**; el backup
   usado en este ensayo es PRE-16B.1 y no es suficiente como único rollback;
4. repetir el preflight read-only y exigir las métricas POST-16B.1 exactas;
5. verificar cero Payment duplicados, Payment 953 presente, 954/955 ausentes,
   CashRegister 96 intacta y excepción 1540 exacta;
6. verificar hashes de las tres migraciones activas;
7. registrar sólo `20260723135000_mysql_initial` con
   `prisma migrate resolve --applied`;
8. exigir que `migrate status` muestre únicamente Payment UNIQUE y Expense
   idempotency pendientes;
9. volver a verificar cero Payment duplicados y la FK de Payment;
10. ejecutar `prisma migrate deploy` para las dos migraciones incrementales;
11. ejecutar `migrate status`, auditoría física, pruebas de humo y
    reconciliación financiera completa;
12. desplegar la aplicación sólo después de todos los PASS y reabrir operación.

No debe resolverse ni ejecutarse `inventory_recipes_core`. No debe aplicarse el
diff LONGTEXT/JSON ni utilizarse `db push` para ocultarlo.

## Rollback y puntos de parada

MySQL realiza commits implícitos para DDL. Por eso el rollback productivo no
puede depender de una transacción envolvente:

- antes de `migrate deploy`: detenerse ante cualquier diferencia; no continuar;
- tras un fallo de DDL: mantener la aplicación congelada, no editar
  `_prisma_migrations` manualmente y capturar el estado físico exacto;
- si el estado no admite una corrección forward segura y aprobada: restaurar el
  backup nuevo POST-16B.1/PRE-esquema y repetir toda la reconciliación;
- no usar como único rollback el dump PRE-16B empleado aquí, porque reintroduce
  Payments 954/955;
- no desplegar código si Payment UNIQUE, su FK, Expense idempotency o las
  métricas financieras no coinciden.

## Riesgos residuales

- El drift representacional JSON/`LONGTEXT` debe seguir documentado y no
  convertirse automáticamente.
- Un backup tomado antes de 16B.1 no representa el estado productivo actual.
- Aplicar migraciones con escrituras activas puede producir estados no
  reconciliables.
- Editar manualmente `_prisma_migrations` falsearía el historial.
- La ausencia real de `inventory_recipes_core` prohíbe inventarla o resolverla.

## Seguridad y Git

- `MYSQL_PWD` y `DATABASE_URL` fueron retiradas del entorno después de cada uso.
- No se mostraron ni documentaron secretos.
- Producción no fue conectada.
- No hubo SQL productivo.
- No se ejecutó `git add`, commit, push, merge ni rebase.

## Conclusión

**ETAPA 16B.2 APROBADA — BASELINE Y MIGRACIONES ENSAYADOS LOCALMENTE, LISTO PARA PREPARAR APLICACIÓN PRODUCTIVA**
