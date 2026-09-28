# Etapa 16B.1 — Saneamiento transaccional controlado de Order 1023

## Resultado

- Fecha local: 2026-09-27 (America/Mexico_City).
- Estado final después de 16B.1-R2: **APROBADA**.
- Primer intento: **ROLLBACK confirmado**, sin cambios persistidos.
- Reintento R2: **COMMIT confirmado**.
- Cambios persistidos en producción: **2 filas DELETE**, exclusivamente Payments 954 y 955.
- Etapa 16B.2: **no autorizada y no iniciada**.

La transacción fue cancelada por una validación local que no aceptó la salida de `ROW_COUNT()`. No se repitió el `DELETE`. Una reconciliación read-only independiente confirmó que producción quedó exactamente en su estado previo.

## Destino y transporte

- Host: `srv1102.hstgr.io`.
- Puerto: `3306`.
- Base: `u349605213_dulceAroma`.
- Usuario: `u349605213_carlos`.
- Servidor: MariaDB `11.8.9-MariaDB-log`.
- TLS: `--ssl-mode=REQUIRED --tls-version=TLSv1.2`.
- TLS observado en las sesiones: `TLSv1.2`.
- No se registran contraseñas ni URLs completas.

## Backup obligatorio

- Archivo: `dulce_aroma_production_pre_16b_20260927_224955.sql`.
- Tamaño: `10,363,867` bytes.
- SHA-256: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- Resultado de la guarda previa: **MATCH**.
- Restore y reconciliación de 16B.0: **PASS**.

## Snapshot previo y congelación

La inspección inmediatamente anterior se ejecutó dentro de una transacción read-only terminada con `ROLLBACK`.

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

Actividad más reciente:

- Order 1736: `2026-09-26 18:21:35.058`, `completed`.
- Payment 1650 / Order 1729: `2026-09-26 18:47:39.214`, `cash`.
- Expense 582: `2026-09-26 23:39:56.732`, categoría `Nómina`.

Los valores y la actividad coinciden exactamente con 16B.0. PRODUCTION FREEZE: **PASS**.

## Duplicados y precondiciones

La búsqueda global encontró un único grupo con múltiples Payments:

| orderId | Payments | Cantidad | Suma |
|---:|---|---:|---:|
| 1023 | 953, 954, 955 | 3 | 570.00 |

Order 1023 coincidió exactamente:

- estado `completed`;
- subtotal `$190.00`, descuento `$0.00`, total `$190.00`;
- un OrderItem, suma almacenada y recálculo `$190.00`;
- Payments 953, 954 y 955 por `$190.00` cada uno, método `cash`;
- suma de Payments `$570.00`.

ORDER 1023 PRECONDITIONS: **PASS**.

## CashRegister 96 previo

| Campo | Valor |
|---|---:|
| openingAmount | 170.00 |
| closingAmount | 1345.00 |
| expectedAmount | 1318.00 |
| difference | 27.00 |
| cashSales | 1148.00 |
| cardSales | 160.00 |
| expenses | 0.00 |
| totalTransactions | 12 |
| status | closed |
| openedAt | 2026-07-02 14:21:40.183 |
| closedAt | 2026-07-03 03:14:17.768 |

CASHREGISTER 96 PRE-CLEANUP: **PASS**.

## Order 1540

La huella previa coincidió con la excepción conocida:

- Order 1540 completada, total `$378.00`;
- tres items por `$378.00`;
- Payment 1455 por `$115.00`, `cash`;
- CashRegister 150 cerrada, cashSales `$716.00`, cardSales `$638.00`, 8 transacciones.

Clasificación: **PASS_KNOWN_EXCEPTION**.

## Transacción y rollback

Se inició una transacción explícita con aislamiento `REPEATABLE READ`. Antes del intento se bloquearon mediante `SELECT ... FOR UPDATE` exclusivamente:

- Order 1023;
- su OrderItem 4182;
- Payments 953, 954 y 955;
- CashRegister 96.

Las filas bloqueadas coincidieron exactamente con la evidencia aprobada. Dentro de la misma transacción volvieron a pasar los conteos globales, las precondiciones de Order 1023, el único grupo duplicado y la huella de Order 1540.

El único `DELETE` enviado fue el objetivo autorizado y restringido a Payments 954/955, Order 1023 e importe `$190.00`. Inmediatamente después se solicitó `ROW_COUNT()`.

