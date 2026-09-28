# Etapa 16B.0 — Backup productivo final y verificación de restauración

## Estado

- Fecha local: 2026-09-27 (America/Mexico_City).
- Resultado final después de 16B.0-R3: **APROBADA**.
- Los bloqueos locales iniciales fueron resueltos mediante la creación manual de una base nueva y un grant limitado; la restauración y la reconciliación final pasaron.
- Producción modificada: **no**.
- Escrituras productivas: **0**.
- Etapa 16B.1: **no autorizada y no iniciada**.

## Objetivo y alcance

Se ejecutó la congelación operativa, el snapshot read-only inmediatamente anterior al backup, el dump completo mediante TLS 1.2, el cálculo de SHA-256 y la inspección estructural del artefacto. La verificación de restauración se detuvo antes de cualquier `CREATE` o `DROP` local porque no había un destino nuevo disponible para la cuenta local dedicada.

No se ejecutaron migraciones Prisma, saneamientos, cambios de esquema, despliegues ni operaciones Git de escritura.

## Congelación y destino productivo sanitizado

- Host productivo: `srv1102.hstgr.io`.
- Puerto: `3306`.
- Base: `u349605213_dulceAroma`.
- Usuario: identificado por el perfil read-only local; no se registra ningún secreto.
- Servidor: MariaDB `11.8.9-MariaDB-log`.
- Cajas abiertas: **0**.
- Congelación operativa: **PASS**.
- Transacción del snapshot: `START TRANSACTION READ ONLY` y `ROLLBACK`.

## Cliente y estrategia de backup

- Ejecutable: `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe`.
- Cliente: Oracle MySQL Community Client `8.0.46` para Win64.
- TLS: `--ssl-mode=REQUIRED --tls-version=TLSv1.2`.
- Consistencia: `--single-transaction --quick --skip-lock-tables`.
- Cobertura: estructura, datos, rutinas, triggers y eventos cuando existen y son accesibles.
- Compatibilidad adicional: `--hex-blob --default-character-set=utf8mb4 --no-tablespaces --set-gtid-purged=OFF --skip-column-statistics`.
- Todas las tablas verificadas previamente son InnoDB.
- Conexión degradada o sin TLS: no utilizada.

## PRE-BACKUP SNAPSHOT

| Métrica | Valor |
|---|---:|
| Order COUNT | 1710 |
| Order MAX(id) | 1736 |
| Order SUM(total) | 256743.00 |
| OrderItem COUNT | 3459 |
| OrderItem MAX(id) | 7335 |
| OrderItem SUM(subtotal) | 256743.00 |
| Payment COUNT | 1633 |
| Payment MAX(id) | 1650 |
| Payment SUM(amount) | 239943.00 |
| Expense COUNT | 579 |
| Expense MAX(id) | 582 |
| Expense SUM(amount) | 138266.40 |
| CashRegister COUNT | 171 |
| CashRegister MAX(id) | 171 |
| CashRegister abiertas | 0 |
| ProductCategory COUNT | 16 |
| ProductCategory MAX(id) | 17 |

Actividad más reciente observada en el snapshot:

- Order: id `1736`, fecha `2026-09-26 18:21:35.058`, estado `completed`.
- Payment: id `1650`, orderId `1729`, fecha `2026-09-26 18:47:39.214`, método `cash`.
- Expense: id `582`, fecha `2026-09-26 23:39:56.732`, categoría `Nómina`.

El snapshot terminó con `ROLLBACK`. No se ejecutaron escrituras.

## Artefacto de backup

- Nombre: `dulce_aroma_production_pre_16b_20260927_224955.sql`.
- Ruta local: `backups/dulce_aroma_production_pre_16b_20260927_224955.sql`.
- Tamaño: `10,363,867` bytes (`9.88 MiB`).
- SHA-256 inicial: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- SHA-256 al detener la etapa: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- Integridad del hash hasta el punto de detención: **MATCH**.
- Archivo ignorado por Git: **sí**.
- Backup conservado sin modificación: **sí**.

