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

---

## Reejecución read-only — 2026-09-27

Esta sección sustituye únicamente la fotografía operativa anterior como
resultado vigente. La evidencia previa se conserva arriba como trazabilidad.
Snapshot según el reloj MariaDB: `2026-09-27 19:49:02.465`.

Resultado: **NO-GO**. La producción se consultó exclusivamente mediante
operaciones de lectura dentro de `START TRANSACTION READ ONLY`; todos los lotes
terminaron con `ROLLBACK`. No se corrigió ningún dato, no se ejecutó Prisma y no
se modificó infraestructura.

### Identidad y aislamiento

- Rama: `test/integridad-contable-pos`.
- Commit candidato al iniciar: `b2cd2885c2cb5654c12bbe404b88e88e0cebdcd3`.
- Motor remoto: MariaDB `11.8.9-MariaDB-log`.
- Destino verificado antes de consultar: base productiva remota Hostinger en el
  puerto 3306; no corresponde a localhost, test, clones ni `restore_verify`.
- La credencial provino de un archivo local ignorado por Git. No se documentan
  usuario, contraseña ni cadena de conexión.
- La cuenta conserva `ALL PRIVILEGES` limitados a esa base. No cumple mínimo
  privilegio y sigue siendo un bloqueo, aunque no se utilizó su capacidad de
  escritura.

El runbook auditado contiene 51 sentencias y sólo usa `SET`, `START`, `SELECT`,
`SHOW`, `PREPARE`, `EXECUTE`, `DEALLOCATE` y `ROLLBACK`. Se detectaron cero
sentencias prohibidas. La salida tuvo 11,674 bytes y SHA-256
`3e82f4763bd196e30c5d3431459e10847ec010722fde423a41b1b6ef2f3d876c`; no se
guardó una copia con datos productivos.

### Snapshot actual

| Entidad | Filas | Suma relevante |
| --- | ---: | ---: |
| Order | 1710 | $256,743.00 |
| OrderItem | 3459 | $256,743.00 |
| Payment | 1633 | $239,943.00 |
| Expense | 579 | $138,266.40 |
| CashRegister | 171 | 0 abiertas |
| Product | 77 | — |
| User | 2 | — |
| Promotion | 2 | — |
| ProductSupply | 0 | — |
| SupplyCategory | 0 | — |
| SupplyMovement | 0 | — |
| PrinterSetting | 1 | — |

Estados: 1631 Orders completadas, 79 canceladas y ninguna pendiente; las 171
cajas están cerradas. Payments: 1220 en efectivo por `$173,437.00` y 413 con
tarjeta por `$66,506.00`.

Última actividad observada:

- Order 1736: `2026-09-26 18:21:35.058`, completada.
- Payment 1650 / Order 1729: `2026-09-26 18:47:39.214`, efectivo.
- Expense 582: `2026-09-26 23:39:56.732`, categoría Nómina.
- CashRegister 171: abierta `2026-09-26 13:52:29.607` y actualmente cerrada.

### Hallazgos vigentes

El único `orderId` con más de un Payment continúa siendo 1023. Sus Payments
953, 954 y 955 son de efectivo por `$190.00` cada uno. Order 1023 sigue
completada, con subtotal/total `$190.00`, y su único OrderItem suma y recalcula
`$190.00`. No aparecieron duplicados adicionales y no se realizó saneamiento.

CashRegister 96 permanece cerrada e intacta: `cashSales=$1,148.00`,
`cardSales=$160.00`, gastos `$0.00`, 12 transacciones, apertura
`2026-07-02 14:21:40.183` y cierre `2026-07-03 03:14:17.768`.

Los chequeos de OrderItem sin Order, Payment sin Order, Order completada sin
Payment, Payment para una Order no completada, Expense sin referencias válidas
y NULL inesperado en OrderItem regresaron cero casos.

Persiste el hallazgo **bloqueante** Payment 1455 / Order 1540:

- Order 1540 está completada y sus tres items suman/recalculan `$378.00`;
- la Order registra total `$378.00`, descuento `$0.00` y promociones;
- su único Payment, 1455, registra `$115.00` en efectivo;
- la diferencia no explicada es `$263.00`;
- es el único Payment cuyo importe difiere del total de su Order.