El resultado de una sola línea fue desenvuelto por PowerShell como un valor escalar y el validador lo indexó como si fuera un arreglo; por ello comparó el primer carácter en vez de la línea completa. El cliente lanzó `DELETE_AFFECTED_ROWS_MISMATCH` antes de aceptar un conteo y antes de las validaciones post-delete.

- Affected rows aceptadas por el control: **UNKNOWN / NOT ACCEPTED**.
- Segundo `DELETE`: **no ejecutado**.
- `COMMIT`: **no enviado**.
- `ROLLBACK`: **enviado y confirmado en la misma sesión**.
- Diagnósticos MySQL: ninguno.
- Exit code del cliente MySQL: `0`.

Aunque el `DELETE` pudo existir transitoriamente dentro de la transacción, quedó completamente revertido. No se contabiliza como escritura persistida.

## Verificación independiente posterior al rollback

Se abrió una nueva conexión exclusivamente read-only con TLS 1.2 y se confirmó:

| Métrica | Resultado posterior |
|---|---:|
| Order COUNT | 1710 |
| OrderItem COUNT | 3459 |
| Payment COUNT | 1633 |
| Payment SUM(amount) | 239943.00 |
| Expense COUNT | 579 |
| Expense SUM(amount) | 138266.40 |
| CashRegister COUNT | 171 |
| CashRegister abiertas | 0 |
| Grupos Payment duplicados | 1: Order 1023 |

Order 1023 conserva tres Payments, IDs `953,954,955`, suma `$570.00`.

- Payment 953: **PRESENT**, `$190.00`.
- Payment 954: **PRESENT**, `$190.00`.
- Payment 955: **PRESENT**, `$190.00`.
- CashRegister 96: **UNCHANGED** en todos los campos registrados.
- Order 1540 / Payment 1455 / CashRegister 150: **PASS_KNOWN_EXCEPTION**.

ROLLBACK RECONCILIATION: **PASS**.

## Seguridad y alcance

- `MYSQL_PWD` eliminado después de cada sesión: **PASS**.
- Filas eliminadas persistentemente: **0**.
- Otras escrituras productivas: **0**.
- Payment UNIQUE creado: **no**.
- Expense.idempotencyKey agregado: **no**.
- `_prisma_migrations` creada: **no**.
- Prisma ejecutado: **no**.
- Deploys/cambios de Render, Hostinger o DNS: **0**.
- Reintento automático: **no**.

## Acción necesaria

No volver a intentar el saneamiento sin una autorización humana nueva. Un eventual segundo intento debe corregir y probar localmente el manejo de resultados escalares antes de abrir otra transacción productiva. Nunca debe inferirse que el primer intento hizo commit ni repetirse el `DELETE` a ciegas; la evidencia read-only confirma explícitamente que no hizo commit.

## Conclusión

**ETAPA 16B.1 NO APROBADA — NO CONTINUAR A 16B.2**

## Corrección del validador ROW_COUNT

### Alcance de 16B.1-R1

La corrección y el ensayo se realizaron exclusivamente en `localhost:3306`, base `cafeteria_pos_pre16b_restore_20260927`, con `usuario_prod_clone`. No se cargó el archivo de credenciales productivas, no se intentó una conexión productiva y no se ejecutó SQL contra producción.

### Causa exacta del fallo anterior

El control anterior inició `mysql.exe` con:

- `--batch`;
- `--skip-column-names`;
- `--unbuffered`;
- TLS 1.2 y los parámetros productivos correspondientes a la etapa anterior.

Después del `DELETE`, envió conceptualmente:

`SELECT 'DELETE_AFFECTED', ROW_COUNT();`

El cliente MySQL terminó con exit code `0`, sin stderr ni diagnósticos. La salida de esa fase contenía una sola línea tabulada. La función PowerShell `Invoke-Phase` acumuló las líneas en una lista y devolvió `@($lines)`, pero PowerShell desenvolvió el único elemento al cruzar el límite de la función. El receptor obtuvo:

- tipo: `System.String`;
- propiedad `Count`: `1`;
- expresión `[0]`: el carácter `D`, no la línea completa.

El validador trató el resultado como arreglo y comparó `$delete[0]` con la línea completa esperada. La reproducción local confirmó `ORIGINAL_INDEX_ZERO=D`. Ésta fue la causa de `DELETE_AFFECTED_ROWS_MISMATCH`.

