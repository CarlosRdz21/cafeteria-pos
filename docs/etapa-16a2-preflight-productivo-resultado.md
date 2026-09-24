# Etapa 16A.2 — resultado del preflight productivo read-only

Fecha de ejecución: 2026-09-23 (America/Mexico_City). Snapshot de base según el
reloj MariaDB: `2026-09-24 00:26:06.756`.

Resultado: **NO-GO**. Producción fue consultada exclusivamente mediante
`SELECT`, `SHOW` y metadata dentro de `START TRANSACTION READ ONLY`, finalizando
con `ROLLBACK`. No se corrigió ningún hallazgo.

## Identidad y seguridad de acceso

- Rama: `test/integridad-contable-pos`.
- Commit candidato inicial: `c20c4dd109454ade63e7e31a585dd01961f24d4f`.
- Motor remoto: MariaDB `11.8.9`.
- Destino confirmado: host remoto Hostinger, puerto 3306 y base productiva; no
  coincide con localhost, test, los clones ni `restore_verify`.
- La credencial se leyó de `backend/.env.production-readonly.local`, archivo
  confirmado como ignorado por Git.
- La cuenta no es de mínimo privilegio: tiene `ALL PRIVILEGES` limitados a la
  base productiva. No se utilizó ninguna capacidad de escritura. Antes de 16B se
  recomienda crear manualmente una cuenta `SELECT`/read-only.
- Una consulta a `information_schema.innodb_trx` para comprobar el indicador
  interno read-only fue rechazada por falta del privilegio global `PROCESS`.
  Esto no se intentó subsanar. El servidor sí aceptó `START TRANSACTION READ
  ONLY`; todos los lotes exitosos terminaron en `ROLLBACK`. El lote rechazado
  se cerró con la conexión, sin ejecutar ni confirmar ninguna escritura.

El runbook auditado contiene 51 sentencias de los tipos `SET`, `START`,
`SELECT`, `SHOW`, `PREPARE`, `EXECUTE`, `DEALLOCATE` y `ROLLBACK`. No contiene
sentencias de escritura.

## Snapshot productivo 16A.2

| Entidad | Filas | Suma relevante |
| --- | ---: | ---: |
| Order | 1678 | $250,877.00 |
| OrderItem | 3382 | $250,877.00 |
| Payment | 1600 | $233,927.00 |
| Expense | 566 | $137,069.40 |
| CashRegister | 168 | 1 abierta |
| Product | 77 | — |
| User | 2 | — |
| Promotion | 2 | — |
| ProductSupply | 0 | — |
| SupplyCategory | 0 | — |
| SupplyMovement | 0 | — |
| PrinterSetting | 1 | — |

Estados: 1598 Orders completadas, 79 canceladas y 1 pendiente; 167 cajas cerradas
y 1 abierta. Payments: 1196 efectivo por `$168,741.00` y 404 tarjeta por
`$65,186.00`.

## Última actividad

- Order 1704: `2026-09-24 00:17:08.344`, pendiente.
- Payment 1617 / Order 1703: `2026-09-23 23:16:50.523`, efectivo.
- Expense 569: `2026-09-24 00:17:14.416`, categoría Insumos.
- CashRegister 168: abierta desde `2026-09-23 14:13:37.005`.

El `userRef` de la caja abierta fue comprobado, pero se omite de este documento
para no versionar PII. La caja no fue cerrada ni modificada. Antes de una futura
ventana 16B debe cerrarse por el flujo normal o posponerse el mantenimiento.

## Payment y Order 1023

El único `orderId` con más de un Payment continúa siendo 1023:

| Payment | Método | Importe |
| ---: | --- | ---: |
| 953 | cash | $190.00 |
| 954 | cash | $190.00 |
| 955 | cash | $190.00 |

Order 1023 sigue completada con subtotal/total `$190.00`. Su único OrderItem
suma y recalcula `$190.00`. Clasificación: caso histórico A, sin duplicados
nuevos. **El saneamiento 16B continúa siendo necesario**, pero no se ejecutó.

CashRegister 96 permanece cerrada y coincide con la evidencia de Etapa 15:
`cashSales=$1,148.00`, `cardSales=$160.00`, gastos `$0.00`, 12 transacciones,
apertura `2026-07-02 14:21:40.183` y cierre
`2026-07-03 03:14:17.768`. No fue modificada.

## Integridad financiera

Conteos correctos en cero:

- OrderItem sin Order;
- Payment sin Order;
- Order completada sin Payment;
- Payment asociado a Order no completada;
- Expense sin User cuando `userId` está presente;
- Expense sin CashRegister cuando `cashRegisterId` está presente;
- OrderItem con NULL en campos obligatorios.

Hallazgo **bloqueante** adicional: Payment 1455 / Order 1540.

- Order 1540 está completada y sus tres items suman/recalculan `$378.00`.
- La Order registra total `$378.00`, descuento `$0.00` y promociones presentes.
- Su único Payment, 1455, registra `$115.00` en efectivo.
- Diferencia no explicada: `$263.00`.
- Es el único Payment actual cuyo importe difiere del total de su Order.
- El código candidato registra `Payment.amount = Order.total`, por lo que este
  dato histórico contradice la invariante contable esperada.

No se modificó ni se propuso automáticamente una corrección. Este hallazgo
activa la condición NO-GO por inconsistencia financiera crítica y requiere una
auditoría forense separada antes de 16B.

