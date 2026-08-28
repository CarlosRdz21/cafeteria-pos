# Integridad contable de Dulce Aroma Café POS

## Estado

**Corrección de cierre concurrente aprobada en MySQL local aislado.**

La validación se realizó exclusivamente en la rama
`test/integridad-contable-pos`, contra `localhost:3306/cafeteria_pos_test`, con
`NODE_ENV=test` y `DATABASE_URL === TEST_DATABASE_URL`. No se usaron Render,
Hostinger, Mercado Pago real ni datos productivos. No hubo push, merge, rebase o
despliegue.

## Causa raíz

`CashRegistersController.closeCurrent` consultaba primero la caja abierta y la
cerraba después mediante un `update` que sólo filtraba por `id`. Dos o más
solicitudes podían leer la misma fila con estado `open` y todas recibían éxito;
el último `update` sobrescribía `closingAmount`, `difference` y `closedAt`.

La regla comercial no cambió: una caja está abierta cuando `status === 'open'`
y el efectivo esperado es `openingAmount + cashSales - expenses`. El modelo
actual no contiene `closedBy`, por lo que no se agregó un campo ni una migración.

## Solución aplicada

El cierre ahora se ejecuta dentro de una transacción Prisma y reclama la fila con
un `UPDATE` SQL parametrizado y condicional:

```sql
UPDATE CashRegister
SET closingAmount = ?,
    expectedAmount = openingAmount + cashSales - expenses,
    difference = ? - (openingAmount + cashSales - expenses),
    closedAt = ?,
    status = 'closed'
WHERE id = ? AND status = 'open';
```

Sólo `affectedRows === 1` se considera exitoso. Los intentos que pierden la
carrera conservan el contrato existente y reciben `404` con
`No hay caja abierta`; nunca reciben 500 ni sobrescriben el cierre. El cálculo
usa los valores de la fila al momento del reclamo, no un acumulado obsoleto.

Para la carrera pago contra cierre, la actualización de ventas también exige
`id + status='open'`. Si la caja ya se cerró, devuelve `null` y el pedido lanza
un `ApplicationError` 409 dentro de la misma transacción. Prisma revierte
`Order` y `Payment`, y Socket.IO no emite éxito.

Como defensa adicional, el botón de cierre queda deshabilitado y muestra
`Cerrando...` mientras espera la respuesta. La persistencia sigue siendo la
protección principal.

## Archivos de esta corrección

- `backend/src/modules/cash/cash-registers.controller.ts`
- `backend/src/modules/orders/order.controller.ts`
- `backend/tests/cash-registers.controller.spec.ts`
- `backend/tests/order.controller.spec.ts`
- `backend/tests/integration/financial-concurrency.mysql.spec.ts`
- `src/app/features/cash/cash-register/cash-register.component.ts`
- `docs/integridad-contable-pos.md`

Los cambios frontend del rediseño y los artefactos generados en `backend/dist`
ya estaban modificados antes de esta corrección y no deben mezclarse en sus
commits. `dist` fue regenerado por el build obligatorio, no editado manualmente.

## Evidencia MySQL real

La prueba `financial-concurrency.mysql.spec.ts` usa `PrismaClient` real, consulta
los valores persistidos y limpia cada caja, pedido y pago temporal.

| Caso | Ejecución | Resultado |
| --- | ---: | --- |
| Cierre normal | 1 | PASS |
| Cierres simultáneos | 2 × 3 rondas | PASS: 1 éxito por ronda |
| Cierres simultáneos | 5 × 3 rondas | PASS: 1 éxito por ronda |
| Cierres simultáneos | 10 × 3 rondas | PASS: 1 éxito por ronda |
| Cierres simultáneos | 20 × 3 rondas | PASS: 1 éxito por ronda |
| Reintentos después del cierre | 1, 5 y 10 | PASS: todos 404, sin cambios |
| Importes concurrentes 750/700 | 1 carrera | PASS: persiste sólo el ganador |
| Pago contra cierre | 20 carreras | PASS: sólo estados coherentes |