## Inspección segura del dump

Resultado: **PASS**.

- Existe y su tamaño es mayor que cero.
- Incluye marca coherente de finalización de `mysqldump` con fecha `2026-09-27 22:50:34`.
- No contiene `CREATE DATABASE` ni `USE`, por lo que no fija un destino de restauración.
- Contiene `CREATE TABLE` para las 13 tablas esperadas: `CashRegister`, `Expense`, `Order`, `OrderItem`, `Payment`, `PrinterSetting`, `Product`, `ProductCategory`, `ProductSupply`, `Promotion`, `SupplyCategory`, `SupplyMovement` y `User`.
- Contiene datos para las tablas con filas.
- `ProductSupply`, `SupplyCategory` y `SupplyMovement` no contienen bloques `INSERT`, coherente con el inventario vacío observado en el preflight.
- No se encontraron rutinas, triggers ni eventos definidos.
- No se encontró `_prisma_migrations`.
- El esquema del dump conserva `Payment(orderId) UNIQUE` ausente.
- El esquema del dump conserva `Expense.idempotencyKey` ausente.
- No se imprimieron filas ni datos sensibles durante la inspección.

## Verificación del destino local

Guard rail confirmado:

- RESTORE TARGET HOST: `127.0.0.1`.
- PRODUCTION HOST: `srv1102.hstgr.io`.
- RESTORE TARGET IS NOT PRODUCTION: **PASS**.
- Perfil local dedicado: ignorado por Git y usuario distinto de `root`.

La cuenta local dedicada no tiene privilegio global `CREATE`; por aislamiento sólo tiene permisos sobre estos nombres preexistentes:

- `cafeteria_pos_prod_clone`
- `cafeteria_pos_prod_clone_restore_verify`
- `cafeteria_pos_prod_clone_transaction_test`

Los dos posibles nombres temporales ya contienen evidencia de pruebas previas:

1. `cafeteria_pos_prod_clone_restore_verify` contiene 14 tablas, incluida `_prisma_migrations`, y métricas históricas de la etapa 15 (`Order=1602`, `Payment=1524`, `Expense=546`, `CashRegister=160`). Está documentada como restauración de prueba satisfactoria en `docs/etapa-15-ensayo-migracion-produccion.md`.
2. `cafeteria_pos_prod_clone_transaction_test` contiene 14 tablas y está documentada/empleada por las pruebas transaccionales de las etapas 15 y 16A.4.

No se borró, vació, sobrescribió ni modificó ninguna de esas bases. Tampoco se usó `root`, se ampliaron permisos ni se improvisó otra cuenta.

## Restore y reconciliación

- Base local nueva creada: **no**.
- Restore ejecutado: **no**.
- LOCAL RESTORE: **FAIL / BLOQUEADO ANTES DE ESCRIBIR**.
- Reconciliación producción vs restore: **no ejecutada**.
- Order 1023 en restore: **no verificada**.
- Order 1540 en restore: **no verificada**; la clasificación productiva previa permanece `PASS_KNOWN_EXCEPTION`, pero 16B.0 no la confirmó en un restore nuevo.
- AUTO_INCREMENT del restore: **no verificado**.

La detención cumple la regla del runbook: no destruir una base local existente importante y no cambiar a una estrategia más amplia o destructiva cuando falla la preparación del destino aislado.

## Riesgos y desbloqueo requerido

El archivo SQL tiene evidencia fuerte de integridad estructural, pero todavía no debe considerarse un punto de recuperación verificado porque falta demostrar una importación completa y reconciliar sus datos.

Para reanudar 16B.0 hace falta una decisión humana separada que proporcione una de estas condiciones, sin tocar producción:

- conceder a una cuenta local dedicada acceso a un nombre nuevo, por ejemplo `cafeteria_pos_pre16b_restore_verify`; o
- autorizar expresamente el reemplazo de una base temporal anterior después de decidir que su evidencia ya no necesita conservarse.

No se recomienda reutilizar silenciosamente las bases existentes.

## Rollback asset