No había encabezados porque se usó `--skip-column-names`. `ReadLine()` retiró el salto CRLF. La codificación de `StandardOutput` no estaba fijada explícitamente por el script; los nuevos marcadores sólo usan ASCII, por lo que su interpretación no depende de la página de códigos. La consulta inocua produjo una cadena de 18 caracteres incluyendo CRLF, sin espacios adicionales ni stderr, y exit code `0`.

El defecto estaba únicamente en el comando PowerShell temporal; no existía un script versionado que corregir.

### Estrategia corregida

El cliente local se ejecutó con:

- `--batch`;
- `--raw`;
- `--skip-column-names`;
- `--unbuffered` durante el ensayo interactivo.

Inmediatamente después del `DELETE` se utiliza:

`SELECT CONCAT('DELETE_ROW_COUNT=', ROW_COUNT());`

Formato determinista único aceptado:

`DELETE_ROW_COUNT=2`

El parser corregido:

1. acepta un `System.String` o un arreglo con exactamente un único string;
2. rechaza cualquier otra forma o cantidad de líneas;
3. compara mediante `StringComparison.Ordinal` la línea completa contra `DELETE_ROW_COUNT=2`;
4. devuelve el entero `2` únicamente después de esa igualdad exacta;
5. ante cualquier diferencia exige rollback.

No se relajó la regla a `> 0`, `>= 2` ni a una expresión parcial.

Una primera variante de prueba basada en coerción adicional de colecciones no aceptó el caso positivo; se descartó antes de ejecutar cualquier `DELETE`, incluso local. La versión final evita regex y coerciones ambiguas mediante comparación ordinal de la línea completa.

### Pruebas sintéticas

| Entrada simulada | Resultado esperado | Resultado |
|---|---|---|
| `DELETE_ROW_COUNT=2` | Aceptar | PASS |
| arreglo de una línea `DELETE_ROW_COUNT=2` | Aceptar | PASS |
| `DELETE_ROW_COUNT=0` | Rechazar | PASS |
| `DELETE_ROW_COUNT=1` | Rechazar | PASS |
| `DELETE_ROW_COUNT=3` | Rechazar | PASS |
| cadena vacía | Rechazar | PASS |
| NULL | Rechazar | PASS |
| texto inesperado | Rechazar | PASS |
| línea válida más una línea adicional | Rechazar | PASS |

Suite del validador: **PASS**.

La consulta local inocua `SELECT 'EXPECTED_VALUE=2'` confirmó:

- exit code `0`;
- salida exacta `EXPECTED_VALUE=2` más CRLF;
- cero líneas en stderr;
- normalización inequívoca al retirar sólo CR/LF finales.

### Estado local anterior al ensayo

| Métrica | Valor |
|---|---:|
| Order COUNT | 1710 |
| OrderItem COUNT | 3459 |
| Payment COUNT | 1633 |
| Payment SUM(amount) | 239943.00 |
| Expense COUNT | 579 |
| Expense SUM(amount) | 138266.40 |
| CashRegister COUNT | 171 |
| CashRegister abiertas | 0 |

Order 1023 conservaba total `$190.00`, un OrderItem por `$190.00`, Payments `953,954,955` por `$190.00` cada uno y suma `$570.00`. CashRegister 96 y la huella 1540/1455/150 coincidieron con la evidencia. LOCAL PRE-TEST STATE: **PASS**.

### Ensayo transaccional local

Se inició una transacción local `REPEATABLE READ` y se bloquearon con `FOR UPDATE` únicamente Order 1023, su OrderItem 4182, Payments 953/954/955 y CashRegister 96.

Se ejecutó exclusivamente en el restore local el mismo candidato:

`DELETE FROM Payment WHERE id IN (954,955) AND orderId=1023 AND amount=190.00;`

Salida recibida:

`DELETE_ROW_COUNT=2`

- Entero validado: `2`.
- LOCAL DELETE VALIDATOR: **PASS**.
- Exit code del cliente: `0`.
- Diagnósticos MySQL: `0` líneas.

### Reconciliación local antes del rollback

| Métrica | Valor temporal |
|---|---:|
| Order COUNT | 1710 |
| OrderItem COUNT | 3459 |
| Payment COUNT | 1631 |
| Payment SUM(amount) | 239563.00 |
| Expense COUNT | 579 |
| Expense SUM(amount) | 138266.40 |
| CashRegister COUNT | 171 |
| CashRegister abiertas | 0 |
| Payments para Order 1023 | 1: Payment 953 |
| Grupos Payment duplicados | 0 |