Este dato contradice la invariante contable del candidato, que registra
`Payment.amount = Order.total`. Requiere una auditoría forense separada y una
decisión explícita antes de planificar cualquier escritura productiva.

También existen 11 OrderItems históricos de 11 Orders que referencian los
`productId` 18 o 57, ya inexistentes. El candidato no define una foreign key
`OrderItem.productId → Product.id`; se clasifican como referencias históricas
informativas, no como incumplimiento de una FK esperada.

### Esquema y migraciones

- AUTO_INCREMENT críticos superiores a sus máximos: PASS.
- `Payment.orderId` es `int(11) NOT NULL` y sólo tiene índice no único; el
  UNIQUE pendiente fallaría por Order 1023.
- `Expense.idempotencyKey` todavía no existe ni tiene índice.
- Las FK críticas OrderItem→Order, Payment→Order, Expense→User y
  Expense→CashRegister están presentes.
- `_prisma_migrations` no existe en producción.
- `20260723135000_mysql_initial`: esquema físicamente equivalente; futura
  resolución como baseline, no ejecutar creación.
- `20260723153500_payment_order_unique`: no aplicada y bloqueada por Order 1023.
- `20260827211000_expense_idempotency`: no aplicada.
- `20260201003637_init`: histórica SQLite; no ejecutar en MySQL.
- `20260730190000_inventory_recipes_core`: no existe en el candidato ni en las
  rutas Git inspeccionadas; no inventar ni ejecutar.

Las tablas base de insumos existen pero están vacías. No se hallaron objetos
adicionales de recetas o ingredientes.

### Infraestructura, respaldo y control de escrituras

- Las URL opcionales de frontend/backend siguen siendo placeholders; frontend
  real, backend real, health, Node, CORS y Socket.IO continúan pendientes de
  confirmación manual.
- Mercado Pago no fue contactado y no se probaron cobros.
- El plan de backup está documentado; no se creó dump productivo en esta etapa.
- Sentencias de escritura, Prisma, saneamientos y migraciones: **0**.
- Deploys, reinicios, cambios de variables, DNS o proveedores: **0**.
- Producción modificada: **NO**.

### Bloqueos de salida

1. Auditar Payment 1455 / Order 1540 y resolver su discrepancia.
2. Resolver controladamente los duplicados de Order 1023 antes del UNIQUE.
3. Confirmar URL/proveedor reales, health, TLS, Node, CORS y Socket.IO.
4. Usar una cuenta temporal realmente limitada a lectura en futuras auditorías.
5. No iniciar 16B mientras estos bloqueos permanezcan.

**ETAPA 16A.2 BLOQUEADA — NO MIGRAR PRODUCCIÓN**

---

## Reejecución detenida por conexión TLS — 2026-09-27

Fecha/hora local del intento: `2026-09-27 22:21:54 -06:00`.

Resultado: **NO-GO**. La ejecución se detuvo antes de establecer una sesión SQL
porque el cliente MySQL 8 no pudo completar el handshake TLS con el servidor
MariaDB y devolvió `ERROR 2026 (HY000): SSL connection error`. Conforme a la
regla de detenerse ante cualquier fallo de conexión, no se cambió el modo SSL,
no se probó otro cliente y no se utilizó Prisma como vía alternativa.

### Auditoría del runbook

El archivo `docs/production-runbook/01-preflight-readonly.sql` contiene 52
sentencias:

| Tipo | Cantidad |
| --- | ---: |
| `SELECT` | 30 |
| `SHOW` | 10 |
| `SET` | 4 |
| `START TRANSACTION READ ONLY` | 1 |
| `PREPARE` | 2 |
| `EXECUTE` | 2 |
| `DEALLOCATE PREPARE` | 2 |
| `ROLLBACK` | 1 |

Sentencias `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP`, `TRUNCATE`
y `REPLACE`: **0**. No se detectaron `RENAME`, `GRANT`, `REVOKE`, `CALL`,
`LOAD DATA` ni `LOCK TABLES`.

### Destino sanitizado validado

- Host: `srv1102.hstgr.io`
- Puerto: `3306`
- Base: `u349605213_dulceAroma`
- Usuario: `u349605213_carlos`
- Archivo local de entorno: ignorado por Git; no se imprimió ni documentó su
  cadena de conexión.

