# Etapa 9: ampliacion de pruebas

Fecha: 2026-07-20. Rama: `test/etapa-9-pruebas`.

## Linea base

- Frontend: 19 pruebas.
- Backend: 61 pruebas en 11 archivos.
- TypeScript, builds, Prisma y `/api/health`: correctos.
- No existe una base MySQL aislada confirmada.
- El smoke test anterior creaba datos y no eliminaba el pedido.

## Inventario y resultado

| Flujo | Cobertura final | Tipo | Limitacion principal |
|---|---|---|---|
| Autenticacion | Parcial alta | Servicio, JWT, middleware e interceptor | Usuario inactivo no se rechaza explicitamente en login |
| Usuarios | Parcial alta | Controlador y rutas con mocks | Sin integracion MySQL |
| Pedidos | Parcial alta | Servicio, controlador, validacion, Socket.IO y frontend | Transacciones reales no ejecutadas |
| Pagos | Parcial alta | Servicio e idempotencia simulada | Sin concurrencia ni Mercado Pago real |
| Caja | Parcial alta | Controlador y calculos con mocks | Dos aperturas simultaneas y `_max.id + 1` pendientes |
| Inventario | Parcial alta | Insumos y movimientos transaccionales simulados | Actualizaciones perdidas reales pendientes |
| Productos | Parcial | Controlador con mocks | Precio negativo no tiene validacion especifica |
| Promociones | Parcial | Normalizacion y controlador con mocks | Porcentajes y descuentos invalidos no se rechazan explicitamente |
| Gastos | Parcial alta | Controlador y transaccion simulada | Sin persistencia real |
| Reportes | Baja | Pagos por rango y utilidades indirectas | Componente grande sin pruebas de datos derivados |
| Socket.IO | Parcial alta | Seguridad backend y ciclo de vida frontend | Sin servidor Socket.IO integral |
| Errores y validacion | Parcial alta | Middlewares y rutas | Faltan JSON malformado y body grande de extremo a extremo |
| Rendimiento | Cubierta | POS, Settings, trackBy y selects Prisma | Sin medicion de navegador integral |
| Smoke test | Preparado, no ejecutado | Guardas unitarias y script | Requiere infraestructura MySQL aislada |

## Pruebas agregadas

Backend:

- Pedidos: pedido vacio, creacion pendiente, eventos por sala, fallo transaccional, pago requerido, cancelacion y eliminacion inexistente.
- Pagos: pedido inexistente, pago duplicado, reparacion de estado, creacion y rango inclusivo.
- Caja: consulta, validacion, conflicto, apertura, cierre, acumuladores y persistencia fallida.
- Inventario: insumos, categoria, entrada, salida, stock insuficiente, transaccion y rango.
- Productos y promociones: listado, CRUD basico, normalizacion y error de servicio.
- Gastos: rango, validacion, caja abierta, acumulado, eliminacion y fallo transaccional.
- Usuarios: conflictos y recursos inexistentes.
- Smoke: rechazo de produccion, URLs inconsistentes, base sin marcador y coincidencia con produccion.

Frontend:

- Interceptor: encabezado Bearer, logout ante 401 y excepcion del login.
- Pedidos pendientes: carga HTTP, actualizacion local, completar y error de cancelacion.
- Socket.IO: desconexion, ausencia de JWT y conexion ya activa.
- Se conservan las pruebas de rendimiento de POS, Settings y trackBy.

## Smoke test seguro

`backend/scripts/smoke-api.js` ahora requiere simultaneamente:

- `NODE_ENV` distinto de `production`.
- `ALLOW_DESTRUCTIVE_TESTS=true`.
- `DATABASE_URL` igual a `TEST_DATABASE_URL`.
- Nombre de base con marcador `test`, `testing`, `qa` o `ci`.
- URL distinta de `PRODUCTION_DATABASE_URL` cuando esta se proporciona.
- `TEST_BASE_URL` y credenciales de administrador exclusivas de pruebas.

El flujo inicia sesion, propaga JWT, crea un usuario temporal, inicia sesion con el, crea y consulta un pedido, y en `finally` elimina pedido y usuario usando el token administrador. No imprime tokens, contraseñas ni URLs de base.

No se ejecuto el flujo porque no existe una base MySQL aislada confirmada. Solo se comprobo que se bloquea en produccion y se probaron sus guardas como funciones puras.

## Cobertura

Frontend con `npm test -- --watch=false --code-coverage`:

| Metrica | Resultado |
|---|---:|
| Statements | 10.48% (159/1516) |
| Branches | 9.57% (65/679) |
| Functions | 13.31% (43/323) |
| Lines | 10.81% (152/1405) |

La cifra global permanece baja por POS, reportes, productos, caja e inventario visual. No se persiguio un porcentaje artificial ni se probaron detalles decorativos.

Backend no tiene `@vitest/coverage-v8` instalado. No se agrego la dependencia porque el objetivo era proteger comportamiento y ya existen conteos claros de pruebas por flujo.

## Riesgos detectados sin corregir

1. `AuthService.login` no comprueba directamente `active: false`.
2. Productos acepta precios negativos si llegan al controlador.
3. Promociones no valida todos los rangos de descuento.
4. Varios controladores devuelven mensajes de excepcion directamente en errores 500.
5. `_max.id + 1` sigue expuesto a concurrencia.
6. No hay cierre controlado completo del backend.
7. Reportes y componentes Angular grandes tienen cobertura baja.

Corregirlos requiere etapas separadas de seguridad, validacion, concurrencia o calidad; no se modificaron contratos para facilitar pruebas.

## Base MySQL aislada pendiente

La preparacion segura se describe en `docs/pruebas-mysql-aislada.md`. No se incluye ningun script automatico de `db push`, `migrate reset`, truncado o seed destructivo.

Hasta disponer de esa base, se consideran pendientes:

- Atomicidad y rollback reales.
- Dos aperturas de caja simultaneas.
- Pagos concurrentes.
- Generacion manual de IDs.
- Actualizaciones perdidas de inventario.
- Smoke test completo.

## Reversion

Los commits de la etapa deben revertirse en orden inverso mediante `git revert`. No usar `git reset --hard` si existen cambios locales.