- Payment 953: presente por `$190.00`.
- Payments 954/955: ausentes dentro de la transacción.
- CashRegister 96: **UNCHANGED**.
- Order 1540: **PASS_KNOWN_EXCEPTION**.

Reconciliación post-delete local: **PASS**.

### Rollback local obligatorio

Se ejecutó `ROLLBACK` aunque todas las verificaciones pasaron. No se envió `COMMIT`.

Una conexión local read-only independiente confirmó después:

| Métrica | Valor posterior |
|---|---:|
| Order COUNT | 1710 |
| OrderItem COUNT | 3459 |
| Payment COUNT | 1633 |
| Payment SUM(amount) | 239943.00 |
| Expense COUNT | 579 |
| Expense SUM(amount) | 138266.40 |
| CashRegister COUNT | 171 |
| CashRegister abiertas | 0 |
| Payments para Order 1023 | 3: 953,954,955 |
| SUM Payments Order 1023 | 570.00 |
| Grupos Payment duplicados | 1: Order 1023 |

- Payment 953: **PRESENT**.
- Payment 954: **PRESENT**.
- Payment 955: **PRESENT**.
- CashRegister 96: **UNCHANGED**.

LOCAL RESTORE RETURNED TO PRE-16B STATE: **PASS**.

### Backup y seguridad final

- Backup SHA-256: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- BACKUP HASH: **MATCH**.
- `MYSQL_PWD` eliminado: **PASS**.
- Conexiones a producción durante R1: **0**.
- SQL productivo durante R1: **0**.
- Escrituras productivas durante R1: **0**.
- Cambios de esquema/Prisma: **0**.
- Reintento productivo: **NOT AUTHORIZED**.
- 16B.2: **NOT AUTHORIZED**.

### Conclusión 16B.1-R1

**ETAPA 16B.1-R1 APROBADA — VALIDADOR CORREGIDO Y ENSAYADO LOCALMENTE, LISTO PARA PREPARAR REINTENTO CONTROLADO DE 16B.1**

Esta aprobación valida únicamente el mecanismo local de `ROW_COUNT()` y el rollback del ensayo. No autoriza volver a conectarse a producción ni repetir el `DELETE`.

## Reintento productivo controlado

### Identificación y guardas — 16B.1-R2

Fecha local: 2026-09-27.

- Host: `srv1102.hstgr.io`.
- Puerto: `3306`.
- Base: `u349605213_dulceAroma`.
- Usuario: `u349605213_carlos`.
- Servidor: MariaDB `11.8.9-MariaDB-log`.
- TLS requerido y observado: `TLSv1.2`.
- Backup: `dulce_aroma_production_pre_16b_20260927_224955.sql`.
- Tamaño del backup: `10,363,867` bytes.
- SHA-256: `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`.
- BACKUP HASH: **MATCH**.

No se expusieron contraseñas ni la URL completa de conexión.

### Snapshot previo al reintento

La revalidación se realizó en una transacción productiva read-only finalizada con `ROLLBACK`.

| Métrica | Valor previo |
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

La actividad más reciente continuaba siendo Order 1736, Payment 1650 y Expense 582, con las mismas fechas registradas en 16B.0. No apareció actividad nueva. PRODUCTION FREEZE: **PASS**.

### Duplicados y precondiciones

Antes de iniciar la transacción de escritura existía exactamente un grupo duplicado:

| orderId | Payments | Cantidad | Suma |
|---:|---|---:|---:|
| 1023 | 953, 954, 955 | 3 | 570.00 |

Order 1023 coincidía exactamente con la evidencia:

- estado `completed`;
- subtotal `$190.00`, descuento `$0.00`, total `$190.00`;
- un OrderItem con suma y recálculo `$190.00`;
- Payments 953, 954 y 955 por `$190.00`, método `cash`;
- suma de Payments `$570.00`.

ORDER 1023 PRECONDITIONS: **PASS**.

CashRegister 96 permanecía en:

- openingAmount `$170.00`;
- closingAmount `$1,345.00`;
- expectedAmount `$1,318.00`;
- difference `$27.00`;
- cashSales `$1,148.00`;
- cardSales `$160.00`;
- expenses `$0.00`;
- 12 transacciones;
- estado `closed`;
- apertura `2026-07-02 14:21:40.183`;
- cierre `2026-07-03 03:14:17.768`.