Los cuatro componentes coincidieron exactamente con el destino autorizado.

### Alcance real del intento

- Sesión SQL establecida: **NO**.
- `START TRANSACTION READ ONLY` ejecutado: **NO**.
- Consultas `SELECT`/`SHOW` ejecutadas: **0**.
- `ROLLBACK` ejecutado: **NO APLICA**, porque no llegó a existir una sesión ni
  una transacción; no hubo nada que confirmar o revertir.
- Escrituras, Prisma, migraciones, saneamientos y reparaciones: **0**.
- Acciones en Render, Hostinger, DNS o Mercado Pago: **0**.
- Producción modificada: **NO**.

### Snapshot y hallazgos

No se obtuvo un snapshot nuevo. Los valores de las ejecuciones anteriores se
conservan sólo como evidencia histórica y no deben utilizarse como estado actual
de producción. Tampoco se revalidaron Order 1023, Payment 1455/Order 1540,
CashRegister, índices, `_prisma_migrations`, inventario, AUTO_INCREMENT ni
integridad financiera.

Clasificación conceptual corregida para esta ejecución:

- Order 1023: **BLOCKED / NOT CHECKED**.
- Payment UNIQUE: **BLOCKED**; la última evidencia histórica indicaba ausencia,
  pero no fue revalidado.
- Expense idempotency: **BLOCKED**; la última evidencia histórica indicaba
  ausencia, pero no fue revalidada.
- AUTO_INCREMENT: **BLOCKED / NOT CHECKED**.
- Integridad financiera: **BLOCKED**; no fue revalidada.

Estas clasificaciones no alteran los hallazgos históricos de las ejecuciones
anteriores ni afirman el estado actual de esos objetos.

El backend/Render se registra únicamente con el contexto manual proporcionado:
dominio y HTTPS confirmados, endpoints `/`, `/health` y `/api/health` operativos,
puerto 10000, `NODE_ENV=production` y los dos orígenes web exactos configurados.
No se realizó ninguna consulta HTTP en este intento.

### Decisión

El plan de backup permanece documentado, pero no se creó un backup y no se puede
autorizar 16B sin un preflight productivo actual. Antes de reintentar debe
existir una decisión humana explícita sobre el cliente y el modo TLS compatible,
manteniendo la conexión en `START TRANSACTION READ ONLY` y terminando con
`ROLLBACK`.

**ETAPA 16A.2 NO APROBADA — NO CONTINUAR A 16B**

### Diagnóstico TLS

Diagnóstico realizado sin autenticación MySQL y sin SQL:

- `where.exe mysql` y `where.exe mariadb`: no encontraron clientes en `PATH`.
- Cliente localizado directamente: Oracle MySQL Community Client 8.0.46 para
  Win64/x86_64.
- Ejecutable: `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`.
- Firma: Oracle America, Inc.; firma Authenticode válida.
- Biblioteca incluida: OpenSSL 3.5.5 (`libssl-3-x64.dll` y
  `libcrypto-3-x64.dll`).
- Cliente MariaDB local: no encontrado.
- La ayuda local confirma soporte para `--ssl-mode`, `--ssl-ca`,
  `--ssl-capath`, `--ssl-cert`, `--ssl-key`, `--ssl-cipher`, `--ssl-crl`,
  `--ssl-crlpath`, `--tls-version` y `--tls-ciphersuites`.
- Versiones TLS admitidas por este cliente: TLS 1.2 y TLS 1.3.
- La URL local no declara parámetros TLS; no fue modificada.

Destino sanitizado del intento fallido:

- Host: `srv1102.hstgr.io`.
- Puerto: `3306`.
- Base: `u349605213_dulceAroma`.
- Usuario: `u349605213_carlos`.
- Opción utilizada: `--ssl-mode=REQUIRED`.

`Test-NetConnection` confirmó `TcpTestSucceeded=True` por la dirección IPv6
resuelta para el host. Por tanto, existe alcance de red al puerto 3306. Dos
intentos posteriores de leer solamente el saludo inicial MySQL mediante
`TcpClient`, sin responder al saludo ni enviar credenciales, agotaron el timeout;
esto muestra comportamiento intermitente o diferente entre implementaciones de
cliente/ruta y debe considerarse al continuar el diagnóstico.