El artefacto `backups/dulce_aroma_production_pre_16b_20260927_224955.sql` se conserva intacto con el SHA-256 indicado. Es un candidato a rollback, pero queda **pendiente de verificación de restauración** antes de aprobarlo como punto de recuperación confiable.

## Seguridad de credenciales y Git

- `MYSQL_PWD` eliminado después de cada operación: **PASS**.
- `backend/.env.production-readonly.local` ignorado por Git: **sí**.
- El archivo `.sql` no aparece en `git status --short`: **sí**.
- No se ejecutó `git add`, `commit`, `push`, `merge` ni `rebase`.
- Cambios previos/no relacionados permanecen intactos.

## Conclusión

**ETAPA 16B.0 NO APROBADA — NO CONTINUAR A 16B.1**

El bloqueo es exclusivamente local y preventivo. El backup existe, conserva su hash y producción no fue modificada, pero la restauración obligatoria aún no fue demostrada.

## Continuación 16B.0-R — 2026-09-27

Se reanudó exclusivamente la preparación de la verificación local del backup, sin conectarse a producción y sin repetir `mysqldump`.

### Verificación previa del artefacto

- Archivo: `dulce_aroma_production_pre_16b_20260927_224955.sql`.
- Existencia: **PASS**.
- Tamaño observado: `10,363,867` bytes.
- Tamaño esperado: `10,363,867` bytes.
- SHA-256 antes del restore: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- Coincidencia exacta: **PASS**.

### Guard rails del nuevo destino

- RESTORE HOST: `127.0.0.1`.
- RESTORE DATABASE seleccionada: `cafeteria_pos_pre16b_restore_20260927`.
- DATABASE EXISTED BEFORE: **NO**.
- PRODUCTION HOST: `srv1102.hstgr.io`.
- RESTORE TARGET IS LOCAL: **PASS**.
- RESTORE TARGET IS NOT PRODUCTION: **PASS**.
- No se cargaron credenciales productivas.

### Creación de la base local

Se ejecutó un único intento local autorizado de:

`CREATE DATABASE cafeteria_pos_pre16b_restore_20260927 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`

Resultado:

- Cliente: Oracle MySQL Community Client `8.0.46`.
- Exit code: `1`.
- Código MySQL: `1044`.
- Clase sanitizada: `ACCESS_DENIED`.
- LOCAL DATABASE CREATE: **FAIL**.
- La base existe después del intento: **NO**.
- Bases locales preexistentes modificadas: **0**.

La autorización operativa de 16B.0-R no cambia los privilegios internos de MySQL. La cuenta local dedicada continúa limitada a los nombres de bases de etapas anteriores y no dispone de `CREATE` para `cafeteria_pos_pre16b_restore_20260927`.

No se probó `root`, no se modificaron grants, no se reutilizó una base existente y no se intentó otra estrategia.

### Restore y reconciliación 16B.0-R

- Restore ejecutado: **no**.
- Restore exit code: **N/A — no iniciado**.
- Base parcialmente restaurada: **no**.
- Reconciliación: **no ejecutada**.
- Order 1023: **no verificada en restore**.
- CashRegister 96: **no verificada en restore**.
- Order 1540: **no verificada en restore**.
- Payment UNIQUE: **no verificado físicamente en restore**; el dump inspeccionado mantiene `ABSENT`.
- Expense idempotency: **no verificado físicamente en restore**; el dump inspeccionado mantiene `ABSENT`.
- `_prisma_migrations`: **no verificada físicamente en restore**; el dump inspeccionado mantiene `ABSENT`.
- AUTO_INCREMENT: **no verificado en restore**.

### Integridad y seguridad posteriores

- SHA-256 después del intento local: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- BACKUP HASH: **MATCH**.
- `MYSQL_PWD` eliminado: **PASS**.
- SQL ejecutado en producción: **0**.
- Escrituras en producción: **0**.

### Conclusión 16B.0-R

**ETAPA 16B.0 NO APROBADA — NO CONTINUAR A 16B.1**

