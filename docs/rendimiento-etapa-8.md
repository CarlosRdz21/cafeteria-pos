# Rendimiento: etapa 8

Fecha de revision: 2026-07-18. Rama: `perf/etapa-8-rendimiento`.

Este documento registra mediciones y recomendaciones. No contiene credenciales, no modifica el esquema Prisma y ninguna sentencia SQL propuesta fue ejecutada.

## Linea base

| Indicador | Resultado inicial | Metodo |
|---|---:|---|
| Build frontend | 18.9 s | Tiempo total de `npm run build` |
| Bundle inicial | 604.39 kB sin comprimir / 142.23 kB estimados | Salida de Angular |
| Build backend | 4.1 s | Tiempo total de `npm run build` |
| Inicio backend hasta health | 1.11 s | Proceso local y primera respuesta correcta |
| `/api/health` | 11.1 ms promedio | Cinco solicitudes locales: 11.63, 10.00, 11.46, 11.42 y 10.99 ms |
| Pruebas frontend | 13/13 | `npm test -- --watch=false` |
| Pruebas backend | 59/59 | `npm test -- --watch=false` |

El build frontend necesita acceso a `fonts.googleapis.com` para insertar fuentes. El primer intento aislado sin red fallo por ese recurso externo; al permitir la misma compilacion con red, termino correctamente.

## Inventario de hallazgos

| Hallazgo | Archivo o endpoint | Evidencia | Impacto | Riesgo | Accion |
|---|---|---|---|---|---|
| Sondeo continuo del filtro POS | `pos.component.ts` | `setInterval` cada 100 ms llamaba `filterProducts` incluso sin interaccion | Alto | Bajo | Sustituido por `ngModelChange` |
| Recursos vivos tras destruir Configuracion | `settings.component.ts` | Suscripcion directa a `connected$` y temporizador no conservado | Medio | Bajo | Liberacion en `ngOnDestroy` |
| Consultas de existencia con columnas innecesarias | `users.controller.ts` | Cuatro `findFirst`/`findUnique` solo comprobaban existencia | Medio | Bajo | `select: { id: true }` |
| Recreacion de listas por eventos | Pedidos pendientes | No existia `trackBy`; el servicio reemplaza instancias al recibir cambios | Medio | Bajo | Claves estables por ID |
| Listados completos sin paginacion | Productos, usuarios, gastos, insumos, movimientos y promociones | `findMany` sin `take` como comportamiento predeterminado | Medio al crecer datos | Medio | Propuesta compatible pendiente |
| Ordenamientos sin indice compuesto | Pedidos y cajas | Filtro por estado mas orden por fecha | Medio al crecer datos | Medio | Indices propuestos, no ejecutados |
| Generacion manual de IDs | Caja, gastos, insumos, categorias y movimientos | Patron `_max.id + 1` | Alto bajo concurrencia | Alto | Migracion posterior; no modificar sin MySQL aislado |
| Cierre no controlado | `backend/src/server.ts` | No hay manejadores SIGINT/SIGTERM ni cierre explicito de HTTP, Socket.IO y Prisma | Medio en despliegues | Medio | Pendiente con prueba de ciclo de vida |
| Recurso grande sin referencia estatica encontrada | `placeholder.jpg` | 342,242 bytes y ninguna referencia localizada | Bajo | Medio al eliminar | Conservar hasta revisar datos dinamicos |
| Fuentes externas | `src/index.html` | Dos hojas de Google Fonts | Medio para builds sin red | Medio | Evaluar alojamiento local con aprobacion visual/licencia |

No se encontro evidencia de consultas Prisma esperadas dentro de ciclos, conexiones Prisma creadas por solicitud, listeners Socket.IO duplicados en el servicio compartido ni solicitudes HTTP identicas duplicadas en el mismo ciclo de vida. Prisma se exporta como una instancia unica desde `backend/src/config/prisma.ts`.

## Consultas Prisma revisadas