La fase del intento original se clasifica así:

1. Resolución y conectividad TCP: disponible en la prueba específica IPv6.
2. Negociación TLS: **falló** con error 2026.
3. Autenticación MySQL: no alcanzada.
4. Selección de base: no alcanzada.
5. Ejecución SQL: no alcanzada.

No existe evidencia para afirmar que el usuario o la contraseña sean
incorrectos. Como `--ssl-mode=REQUIRED` exige cifrado pero no valida la identidad
del certificado mediante una CA, la ausencia de una CA local no explica por sí
sola este error. La causa raíz probable es una incompatibilidad o configuración
de negociación TLS entre Oracle MySQL Client/OpenSSL y el endpoint MariaDB
(versión TLS, cifrados, soporte TLS publicado o ruta de red); el subtipo exacto
permanece sin confirmar.

Estrategias seguras, en orden:

1. Probar el cliente instalado manteniendo TLS obligatorio y restringiendo la
   negociación a TLS 1.2 para aislar una incompatibilidad con TLS 1.3.
2. Si falla, instalar manualmente y con autorización un cliente MariaDB moderno
   compatible con MariaDB 11.8, manteniendo TLS habilitado.
3. Obtener de Hostinger la CA y requisitos TLS oficiales y usar validación de
   certificado/hostname cuando estén disponibles.
4. No probar `ssl-mode=DISABLED` ni modificar `DATABASE_URL` sin una nueva
   autorización explícita.

Siguiente prueba mínima propuesta, **no ejecutada**:

```powershell
$env:MYSQL_PWD = '<cargada temporalmente desde el archivo local ignorado por Git>'
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' `
  --host=srv1102.hstgr.io `
  --port=3306 `
  --user=u349605213_carlos `
  --database=u349605213_dulceAroma `
  --ssl-mode=REQUIRED `
  --tls-version=TLSv1.2 `
  --batch --raw `
  --execute="START TRANSACTION READ ONLY; SELECT DATABASE(); SELECT CURRENT_USER(); SELECT VERSION(); ROLLBACK;"
Remove-Item Env:MYSQL_PWD
```

La contraseña deberá cargarse programáticamente desde el archivo local sin
imprimirla ni incluirla en la línea de comandos. La prueba mantiene TLS
obligatorio, restringe únicamente la versión a TLS 1.2, abre una transacción de
sólo lectura y termina con `ROLLBACK`. Requiere autorización humana antes de
ejecutarse.

---

## Evidencia actual de producción — preflight completo 2026-09-28

Snapshot según el reloj MariaDB: `2026-09-28 04:40:12.807`. Esta sección es la
evidencia productiva vigente y sustituye las clasificaciones `BLOCKED / NOT
CHECKED` de la reejecución que no logró conectarse. Los apartados anteriores se
conservan únicamente como trazabilidad histórica.

### Conexión y garantía read-only

- Destino sanitizado: `srv1102.hstgr.io:3306/u349605213_dulceAroma`.
- Usuario sanitizado: `u349605213_carlos@%`.
- Motor: MariaDB `11.8.9-MariaDB-log`.
- Cliente: Oracle MySQL Community Client 8.0.46.
- TLS: `--ssl-mode=REQUIRED --tls-version=TLSv1.2`.
- Runbook auditado inmediatamente antes de ejecutarse: 52 sentencias, con 30
  `SELECT`, 10 `SHOW`, 4 `SET`, 1 `START TRANSACTION READ ONLY`, 2 `PREPARE`,
  2 `EXECUTE`, 2 `DEALLOCATE` y 1 `ROLLBACK`; cero verbos destructivos.
- Código de salida del cliente: 0.
- `ROLLBACK`: ejecutado correctamente.
- `MYSQL_PWD`: eliminado en `finally` y confirmado ausente.
- Escrituras, Prisma, migraciones, saneamientos y reparaciones: 0.

La prueba anterior con `--ssl-mode=REQUIRED` fallaba cuando el cliente podía
negociar TLS 1.2 o 1.3. Restringirlo a TLS 1.2 resolvió la conexión; por ello la
causa más probable es una incompatibilidad de negociación TLS 1.3, aunque no se
realizaron pruebas adicionales para afirmarlo como causa definitiva.