Para reanudar se requiere que una persona con administración local conceda a la cuenta dedicada los permisos mínimos sobre el nombre nuevo elegido, o proporcione otra cuenta local autorizada para crear exclusivamente esa base. No se debe modificar producción.

## Diagnóstico de permisos locales para restore

### Alcance de 16B.0-R2

Diagnóstico exclusivamente read-only sobre la instancia MySQL de `localhost:3306`. No se cargaron credenciales productivas, no se intentó conectar a producción, no se creó ninguna base y no se ejecutó el restore.

El backup se validó una vez al iniciar el diagnóstico:

- SHA-256: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- Resultado: **MATCH**.

### Instancia local

- Producto/versión: MySQL Community Server `8.0.46`.
- Host configurado: `localhost`.
- Puerto: `3306`.
- Base configurada: `cafeteria_pos_prod_clone`.
- Servicio Windows: `MySQL80`.
- Estado del servicio: `Running`.
- Inicio del servicio: `Automatic`.
- El servicio no fue detenido, reiniciado ni modificado.

### Cuenta local utilizada

- Usuario configurado: `usuario_prod_clone`.
- Identidad devuelta por MySQL: `usuario_prod_clone@localhost`.
- Consulta utilizada: `SELECT VERSION(); SELECT CURRENT_USER(); SELECT DATABASE(); SHOW GRANTS FOR CURRENT_USER();`.
- Operaciones de escritura: **0**.

SHOW GRANTS sanitizado:

| Alcance | Privilegios | Puede crear dentro de ese nombre |
|---|---|---:|
| Global `*.*` | `USAGE` | No |
| `cafeteria_pos_prod_clone.*` | `ALL PRIVILEGES` | Sí |
| `cafeteria_pos_prod_clone_restore_verify.*` | `ALL PRIVILEGES` | Sí |
| `cafeteria_pos_prod_clone_transaction_test.*` | `ALL PRIVILEGES` | Sí |

La cuenta no tiene privilegio global `CREATE` ni un grant aplicable a `cafeteria_pos_pre16b_restore_20260927.*`.

### Causa del error 1044

**CONFIRMED**: la cuenta autenticó correctamente, pero el nombre nuevo queda fuera de los tres alcances concedidos. Por ello MySQL rechazó `CREATE DATABASE cafeteria_pos_pre16b_restore_20260927` con el código `1044`. No es un fallo del backup, TLS, contraseña, servidor ni cliente.

### Conexión administrativa local conocida

MySQL Workbench está instalado en `C:\Program Files\MySQL\MySQL Workbench 8.0\MySQLWorkbench.exe`. Su archivo de conexiones contiene los siguientes metadatos locales no sensibles:

| Nombre | Host | Puerto | Usuario |
|---|---|---:|---|
| `Local instance MySQL80` | `localhost` | 3306 | `root` |
| `Temporal` | `localhost` | 3306 | `usuario_prod_clone` |

Clasificación: **LOCAL ADMIN CONNECTION AVAILABLE**.

La conexión `root` sólo fue identificada por sus metadatos. No fue utilizada, no se abrió ningún almacén de credenciales, no se extrajo ninguna contraseña y no hubo intentos de autenticación.

### Alternativas evaluadas

**A. Usar una cuenta administrativa local existente desde Codex**
Técnicamente disponible mediante la conexión local de Workbench, pero **no autorizada en 16B.0-R2**. Requeriría una autorización humana posterior y credenciales ya conocidas por el usuario, sin revelarlas.

**B. Crear manualmente la base con MySQL Workbench**
**Viable y recomendada.** El usuario puede usar su conexión administrativa local conocida para crear únicamente `cafeteria_pos_pre16b_restore_20260927`, verificando antes que no exista.

**C. Crear la base y conceder acceso mínimo al usuario limitado**
**Viable y recomendada junto con B.** Después de crearla, una persona administradora puede conceder a `usuario_prod_clone@localhost` privilegios exclusivamente sobre `cafeteria_pos_pre16b_restore_20260927.*`. Así, la futura restauración puede ejecutarse con la cuenta limitada y no con `root`.

