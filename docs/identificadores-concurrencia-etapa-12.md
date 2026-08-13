# Identificadores, concurrencia e idempotencia — Etapa 12

## Alcance y decisión

Esta auditoría es estática. No se modificó el esquema Prisma, no se aplicaron
migraciones y no se ejecutó MySQL. Aunque el esquema declara
`@default(autoincrement())`, el código todavía envía algunos IDs calculados como
`_max.id + 1`. Retirar sólo una parte sin comprobar la estructura real y los
datos de una base aislada podría producir colisiones o diferencias entre
entornos.

## Generación manual de IDs

| Tabla/modelo | Archivo y operación | Riesgo de colisión | Alternativa recomendada |
|---|---|---:|---|
| `CashRegister` | `backend/src/modules/cash/cash-registers.controller.ts`, apertura | Alto | Omitir `id` y usar el `AUTO_INCREMENT` confirmado de MySQL |
| `Expense` | `backend/src/modules/expenses/expenses.controller.ts`, creación | Alto | Omitir `id` y dejar que Prisma/MySQL lo genere |
| `ProductSupply` | `backend/src/modules/inventory/supplies.controller.ts`, creación | Alto | Omitir `id` y dejar que Prisma/MySQL lo genere |
| `SupplyCategory` | `backend/src/modules/inventory/supply-categories.controller.ts`, creación | Alto | Omitir `id` y dejar que Prisma/MySQL lo genere |
| `SupplyMovement` | `backend/src/modules/inventory/supply-movements.controller.ts`, entrada y salida | Alto | Omitir `id` dentro de la transacción y usar el valor generado |
| `ProductCategory.sortOrder` | `backend/src/modules/products/product-categories.controller.ts`, creación | Medio | No es un ID; definir una política de orden o tolerar empates explícitamente |

Dos solicitudes pueden leer el mismo máximo antes de que alguna inserte. Las
restricciones de clave primaria evitarían corrupción silenciosa, pero una de las
operaciones fallaría; sin la restricción correcta, el resultado sería aún más
riesgoso.

## Plan de migración seguro

1. Crear una copia representativa en MySQL aislado y confirmar con
   `SHOW CREATE TABLE` que cada ID de la tabla real usa `AUTO_INCREMENT`.
2. Comparar `MAX(id)` con el contador de MySQL y corregir el contador sólo en la
   base aislada si estuviera atrasado.
3. Agregar pruebas concurrentes que creen, como mínimo, 20 registros por modelo
   y comprueben IDs únicos, relaciones válidas y ausencia de errores.
4. Retirar el campo `id` de una sola operación por commit, sin cambiar el tipo de
   ID ni la respuesta pública.
5. Ejecutar pruebas de API, impresión y reportes tras cada modelo.
6. Desplegar en una ventana controlada, observando conflictos y errores Prisma.

No se recomienda UUID en este proyecto: los consumidores actuales manejan IDs
numéricos, MySQL ya ofrece generación atómica y cambiar el tipo afectaría
contratos, relaciones, impresión y reportes.

### Compatibilidad e impacto

- Las respuestas seguirían devolviendo el mismo `id: number`.
- `Expense.cashRegisterId`, `SupplyMovement.supplyId` y las demás relaciones no
  cambian; deben probarse con los IDs retornados por la inserción.
- El frontend no debería calcular ni anticipar IDs.
- Tickets y reportes deben seguir mostrando el ID retornado por la API.
- Las restricciones primarias y foráneas existentes deben conservarse.

### Rollback

Cada modelo debe migrarse en un commit independiente. El rollback de código
consiste en `git revert <commit>`; si hubiera una migración de base, debe tener
un script inverso revisado y respaldos verificados. Nunca reducir el contador ni
reasignar IDs existentes durante el rollback.

## Riesgos de concurrencia e idempotencia

| Flujo | Evidencia actual | Riesgo | Solución duradera propuesta |
|---|---|---:|---|
| Pago de pedido | `findFirst(orderId)` seguido de `payment.create` | Alto | Restricción única por operación/pedido según regla de negocio, transacción y clave idempotente persistida |
| Apertura de caja | `findFirst(status='open')` seguido de `create` | Alto | Restricción o registro singleton transaccional y bloqueo de fila |
| Cierre de caja | Lectura de caja abierta seguida de actualización | Alto | Actualización condicional `status='open'` y comprobar filas afectadas |
| Finalización de pedido | Se lee el estado antes de registrar pago y venta | Alto | Transacción única, transición condicional y clave idempotente |
| Acumulados de caja | Algunas rutas usan incrementos atómicos; gastos hacen read-modify-write | Alto | Incrementos atómicos dentro de la misma transacción del gasto |
| Movimiento de inventario | Lee stock y luego actualiza su valor | Alto | Update condicional/lock de fila dentro de transacción y comprobar stock |
| IDs manuales | `_max.id + 1` | Alto | Generación atómica de MySQL |
| Doble clic | Checkout ya usa `processing`; otros formularios no son uniformes | Medio | Guardas locales mejoran UX, pero la garantía debe residir en la base/API |

Una guarda en memoria del servidor no sería una solución definitiva: se pierde
al reiniciar y no se comparte entre varias instancias. Las claves idempotentes
deben persistirse y asociarse al usuario, operación y resultado.

## Pruebas pendientes en MySQL aislado

- Dos aperturas simultáneas deben dejar exactamente una caja abierta.
- Dos finalizaciones del mismo pedido deben dejar un pago y un solo incremento
  de caja.
- Dos salidas simultáneas no deben producir stock negativo.
- Un reintento con la misma clave idempotente debe devolver el resultado previo.
- Creaciones concurrentes deben producir IDs distintos y relaciones correctas.

Estas pruebas no se ejecutaron en la Etapa 12 porque no existe una base MySQL
aislada confirmada. El código crítico de concurrencia no fue modificado.