### Snapshot actual

| Entidad | Filas | Suma relevante |
| --- | ---: | ---: |
| Order | 1710 | $256,743.00 |
| OrderItem | 3459 | $256,743.00 |
| Payment | 1633 | $239,943.00 |
| Expense | 579 | $138,266.40 |
| CashRegister | 171 | 0 abiertas |
| Product | 77 | — |
| User | 2 | — |
| Promotion | 2 | — |
| ProductCategory | NOT CHECKED | El runbook autorizado no incluye su conteo |
| ProductSupply | 0 | — |
| SupplyCategory | 0 | — |
| SupplyMovement | 0 | — |
| PrinterSetting | 1 | — |

Estados: 1631 Orders completadas y 79 canceladas; no existen Orders pendientes.
Las 171 cajas están cerradas. Payments: 1220 en efectivo por `$173,437.00` y
413 con tarjeta por `$66,506.00`.

Actividad más reciente observada:

- Order 1736: `2026-09-26 18:21:35.058`, completada.
- Payment 1650 / Order 1729: `2026-09-26 18:47:39.214`, efectivo.
- Expense 582: `2026-09-26 23:39:56.732`, categoría Nómina.
- CashRegister 171: abierta `2026-09-26 13:52:29.607`, cerrada
  `2026-09-27 02:58:43.405`.

No se agregó una consulta para `ProductCategory`: la autorización limitó la
ejecución al runbook existente. La tabla sí aparece físicamente como InnoDB con
`utf8mb4_unicode_ci`, pero su conteo actual queda fuera de esta fotografía.

### Payment duplicados y Order 1023

Existe exactamente un `orderId` con múltiples Payments:

| Order | Payments | Cantidad | Suma |
| ---: | --- | ---: | ---: |
| 1023 | 953, 954, 955 | 3 | $570.00 |

Order 1023 continúa completada, con subtotal y total de `$190.00`, descuento
`$0.00` y fecha `2026-07-02 15:37:20.542`. Su único OrderItem es el 4182:
producto 14, precio `$95.00`, cantidad 2 y subtotal `$190.00`; tanto la suma
almacenada como el recálculo `price × quantity` dan `$190.00`.

| Payment | Método | Importe | Fecha |
| ---: | --- | ---: | --- |
| 953 | cash | $190.00 | 2026-07-02 15:40:47.551 |
| 954 | cash | $190.00 | 2026-07-02 15:40:48.679 |
| 955 | cash | $190.00 | 2026-07-02 15:41:09.492 |

Clasificación: **CONFIRMED**. La evidencia coincide con el caso histórico: 953
es el candidato a conservar y 954/955 siguen siendo duplicados candidatos al
saneamiento controlado de 16B. No se eliminó ni modificó ninguno.

CashRegister 96 permanece cerrada e intacta: apertura
`2026-07-02 14:21:40.183`, cierre `2026-07-03 03:14:17.768`, monto inicial
`$170.00`, cierre `$1,345.00`, esperado `$1,318.00`, diferencia `$27.00`,
cashSales `$1,148.00`, cardSales `$160.00`, gastos `$0.00` y 12 transacciones.
El esquema no contiene una relación directa Payment/Order → CashRegister; su
asociación con el caso 1023 continúa siendo evidencia histórica/operativa, no
una FK comprobable por el runbook.

### Integridad financiera y referencial

Regresaron cero casos para:

- OrderItem sin Order;
- Payment sin Order;
- Order completada sin Payment;
- Payment para una Order no completada;
- Expense con referencia inválida a User;
- Expense con referencia inválida a CashRegister;
- NULL inesperado en campos obligatorios de OrderItem;
- Payment cuyo importe difiere del total de su Order, excluyendo exactamente la
  excepción histórica 1540/1455.

La huella exacta de Order 1540, Payment 1455 y CashRegister 150 devolvió
`PASS_KNOWN_EXCEPTION`. No cambió respecto de la auditoría forense y regresión
aprobadas en 16A.3/16A.4.