**D. Conceder permiso sobre un patrón local dedicado para restores futuros**
Viable, pero más amplio que el acceso a un nombre exacto. No se recomienda para esta verificación si basta un grant sobre la base puntual.

No se considera válida la reutilización de las bases existentes porque contienen evidencia de etapas anteriores.

### Estrategia segura recomendada

1. El usuario abre manualmente la conexión administrativa local `Local instance MySQL80` en Workbench.
2. Verifica que el destino sea exactamente `localhost:3306` y no producción.
3. Verifica que `cafeteria_pos_pre16b_restore_20260927` siga sin existir.
4. Crea únicamente esa base con `utf8mb4` y una collation compatible.
5. Concede a `usuario_prod_clone@localhost` acceso únicamente sobre esa base nueva.
6. Cierra la sesión administrativa y confirma que la cuenta limitada puede seleccionar la base.
7. Solicita reanudar la restauración local 16B.0-R sin usar `root`.

Ninguno de estos pasos administrativos fue ejecutado durante 16B.0-R2.

### Estado posterior

- Credenciales expuestas: **NO**.
- Intentos de contraseña: **0**.
- Grants modificados: **NO**.
- Usuarios modificados: **NO**.
- Bases existentes modificadas: **NO**.
- Base nueva creada: **NO**.
- Restore ejecutado: **NO**.
- Conexión a producción: **NOT ATTEMPTED**.
- SQL productivo: **0**.
- Escrituras productivas: **0**.
- 16B.0: **STILL BLOCKED**.
- 16B.1: **NOT AUTHORIZED**.

## Continuación 16B.0-R3 — restauración y verificación final

Fecha local: 2026-09-27.

La intervención administrativa previa fue realizada manualmente en MySQL local: se creó `cafeteria_pos_pre16b_restore_20260927` y se concedieron privilegios a `usuario_prod_clone@localhost` exclusivamente sobre esa base. No se concedieron privilegios globales. Codex no utilizó `root` ni modificó grants.

### Precondiciones

- Backup: `dulce_aroma_production_pre_16b_20260927_224955.sql`.
- Tamaño: `10,363,867` bytes.
- SHA-256 previo: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- Hash previo: **MATCH**.
- Restore host: `127.0.0.1`.
- Restore database: `cafeteria_pos_pre16b_restore_20260927`.
- Restore user: `usuario_prod_clone` / identidad MySQL `usuario_prod_clone@localhost`.
- Target local y distinto de producción: **PASS**.
- Acceso del usuario limitado: **PASS**.
- Tablas antes del restore: `0`.
- Base vacía antes del restore: **PASS**.

### Restore

- Cliente: Oracle MySQL Community Client `8.0.46`.
- Archivo importado sin edición: **sí**.
- Exit code: `0`.
- Mensajes de error: `0`.
- Advertencias relevantes: `0`.
- LOCAL RESTORE: **PASS**.
- La base restaurada se conserva como `RESTORE VERIFICATION ONLY`.

### Reconciliación

| Tabla/métrica | PRE-BACKUP | Restore local | Resultado |
|---|---:|---:|---|
| Order COUNT | 1710 | 1710 | PASS |
| Order MAX(id) | 1736 | 1736 | PASS |
| Order SUM(total) | 256743.00 | 256743.00 | PASS |
| OrderItem COUNT | 3459 | 3459 | PASS |
| OrderItem MAX(id) | 7335 | 7335 | PASS |
| OrderItem SUM(subtotal) | 256743.00 | 256743.00 | PASS |
| Payment COUNT | 1633 | 1633 | PASS |
| Payment MAX(id) | 1650 | 1650 | PASS |
| Payment SUM(amount) | 239943.00 | 239943.00 | PASS |
| Expense COUNT | 579 | 579 | PASS |
| Expense MAX(id) | 582 | 582 | PASS |
| Expense SUM(amount) | 138266.40 | 138266.40 | PASS |
| CashRegister COUNT | 171 | 171 | PASS |
| CashRegister MAX(id) | 171 | 171 | PASS |
| CashRegister abiertas | 0 | 0 | PASS |
| ProductCategory COUNT | 16 | 16 | PASS |
| ProductCategory MAX(id) | 17 | 17 | PASS |