CASHREGISTER 96 PRE-CLEANUP: **PASS**.

Order 1540, Payment 1455 y CashRegister 150 conservaron la huella **PASS_KNOWN_EXCEPTION**.

### Transacción productiva

Se inició una única transacción `REPEATABLE READ`. Dentro de ella se bloquearon con `SELECT ... FOR UPDATE` exclusivamente:

- Order 1023;
- OrderItem 4182;
- Payments 953, 954 y 955;
- CashRegister 96.

Las filas bloqueadas y todas las métricas se revalidaron antes del `DELETE`.

Único objetivo ejecutado:

`DELETE FROM Payment WHERE id IN (954,955) AND orderId=1023 AND amount=190.00;`

Salida determinista inmediata:

`DELETE_ROW_COUNT=2`

- Affected rows: `2`.
- Validador ordinal estricto: **PASS**.
- Un segundo `DELETE`: **no ejecutado**.

### Verificaciones pre-commit

| Métrica | Valor dentro de la transacción |
|---|---:|
| Order COUNT | 1710 |
| OrderItem COUNT | 3459 |
| Payment COUNT | 1631 |
| Payment SUM(amount) | 239563.00 |
| Expense COUNT | 579 |
| Expense SUM(amount) | 138266.40 |
| CashRegister COUNT | 171 |
| CashRegister abiertas | 0 |
| Payments de Order 1023 | 1: Payment 953 |
| SUM Payments Order 1023 | 190.00 |
| Grupos Payment duplicados | 0 |

- Payment 953: presente por `$190.00`.
- Payment 954: ausente.
- Payment 955: ausente.
- Order 1023 e items: sin cambios.
- CashRegister 96: **UNCHANGED** campo por campo.
- Order 1540: **PASS_KNOWN_EXCEPTION**.

PRE-COMMIT RECONCILIATION: **PASS**.

Todas las condiciones autorizadas pasaron y se envió `COMMIT`. La misma sesión devolvió el marcador `COMMIT_CONFIRMED`. El cliente terminó con exit code `0`, sin diagnósticos MySQL.

TRANSACTION: **COMMITTED**.

### Reconciliación independiente post-commit

Una conexión productiva nueva, exclusivamente read-only y con TLS 1.2, confirmó:

| Métrica | Valor posterior | Resultado |
|---|---:|---|
| Order COUNT | 1710 | PASS |
| OrderItem COUNT | 3459 | PASS |
| Payment COUNT | 1631 | PASS |
| Payment SUM(amount) | 239563.00 | PASS |
| Expense COUNT | 579 | PASS |
| Expense SUM(amount) | 138266.40 | PASS |
| CashRegister COUNT | 171 | PASS |
| CashRegister abiertas | 0 | PASS |
| Grupos Payment duplicados | 0 | PASS |

Order 1023 conserva total `$190.00`, un OrderItem con suma y recálculo `$190.00`, y únicamente Payment 953 por `$190.00`.

- Payment 953: **PRESENT**.
- Payment 954: **ABSENT**.
- Payment 955: **ABSENT**.
- CashRegister 96: **UNCHANGED**.
- Order 1540: **PASS_KNOWN_EXCEPTION**.

FINANCIAL RECONCILIATION: **PASS**.

La reducción de 2 Payments y `$380.00` corresponde exclusivamente a los duplicados históricos 954/955. La venta legítima permanece representada por Payment 953. CashRegister 96 no requirió ni recibió compensación.

### Seguridad posterior

- Filas modificadas persistentemente: **2 DELETE rows**, Payments 954 y 955.
- Otros registros modificados: **0**.
- `MYSQL_PWD` eliminado después de cada sesión: **PASS**.
- Payment UNIQUE creado: **no**.
- Expense.idempotencyKey agregado: **no**.
- `_prisma_migrations` creada: **no**.
- Prisma ejecutado: **no**.
- Cambios de inventario/recipes/LONGTEXT/JSON: **0**.
- Deploys y cambios de Render, Hostinger o DNS: **0**.
- 16B.2 ejecutada: **no**.

### Conclusión final de 16B.1

**ETAPA 16B.1 APROBADA — ORDER 1023 SANEADA Y RECONCILIADA, LISTO PARA PREPARAR 16B.2**

La aprobación cubre exclusivamente el saneamiento transaccional de Payments 954 y 955. No autoriza índices, columnas, Prisma, migraciones ni despliegues.