Existen además 11 OrderItems históricos, pertenecientes a 11 Orders, cuyos
`productId` 18 o 57 ya no existen. Afectan operaciones entre abril y julio de
2026 con estados completado/cancelado. El esquema candidato no define una
foreign key `OrderItem.productId → Product.id`, por lo que se clasifican como
referencias históricas informativas y no como drift de una FK esperada.

## Esquema, índices y foreign keys

- Base y las 13 tablas: `utf8mb4` / `utf8mb4_unicode_ci`, InnoDB.
- Todos los AUTO_INCREMENT revisados (`Order`, `Payment`, `Expense`,
  `CashRegister`, `Product`, `User`) son superiores a su máximo ID: PASS.
- `Payment.orderId` tiene un índice BTREE normal `Payment_orderId_idx`; no hay
  UNIQUE. La migración UNIQUE sigue pendiente y actualmente fallaría por 1023.
- `Expense.idempotencyKey` no existe y no tiene índice. La migración de
  idempotencia sigue pendiente.
- Foreign keys críticas presentes: OrderItem→Order, Payment→Order,
  Expense→User y Expense→CashRegister. Coinciden con el esquema candidato.
- Order y CashRegister no requieren foreign keys en el candidato.
- Las columnas Prisma `Json` aparecen físicamente como `LONGTEXT` con
  `CHECK(json_valid(...))`, representación normal de JSON en MariaDB. Se
  clasifica como drift tolerable; no se debe convertir automáticamente.

## Prisma y migraciones

`_prisma_migrations` no existe en producción. Clasificación contra el directorio
activo:

| Migración | Clasificación read-only |
| --- | --- |
| `20260723135000_mysql_initial` | ESQUEMA YA EQUIVALENTE; candidata a línea base futura, no ejecutar como creación |
| `20260723153500_payment_order_unique` | NO APLICADA; bloqueada por Payments 953/954/955 |
| `20260827211000_expense_idempotency` | NO APLICADA |
| `20260201003637_init` | Migración SQLite histórica eliminada; NO DEBE EJECUTARSE en MySQL |
| `20260730190000_inventory_recipes_core` | No existe en el candidato ni en rutas históricas inspeccionadas; NO DEBE INVENTARSE NI EJECUTARSE |

Producción contiene `ProductSupply`, `SupplyCategory` y `SupplyMovement`, todos
vacíos, con estructura de la línea base MySQL. No existen objetos con nombres de
recipe/ingredient/inventory adicionales. El esquema candidato tampoco modela
recetas ni incluye la migración indicada; por ello no hay una migración de
recetas que deba planificarse desde esta rama. Cualquier requisito distinto
necesita una etapa funcional separada.

El backend candidato no puede usar todas sus rutas contra el esquema actual sin
la migración de `Expense.idempotencyKey`. No fue desplegado ni conectado.

## Infraestructura pública

- Las variables opcionales `PRODUCTION_FRONTEND_URL` y
  `PRODUCTION_BACKEND_URL` conservan valores `example.com`; se consideran
  placeholders y no fueron consultadas.
- El dominio inferido únicamente de las URLs de callback locales,
  `https://www.dulcearomacafeteria.com`, responde HTTPS 200, pero muestra la
  página predeterminada de Hostinger, no la aplicación Angular.
- `/assets/runtime-config.js` en ese dominio responde 404. Por tanto, ese sitio
  no confirma el frontend ni permite descubrir el backend.
- Frontend real, backend real, health, Node remoto, CORS y Socket.IO:
  **PENDIENTE DE CONFIRMACIÓN MANUAL**.
- Un pendiente manual crítico impide 16B.
- Mercado Pago no fue contactado y no se realizaron cobros. Sus variables
  necesarias permanecen inventariadas desde el código local.

## Backup

El plan preparado cubre export completo de estructura/datos, timestamp, tamaño,
SHA-256, validación y restauración en una base desechable. No se creó dump ni
copia adicional de producción. El backup final continúa reservado para 16B con
mantenimiento activo.

## Control de escrituras

- INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/RENAME ejecutados: **0**.
- Comandos Prisma de escritura: **0**.
- Saneamientos y migraciones ejecutados: **0**.
- Deploys/reinicios/cambios de variables: **0**.
- Cambios en Render, Hostinger, DNS o Mercado Pago: **0**.
- Producción modificada: **NO**.

## Pendientes manuales y bloqueos

1. Auditar forensemente Payment 1455 / Order 1540 y definir una resolución
   explícita, separada de este preflight.
2. Confirmar URL/proveedor real del frontend y backend productivos.
3. Confirmar en el panel de Render versión Node, build/start commands, cantidad
   de instancias y existencia —sin revelar valores— de variables requeridas.
4. Comprobar health, TLS, CORS y Socket.IO cuando exista la URL real.
5. Sustituir la cuenta con `ALL PRIVILEGES` por una cuenta temporal de sólo
   lectura para cualquier inspección posterior.
6. Resolver la caja 168 mediante el flujo normal antes de iniciar mantenimiento.
7. No iniciar 16B mientras cualquiera de los puntos anteriores siga pendiente.

## Conclusión

La duplicación histórica permanece limitada a Order 1023 y CashRegister 96 está
intacta, pero la discrepancia Payment 1455/Order 1540 y la infraestructura no
confirmada impiden recomendar 16B.

**ETAPA 16A.2 BLOQUEADA — NO MIGRAR PRODUCCIÓN**