En pago contra cierre sólo se aceptan dos estados:

1. El pago gana: existe un Payment, Order queda `completed`, la caja acumula una
   sola venta y el cierre incluye esa venta.
2. El cierre gana: no queda Payment, Order continúa `pending`, la caja no cambia,
   se responde 409 y no se emiten eventos de éxito.

No hubo pagos huérfanos, órdenes parcialmente completadas, ventas agregadas
después del cierre ni eventos Socket.IO falsos.

## Validaciones

### Backend

- `npm run db:test:validate`: PASS; test, localhost y `cafeteria_pos_test`.
- TypeScript de producción y pruebas: PASS.
- Lint: PASS con 0 errores y 213 advertencias heredadas.
- Unitarias: 219 PASS; 31 integraciones omitidas por el runner unitario.
- Integración MySQL: 31/31 PASS, repetida después del build.
- Prisma validate del esquema MySQL: PASS.
- Prisma generate: PASS.
- Build: PASS.
- `npm run verify:local`: PASS.

### Frontend

- TypeScript de aplicación y specs: PASS.
- Lint: PASS con 0 errores y 96 advertencias heredadas.
- Build Angular: PASS. El primer intento sin red sólo falló al inlinear Google
  Fonts; el mismo build terminó correctamente con acceso de red.
- Karma compiló la suite, pero ChromeHeadless no llegó a ejecutar pruebas porque
  su proceso GPU terminó con `exit_code=-1073741790` y bloqueos de caché en
  Windows. Es un bloqueo ambiental, no una aserción fallida; no se ocultó.

## Estado final de MySQL

- 14 tablas y 144 registros de aplicación, igual que la línea base.
- 0 cajas, pedidos o pagos temporales de estas pruebas.
- El usuario MySQL sólo tiene permisos sobre `cafeteria_pos_test`.
- Ninguna migración fue aplicada.

## Migraciones y deriva pendientes

`prisma migrate status --schema prisma/schema.mysql.prisma` identifica cuatro
migraciones en disco y dos todavía no aplicadas:

- `20260201003637_init`: histórica de SQLite; riesgo alto si se intenta aplicar
  contra MySQL sin reconciliar el historial.
- `20260730190000_inventory_recipes_core`: cambio previo de recetas/inventario;
  debe revisarse en una etapa separada.

El esquema MySQL declara `OrderItem.orderId` como único, mientras la base y la
migración activa usan un índice no único. No afectó estas pruebas, pero ejecutar
`db push` podría imponer una restricción incompatible. No se corrigió.

El archivo histórico `prisma/schema.prisma` aún declara SQLite y por eso
`migrate status` sobre ese archivo devuelve P3019. El esquema activo usado por
build y postinstall es `schema.mysql.prisma`.

## Pendientes fuera de alcance

- La creación de gastos asociados a caja continúa siendo no atómica y sin clave
  de idempotencia. No se modificó.
- Reconciliar migraciones pendientes y la deriva de `OrderItem`.
- Resolver el entorno ChromeHeadless de Windows.
- Revisar por separado la política de versionado de `backend/dist`.

## Reversión

Commits locales de esta corrección:

- `fix: hace atomico el cierre de caja`
- `test: valida concurrencia entre pago y cierre de caja`

Una vez creados los commits, revertirlos en orden inverso con:

```powershell
git revert <commit-pruebas>
git revert <commit-fix>
```

No usar `git reset --hard`, porque existen cambios frontend previos que deben
conservarse.

## Resultado de aprobación

| Criterio | Resultado |
| --- | --- |
| Cierre normal | PASS |
| 2 cierres | PASS |
| 5 cierres | PASS |
| 10 cierres | PASS |
| 20 cierres | PASS |
| Cierre repetido | PASS |
| No sobrescritura | PASS |
| Pago vs cierre | PASS |
| Rollback | PASS |
| Integridad MySQL | PASS |