Persisten 11 OrderItems históricos cuyo `productId` ya no existe. El candidato
no modela una FK `OrderItem.productId → Product.id`; se mantienen como referencias
históricas informativas, no como incumplimiento de una FK esperada.

La duplicación 1023 implica por sí misma que `SUM(Payment)` de esa Order excede
su total. El runbook no contiene una reconciliación fila por fila de todas las
Orders contra la suma de sus OrderItems; sólo confirma igualdad de totales
globales (`$256,743.00`) y el recálculo específico de 1023. No se añadieron
consultas fuera de la autorización.

### Esquema, índices y foreign keys

- `Payment.orderId`: `int(11) NOT NULL`.
- Índice actual: `Payment_orderId_idx`, BTREE normal (`Non_unique=1`).
- UNIQUE `Payment_orderId_key`: **ABSENT**.
- FK `Payment_orderId_fkey`: presente hacia `Order.id`, con cascade en update y
  delete.
- `Expense.idempotencyKey`: **ABSENT**; no existe columna ni índice.
- FK presentes: OrderItem→Order, Payment→Order, Expense→User y
  Expense→CashRegister.
- ProductCategory existe, pero su conteo no se consultó.

### Prisma e inventario

`_prisma_migrations` está **ABSENT**. Clasificación: **DRIFT** controlado; el
esquema físico existe sin historial Prisma.

Migraciones presentes localmente:

| Migración | Estado respecto de producción |
| --- | --- |
| `20260723135000_mysql_initial` | Estructuras base físicamente presentes; futura candidata a baseline, no ejecutar como creación |
| `20260723153500_payment_order_unique` | No aplicada; actualmente bloqueada por Payments 953/954/955 |
| `20260827211000_expense_idempotency` | No aplicada; columna e índice ausentes |

`20260201003637_init` y `20260730190000_inventory_recipes_core` no existen en el
directorio local activo. No deben inventarse ni ejecutarse. Las tablas
ProductSupply, SupplyCategory y SupplyMovement existen, están vacías y no se
hallaron objetos adicionales con nombres de recipe/ingredient/inventory.
Clasificación inventory/recipes: **PARTIAL** — existe la base de insumos, pero
no existe un modelo/migración de recetas en este candidato.

### LONGTEXT/JSON, AUTO_INCREMENT y charset

Los campos Prisma `Json` inspeccionados aparecen físicamente como `LONGTEXT`;
los `SHOW CREATE` de Order y Payment incluyen `CHECK(json_valid(...))`,
representación esperable de JSON en MariaDB. No se autorizó ni realizó ninguna
conversión.

Todos los AUTO_INCREMENT auditados están por encima de `MAX(id)`:

| Tabla | Siguiente | MAX(id) | Estado |
| --- | ---: | ---: | --- |
| CashRegister | 172 | 171 | PASS |
| Expense | 583 | 582 | PASS |
| Order | 1737 | 1736 | PASS |
| Payment | 1651 | 1650 | PASS |
| Product | 83 | 82 | PASS |
| User | 12 | 9 | PASS |

Base y 13 tablas: `utf8mb4` / `utf8mb4_unicode_ci`, motor InnoDB.

### Backend, backup y decisión

Se registra la evidencia manual proporcionada, sin consultar ni cambiar Render:
backend `https://api.dulcearomacafeteria.com`, HTTPS/custom domain/certificado y
`/`, `/health`, `/api/health` en PASS; puerto 10000, `NODE_ENV=production` y los
dos orígenes web productivos configurados.

El procedimiento de backup contempla `mysqldump --single-transaction`, rutinas,
triggers, eventos, checksum y restore test. El ejecutable local `mysqldump`
8.0.46 fue localizado; el backup final continúa reservado para la ventana 16B.
Plan: **READY**, sin haber creado un dump productivo en esta etapa.

No aparecieron inconsistencias nuevas. Los cambios necesarios de 16B permanecen
acotados y explícitos: backup final, baseline controlado, saneamiento protegido
de 1023, UNIQUE de Payment, idempotencia de Expense y reconciliación posterior.
El preflight queda aprobado para **preparar** 16B, pero no autoriza ejecutarla.

**ETAPA 16A.2 APROBADA — LISTO PARA PREPARAR ETAPA 16B**
