# Integridad contable de Dulce Aroma Café POS

## Estado y aislamiento

Las correcciones de cierre de caja y de gastos fueron validadas exclusivamente
en la rama `test/integridad-contable-pos`, contra MySQL local
`localhost:3306/cafeteria_pos_test`, con `NODE_ENV=test` y
`DATABASE_URL === TEST_DATABASE_URL`.

No se usaron Render, Hostinger, Mercado Pago real ni datos productivos. No hubo
push, merge, rebase o despliegue.

## Cierre de caja concurrente

`CashRegistersController.closeCurrent` consultaba la caja abierta y después la
cerraba con un `update` filtrado únicamente por `id`. Varias solicitudes podían
leer la misma fila abierta y sobrescribir sus importes de cierre.

El cierre ahora reclama la fila en una transacción con un `UPDATE` parametrizado
condicionado por `id` y `status = 'open'`. Sólo una solicitud puede cerrarla;
las demás conservan el contrato existente y reciben 404. La actualización de
ventas también exige una caja abierta. Si el cierre gana la carrera, Order y
Payment se revierten, se responde 409 y no se emiten eventos Socket.IO de éxito.

## Gastos atómicos e idempotentes

### Causa raíz comprobada

El alta anterior creaba `Expense` fuera de una transacción y después asignaba
`CashRegister.expenses = valorAnterior + monto`. Esto permitía duplicados ante
reintentos, estados parciales, incrementos perdidos y carreras con el cierre.
El borrado también podía restituir el acumulado más de una vez.

La prueba roja reprodujo el defecto: el mismo intento enviado 2, 5, 10 y 20
veces creó respectivamente 2, 5, 10 y 20 gastos.

### Identidad del intento

Se agregó `Expense.idempotencyKey String? @unique`. La clave identifica la
intención y no se deriva de concepto, monto o fecha. Dos gastos legítimos con
datos iguales siguen permitidos cuando tienen claves distintas.

El backend acepta la clave en `Idempotency-Key` y en el cuerpo:

- misma clave y misma intención: devuelve el gasto existente con 200;
- misma clave y datos incompatibles: devuelve 409;
- clave nueva: crea el gasto con 201;
- clientes antiguos sin clave: conservan compatibilidad.

El frontend genera una clave por acción y la reutiliza después de un resultado
incierto. También bloquea el botón mientras guarda. La restricción única de
MySQL es la protección definitiva ante solicitudes simultáneas.

### Atomicidad con caja

Para un gasto pagado desde caja, una sola transacción localiza la caja abierta,
incrementa `CashRegister.expenses` de forma condicional y atómica, y después
crea el `Expense` asociado.

El orden es deliberado. Una primera versión de la prueba real detectó deadlocks
P2034 al crear primero el gasto y bloquear después la caja. Reclamar primero la
fila compartida de CashRegister serializó el acumulado y eliminó los deadlocks
en la repetición completa.

Si el cierre gana antes del incremento, se responde 409 y no se crea el gasto.
Si la creación falla después del incremento, toda la transacción se revierte.

### Eliminación concurrente

La eliminación reclama `Expense` con `deleteMany({ id })` en una transacción.
Sólo un solicitante puede eliminarlo y restituir la caja; los demás reciben el
404 existente. El decremento es atómico y se limita a cero. Si la caja estaba
cerrada, también se recalculan `expectedAmount` y `difference` de forma
consistente con el contrato actual.

## Migración MySQL aislada

`20260827211000_expense_idempotency` contiene únicamente:

```sql
ALTER TABLE Expense ADD COLUMN idempotencyKey VARCHAR(191) NULL;
CREATE UNIQUE INDEX Expense_idempotencyKey_key ON Expense(idempotencyKey);
```

Se aplicó y marcó únicamente en `cafeteria_pos_test`. No se ejecutó `migrate
deploy`, `migrate dev` ni `db push` sobre otra base.

Siguen pendientes, sin aplicar:

- `20260201003637_init`: SQL histórico de SQLite incompatible para aplicación
  automática en MySQL;
- `20260730190000_inventory_recipes_core`: migración previa que debe
  reconciliarse por separado.

Continúa fuera de alcance la deriva entre el `@unique` declarado para
`OrderItem.orderId` y el índice no único de MySQL. No debe ejecutarse `db push`
hasta revisarla.

## Evidencia de pruebas MySQL

`expenses-integrity.mysql.spec.ts` usa Prisma real, verifica valores persistidos
y limpia todos sus datos temporales.