Las comprobaciones de usuario en crear, actualizar, validar duplicado y eliminar ahora solicitan solo `id`. La respuesta publica no cambia porque esos registros nunca se enviaban al cliente. Las operaciones de listado, creacion y actualizacion conservan `publicUserSelect`, que excluye la contraseña.

No se redujeron columnas de productos, pedidos, caja, gastos o inventario: sus consumidores utilizan estructuras amplias y no existe una base MySQL aislada para medir consultas representativas. Tampoco se encontro un N+1 confirmado.

## Listados revisados

| Recurso | Comportamiento actual | Decision |
|---|---|---|
| `GET /api/users` | Lista completa con columnas publicas | Conservar contrato |
| `GET /api/products` | Lista completa ordenada por categoria y nombre | Conservar; el POS consume el catalogo completo |
| `GET /api/orders` | Filtra por estado y carga items | Conservar; proponer paginacion solo para historicos |
| Pedidos pendientes | Filtrados por estado | Conservar por flujo operativo |
| `GET /api/expenses` | Filtros de fecha opcionales; sin limite predeterminado | Proponer paginacion optativa |
| `GET /api/supplies` | Lista completa | Conservar mientras el catalogo sea acotado |
| `GET /api/supply-movements` | Filtros opcionales; sin limite predeterminado | Prioridad de paginacion futura |
| `GET /api/promotions` | Lista completa | Conservar mientras el volumen sea bajo |
| `GET /api/cash-registers` | Historial limitado a 50 | Ya esta acotado |
| `GET /api/payments/reports` | Consulta por rango de fecha | Conservar |

La estrategia futura compatible debe mantener el resultado actual cuando no se envien parametros. Una primera iteracion puede aceptar `page` y `limit` opcionales, imponer un maximo solo cuando se solicite paginacion y actualizar el frontend en un commit separado. No se implemento para evitar cambiar los contratos de los listados.

## Indices MySQL propuestos

| Tabla | Campos | Consulta beneficiada | Beneficio esperado | Costo |
|---|---|---|---|---|
| `Order` | `status, createdAt` | Pedidos por estado ordenados por fecha | Evitar ordenar y recorrer estados no solicitados cuando crezca el historial | Escrituras y almacenamiento adicionales |
| `Payment` | `paidAt` | Reportes por rango y orden de fecha | Reducir exploracion completa en reportes | Escrituras y almacenamiento adicionales |
| `CashRegister` | `status, openedAt` | Buscar la caja abierta mas reciente | Localizacion ordenada del registro abierto | Escrituras y almacenamiento adicionales |

Sentencias candidatas, deliberadamente no ejecutadas:

```sql
CREATE INDEX idx_order_status_created_at
  ON `Order` (`status`, `createdAt`);

CREATE INDEX idx_payment_paid_at
  ON `Payment` (`paidAt`);

CREATE INDEX idx_cash_register_status_opened_at
  ON `CashRegister` (`status`, `openedAt`);
```

Antes de aprobarlas se debe comprobar `SHOW INDEX` para evitar duplicados y comparar planes sobre una copia representativa:

```sql
EXPLAIN SELECT * FROM `Order`
WHERE `status` = 'pending'
ORDER BY `createdAt` DESC;

EXPLAIN SELECT * FROM `Payment`
WHERE `paidAt` BETWEEN ? AND ?
ORDER BY `paidAt` DESC;

EXPLAIN SELECT * FROM `CashRegister`
WHERE `status` = 'open'
ORDER BY `openedAt` DESC
LIMIT 1;
```

La verificacion debe comparar `type`, `key`, `rows` y `Extra`, junto con latencia p50/p95 bajo carga representativa. El indice de pagos podria ser redundante si produccion ya tiene uno no reflejado en Prisma; esa es otra razon para no ejecutarlo automaticamente.

## Concurrencia, transacciones y ciclo de vida

Las operaciones delicadas de movimientos de inventario, eliminacion de gastos y operaciones principales de pedidos ya usan transacciones. No se modificaron.