Conteos adicionales restaurados, coherentes con la evidencia del preflight/dump:

| Tabla | Filas |
|---|---:|
| Product | 77 |
| User | 2 |
| Promotion | 2 |
| PrinterSetting | 1 |
| ProductSupply | 0 |
| SupplyCategory | 0 |
| SupplyMovement | 0 |

RESTORE RECONCILIATION: **PASS**.

### Order 1023 y CashRegister 96

Order 1023 conserva exactamente:

- estado `completed`;
- subtotal `$190.00`, descuento `$0.00` y total `$190.00`;
- un OrderItem con suma almacenada y recálculo de `$190.00`;
- Payments `953`, `954` y `955`, cada uno por `$190.00` en efectivo;
- tres Payments por un total de `$570.00`.

ORDER 1023 BACKUP VERIFICATION: **PASS**.

CashRegister 96 conserva exactamente:

- apertura `$170.00`;
- cierre `$1,345.00`;
- esperado `$1,318.00`;
- diferencia `$27.00`;
- cashSales `$1,148.00`;
- cardSales `$160.00`;
- gastos `$0.00`;
- 12 transacciones;
- estado `closed`;
- `openedAt=2026-07-02 14:21:40.183`;
- `closedAt=2026-07-03 03:14:17.768`.

CASHREGISTER 96: **PASS**.

### Excepción histórica Order 1540

La copia restaurada conserva la huella aprobada:

- Order 1540: `completed`, total `$378.00`;
- tres OrderItems: suma y recálculo `$378.00`;
- único Payment 1455: `$115.00`, `cash`;
- CashRegister 150: `closed`, cashSales `$716.00`, cardSales `$638.00`, 8 transacciones.

Clasificación: **PASS_KNOWN_EXCEPTION**. No se modificó ningún registro.

### Esquema PRE-16B

- `Payment(orderId)` UNIQUE: **ABSENT**.
- `Expense.idempotencyKey`: **ABSENT**.
- `_prisma_migrations`: **ABSENT**.
- Cambios de esquema ejecutados después del restore: **0**.

### AUTO_INCREMENT

| Tabla | MAX(id) | AUTO_INCREMENT | Resultado |
|---|---:|---:|---|
| CashRegister | 171 | 172 | PASS |
| Expense | 582 | 583 | PASS |
| Order | 1736 | 1737 | PASS |
| OrderItem | 7335 | 7336 | PASS |
| Payment | 1650 | 1651 | PASS |
| Product | 82 | 83 | PASS |
| ProductCategory | 17 | 18 | PASS |
| ProductSupply | 0 | 1 | PASS |
| SupplyCategory | 0 | 1 | PASS |
| SupplyMovement | 0 | 1 | PASS |
| User | 9 | 12 | PASS |

Todos los siguientes IDs son mayores que sus `MAX(id)`: **PASS**. `PrinterSetting` y `Promotion` no usan `AUTO_INCREMENT` en el esquema físico restaurado.

### Integridad final y seguridad

- SHA-256 posterior: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- BACKUP HASH: **MATCH**.
- Backup conservado: **sí**.
- Restore local conservado: **sí**.
- SQL productivo ejecutado: **0**.
- Escrituras productivas: **0**.
- Conexiones productivas durante R3: **0**.
- `MYSQL_PWD` eliminado: **PASS**.
- Prisma ejecutado: **no**.
- 16B.1 ejecutada: **no**.

### Conclusión final de 16B.0

**ETAPA 16B.0 APROBADA — BACKUP PRODUCTIVO VERIFICADO, LISTO PARA PREPARAR 16B.1**

La aprobación cubre únicamente la creación, integridad, restauración y reconciliación del backup PRE-16B. No autoriza saneamientos, migraciones, cambios productivos ni despliegues.