| Caso | Cobertura | Resultado |
| --- | --- | --- |
| Reintento sin caja | 2, 5, 10 y 20 simultáneos | PASS: un Expense |
| Reintento con caja | 2, 5, 10 y 20 simultáneos | PASS: un Expense y un incremento |
| Reintento secuencial | 1, 5 y 10 | PASS |
| Gastos legítimos iguales | 5, 10 y 20 claves distintas | PASS: se conservan todos |
| Rollback forzado | FK inválida después del incremento | PASS |
| Gasto contra cierre | 20 carreras | PASS: sólo estados coherentes |
| Gasto contra pago | pago 200, gasto 50 y cierre | PASS |
| Pagos y gastos simultáneos | 10 + 10, durante 3 rondas | PASS |
| Borrado concurrente | 2, 5 y 10 | PASS: una restitución |
| Borrado repetido | normal y segundo intento | PASS: 200 y 404 |
| Importes inválidos | cero, negativos, no finitos y fuera de rango | PASS: 400 |
| Importe decimal | 12.5 | PASS |
| Simulación contable | 3 rondas completas | PASS |

La simulación usa apertura 1000, ventas en efectivo 450, ventas con tarjeta 550,
gastos de caja 125 y gastos externos 120. Se comprobaron ventas totales 1000,
gastos de reportes 245, efectivo esperado 1325 y ganancia neta 755.

## Validaciones finales

### Backend

- compuerta MySQL local: PASS;
- TypeScript de producción y pruebas: PASS;
- lint: PASS, 0 errores y 215 advertencias heredadas;
- pruebas unitarias: 222 PASS;
- pruebas de integración MySQL: 63/63 PASS;
- autorización y controlador de gastos: 45/45 PASS;
- Prisma validate y generate: PASS;
- build y `npm run verify:local`: PASS.

### Frontend

- TypeScript de aplicación y specs: PASS;
- lint: PASS, 0 errores y 96 advertencias heredadas;
- build Angular: PASS;
- la prueba nueva de `ExpenseService` compiló, pero ChromeHeadless terminó antes
  de ejecutar specs con `exit_code=-1073741790` por el entorno GPU/caché de
  Windows. No se contabiliza como PASS ni como fallo de aserción.

### Estado final de la base aislada

- 14 tablas;
- 144 registros de aplicación, igual que la línea base;
- 148 registros totales, incluidos cuatro registros de migración;
- índice único `Expense_idempotencyKey_key` presente;
- no quedaron cajas, órdenes, pagos o gastos temporales de las pruebas;
- el usuario MySQL sólo tiene permisos sobre la base de pruebas.

## Archivos principales

- `backend/src/modules/expenses/expenses.controller.ts`
- `backend/prisma/schema.mysql.prisma`
- `backend/prisma/migrations/20260827211000_expense_idempotency/migration.sql`
- `backend/tests/expenses.controller.spec.ts`
- `backend/tests/integration/expenses-integrity.mysql.spec.ts`
- `src/app/core/services/expense.service.ts`
- `src/app/core/services/expense.service.spec.ts`
- `src/app/shared/models/domain.models.ts`
- `src/app/features/expenses/expenses/expenses.component.ts`

`backend/dist` fue regenerado por las compilaciones obligatorias y no se editó
manualmente. Los cambios visuales previos del frontend no deben mezclarse en los
commits de esta corrección.

## Reversión

Revertir los commits en orden inverso con `git revert <hash>`. No usar
`git reset --hard`, porque existen cambios frontend anteriores que deben
conservarse.

Revertir el código no elimina la columna local. Si fuera necesario revertir
también el esquema de pruebas, revisar y ejecutar de forma controlada:

```sql
DROP INDEX Expense_idempotencyKey_key ON Expense;
ALTER TABLE Expense DROP COLUMN idempotencyKey;
```

No ejecutar esas sentencias en producción como parte de esta etapa.

## Resultado de aprobación

| Área | Resultado |
| --- | --- |
| Gasto normal | PASS |
| Retry | PASS |
| Idempotencia | PASS |
| Concurrencia | PASS |
| Atomicidad de caja | PASS |
| Gasto contra cierre | PASS |
| Gasto contra pago | PASS |
| Delete normal, repetido y concurrente | PASS |
| Rollback | PASS |
| Reportes | PASS |
| Integridad MySQL | PASS |
| Simulación contable | PASS |

## Pendientes fuera de alcance

- reconciliar las dos migraciones antiguas pendientes;
- resolver la deriva de `OrderItem.orderId`;
- estabilizar ChromeHeadless en Windows;
- revisar por separado la política de versionado de `backend/dist`.