El patron `_max.id + 1` puede asignar el mismo ID a dos solicitudes concurrentes. Resolverlo requiere dejar que MySQL use `AUTO_INCREMENT`, confirmar el estado real de las tablas y crear pruebas de integracion concurrentes. Aunque el esquema declara `autoincrement()`, varios controladores todavia envian el ID. Se conserva por ahora porque retirarlo es una migracion de comportamiento de alto riesgo.

El servidor no implementa cierre controlado. Una etapa futura debe cerrar, en orden, la aceptacion de HTTP, Socket.IO y `prisma.$disconnect()`, con proteccion para que el cierre se ejecute una sola vez y una prueba que confirme que el proceso termina. No se cambio en esta etapa para evitar alterar el ciclo de despliegue sin una prueba dedicada.

## Frontend, Socket.IO y recursos

- Todas las rutas Angular usan `loadComponent`; no se detecto una ruta pesada cargada de forma ansiosa.
- El bundle inicial se mantuvo en 604.39 kB. Los chunks lazy mas grandes son login (133.12 kB), reportes (96.10 kB), POS (95.12 kB mas chunks auxiliares) y productos (59.66 kB).
- El POS dejo de filtrar diez veces por segundo en reposo. La categoria y el texto ahora filtran al cambiar el dato.
- Configuracion cancela su suscripcion y su comprobacion diferida al destruirse.
- Pedidos pendientes conserva las tarjetas por `Order.id` y los renglones por `OrderItem.id`, con `productId` como respaldo para items aun no persistidos.
- `SocketService` es compartido, desconecta el socket previo antes de conectar y retira listeners al desconectar. No se cambio ningun nombre ni payload de evento.
- `placeholder.jpg` pesa 334.22 KiB; `Logo-Cafeteria.png`, 72.71 KiB; `logoCafeteria.png`, 18.21 KiB. Los dos logos tienen referencias activas. Se recomienda inspeccionar visualmente y verificar referencias dinamicas antes de comprimir o retirar el placeholder.
- Los logs localizados son de inicio, diagnostico MySQL, conexion de impresora y errores. No se encontro un log de alta frecuencia que justificara retirarlo.

## Mediciones posteriores y limitaciones

| Cambio | Antes | Despues | Alcance de la evidencia |
|---|---:|---:|---|
| Filtro POS en reposo | 10 ejecuciones/s | 0 ejecuciones/s; se ejecuta por evento | Deducido directamente del temporizador retirado y protegido por prueba funcional |
| Chunk POS principal | 95.15 kB | 95.12 kB | Build de produccion; diferencia no se interpreta como mejora relevante |
| Recursos de Configuracion | Sin liberacion | Suscripcion y temporizador liberados | Dos pruebas de destruccion |
| Chunk Configuracion | 11.50 kB | 11.89 kB | Costo de 0.39 kB por cierre explicito |
| Consultas de existencia de usuarios | Registro completo | Una columna (`id`) | Verificado por pruebas de argumentos Prisma; tiempo no medido |
| Identidad de pedidos | Por referencia | Por ID estable | Dos pruebas puras; tiempo de render no medido |
| Chunk pedidos pendientes | 18.46 kB | 18.77 kB | Costo de 0.31 kB por seguimiento estable |
| Bundle inicial | 604.39 kB | 604.39 kB | Sin cambio material |

No se midieron tiempos de consultas ni concurrencia porque la configuracion disponible apunta a una base remota y no se autorizo usar produccion. No se declara ninguna mejora porcentual de MySQL. Tampoco se hicieron pruebas manuales de escritura de pedidos, pagos, caja, gastos o inventario por la misma razon.

## Reversion

Cada grupo es independiente y puede revertirse con `git revert`, en orden inverso si se desea retirar toda la etapa:

```powershell
git revert 382cc2b
git revert 2c4a594
git revert 4217a5d
git revert 6a946e5
```

El commit de este documento debe revertirse primero cuando se conozca su hash. No usar `git reset --hard` sobre un arbol con trabajo local.
