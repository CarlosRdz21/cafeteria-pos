# Etapa 16A — Preparación controlada para migración productiva

Fecha de preparación: 2026-09-15. Esta etapa es exclusivamente local. No se
accedió ni escribió en producción, Hostinger, Render o Mercado Pago; tampoco se
hizo `push`, `merge`, `rebase`, despliegue, migración remota ni cambio de DNS.

## 1. Objetivo y límite

Cerrar la Etapa 15 en Git local y preparar un procedimiento reproducible, con
guardas, puntos de control, rollback y criterios GO/NO-GO para una futura Etapa
16B. Los archivos SQL de este documento son artefactos de runbook: **no fueron
ejecutados en 16A**.

## 2. Cierre de la Etapa 15

- Rama local: `test/integridad-contable-pos`.
- Commit local: `76f94c004e611112300c89f93394203325253837`.
- Mensaje: `test: valida migracion con datos reales de produccion`.
- Incluye código, pruebas, scripts protegidos y evidencia anonimizada.
- Excluye `.env`, dumps, respaldos, certificados, llaves y credenciales.
- No se publicó el commit ni se alteró ninguna rama remota.

Los dos auxiliares locales de restauración/verificación transaccional del clon
permanecen fuera del commit porque son utilidades de una sola vez:

- `backend/scripts/restore-prod-clone-transaction-open-register.js`
- `backend/scripts/verify-prod-clone-transaction-state.js`

## 3. Resultado comprobado de la Etapa 15

El ensayo sobre el clon saneado aprobó: migraciones, 63 pruebas transaccionales,
reconciliación fila por fila y restauración del estado histórico. Las cifras
base relevantes son:

| Métrica | Valor saneado |
| --- | ---: |
| Order | 1602 |
| OrderItem | 3219 |
| Payment | 1524 / $221,375.00 |
| Expense | 546 / $125,756.40 |
| CashRegister | 160 (1 abierta) |
| Product | 77 |
| User | 2 |
| Promotion | 2 |

Order 1023 conserva total `$190.00`, Payment 953 por `$190.00` y CashRegister
96 conserva efectivo `$1,148.00`, tarjeta `$160.00`, 12 transacciones y estado
cerrado. No quedaron otros `orderId` con más de un Payment.

## 4. Arquitectura productiva por confirmar

| Componente | Evidencia versionada | Estado antes de 16B |
| --- | --- | --- |
| Backend Node/Express/Socket.IO | Existe `build:render` | Render es la intención histórica; servicio y URL exactos pendientes |
| Base MySQL | Prisma usa `mysql` | Host, puerto, base y usuario productivos deben confirmarse sin imprimir secretos |
| Frontend Angular | Build estático de producción | Proveedor, dominio y ruta de publicación pendientes |
| Tiempo real | Socket.IO comparte servidor HTTP | WebSocket, proxy y sticky-session del proveedor pendientes |
| Mercado Pago | URLs y token se reciben por entorno | Credenciales y callbacks reales sólo se verifican en 16B, sin mostrarlos |

No se inventan dominios. Toda referencia exacta se marca `PENDIENTE DE
CONFIRMACIÓN` hasta que el operador la lea del panel autorizado.

## 5. Versiones validadas localmente

- Node.js `22.22.0`; npm `10.9.4`.
- Angular CLI `19.2.19`; Angular `19.2.25`; TypeScript `5.7.3`.
- Prisma CLI y Client `6.19.3`.
- MySQL productivo: versión pendiente de obtener con un `SELECT VERSION()` de
  sólo lectura en 16B.

No se agregó `engines` ni `.nvmrc`: primero debe confirmarse el runtime real del
proveedor. El despliegue debe usar una versión de Node soportada por Angular 19,
Prisma 6.19.3 y el proveedor, y coincidir entre build y ejecución.

## 6. Matriz de configuración

| Variable | Local | Producción | Regla |
| --- | --- | --- | --- |
| `NODE_ENV` | `test`/`development` | `production` | Obligatoria en producción |
| `DATABASE_URL` | MySQL local aislado | Secreto del proveedor | Nunca registrar ni imprimir completa |
| `JWT_SECRET` | Secreto local >= 32 | Secreto exclusivo >= 32 | No reutilizar el local |
| `FRONTEND_ORIGINS` | localhost permitido | Origen HTTPS/Capacitor exacto | Sin `*`, ruta o credenciales |
| `SOCKET_ORIGINS` | localhost permitido | Origen HTTPS/Capacitor exacto | Puede coincidir con frontend |
| `PORT` | `3000` | Asignado por proveedor | No fijarlo si Render lo inyecta |
| `CLONE_READ_ONLY` | `true` sólo en clon | ausente/`false` | Nunca apuntar producción como clon |
| `MP_ACCESS_TOKEN` | vacío/deshabilitado | secreto real | Validar sólo dentro del panel |
| `MP_*_URL` | local de prueba | HTTPS exactas | Confirmar rutas desplegadas |

El frontend carga `assets/runtime-config.js`. Si API y frontend comparten origen,
`serverUrl` queda vacío; si son orígenes distintos, el operador coloca ahí
exclusivamente la URL base HTTPS pública del backend. Este archivo es público y
jamás debe contener secretos.

## 7. Auditoría de dependencias

No se ejecutó `npm audit fix`, no se usó `--force` y no se actualizaron paquetes.
Resultados de preparación:

| Alcance | Resultado |
| --- | --- |
| Frontend `npm audit --omit=dev` | 12: 7 moderadas, 4 altas, 1 crítica |
| Frontend completo | 54: 3 bajas, 24 moderadas, 25 altas, 2 críticas |
| Backend `npm audit --omit=dev` | 4: 1 moderada, 3 altas |
| Backend completo | 10: 4 moderadas, 6 altas |

La corrección automática propuesta incluye saltos mayores, entre ellos Angular
21. Por ello requiere una etapa separada, pruebas completas y una decisión
explícita. La vulnerabilidad crítica del árbol productivo del frontend es un
NO-GO actual.

## 8. Estado de migraciones Prisma

Orden versionado:

1. `20260723135000_mysql_initial`
2. `20260723153500_payment_order_unique`
3. `20260827211000_expense_idempotency`

El clon histórico inicialmente no tenía `_prisma_migrations`. En 16B se debe
verificar de nuevo la base real. Si la tabla existe y su historia no coincide,
se detiene. Si no existe, sólo después de demostrar que el esquema físico
coincide con la migración inicial se puede registrar la línea base:

```powershell
npm exec prisma migrate resolve -- --applied 20260723135000_mysql_initial --schema prisma/schema.mysql.prisma
npm exec prisma migrate deploy -- --schema prisma/schema.mysql.prisma
```

Ejecutar desde `backend`. No usar `prisma db push`, `migrate reset` ni `migrate
dev` contra producción.

## 9. Saneamiento previo de Payment 1023

La migración UNIQUE no puede aplicarse mientras existan Payments duplicados. El
script [02-payment-1023-cleanup.sql](./production-runbook/02-payment-1023-cleanup.sql)
conserva exclusivamente Payment 953 y elimina 954/955 dentro de una transacción
SERIALIZABLE. Bloquea las filas, valida importes e identidades, rechaza cualquier
otro duplicado, compara huellas de Order 1023 y CashRegister 96 y hace rollback
ante toda desviación. No fue ejecutado en 16A.

## 10. Backup productivo obligatorio

Con mantenimiento ya activo y antes de toda escritura:

1. Crear un dump completo, consistente y fechado, por ejemplo
   `cafeteria_pos_production_pre_etapa16b_YYYYMMDD_HHMMSS.sql`.
2. Guardarlo fuera del repositorio y fuera del directorio publicado.
3. Registrar tamaño y SHA-256 en la bitácora privada del operador.
4. Comprobar que contiene estructura y datos de `Order`, `OrderItem`, `Payment`,
   `Expense` y `CashRegister`, además del final correcto del dump.
5. Restaurarlo en una base desechable y ejecutar las consultas de conteo.

Comando de referencia, ejecutado por el operador autorizado desde una terminal
que tenga `mysqldump` y sin colocar la contraseña en la línea de comandos:

```powershell
mysqldump --host=HOST_CONFIRMADO --port=3306 --user=USUARIO_CONFIRMADO --password --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 NOMBRE_BASE_CONFIRMADO > cafeteria_pos_production_pre_etapa16b_YYYYMMDD_HHMMSS.sql
Get-Item .\cafeteria_pos_production_pre_etapa16b_YYYYMMDD_HHMMSS.sql | Select-Object Name,Length
Get-FileHash .\cafeteria_pos_production_pre_etapa16b_YYYYMMDD_HHMMSS.sql -Algorithm SHA256
```

Para el ensayo de restauración se debe crear una base desechable separada y
usar `mysql --host=HOST_SEGURO --user=USUARIO_SEGURO --password
BASE_DESECHABLE < ARCHIVO.sql`; nunca restaurar la prueba sobre producción.

Un archivo inexistente, vacío, truncado o no restaurable es NO-GO.

## 11. Snapshot read-only previo

Ejecutar [01-preflight-readonly.sql](./production-runbook/01-preflight-readonly.sql)
después del backup. Confirmar visualmente `DATABASE()` y `@@hostname`. Guardar
la salida en evidencia privada. Debe confirmar cifras, estados, duplicados,
huérfanos, Order 1023, Payments 953/954/955, CashRegister 96 y presencia/ausencia
de `_prisma_migrations`. Cualquier caso duplicado distinto de 1023 detiene 16B.

## 12. Ventana de mantenimiento

Antes del checkpoint de escritura:

- impedir nuevos accesos de usuarios al frontend;
- bloquear nuevas ventas, gastos, aperturas/cierres y conexiones de clientes;
- confirmar que no hay jobs o instancias antiguas escribiendo;
- conservar backend anterior y frontend anterior listos para rollback;
- anotar inicio, responsables y canal de decisión.

No basta con ocultar la UI: debe quedar detenida toda ruta de escritura.

## 13. Secuencia de despliegue propuesta

1. Autorizar 16B y abrir mantenimiento.
2. Confirmar destino, secretos sin exponerlos y backup restaurable.
3. Ejecutar preflight read-only y declarar GO del snapshot.
4. Ejecutar saneamiento de Payment 1023 y validar su `cleanup_committed = 1`.
5. Ejecutar [03-post-cleanup-validation.sql](./production-runbook/03-post-cleanup-validation.sql).
6. Resolver la migración inicial sólo si aplica y desplegar migraciones Prisma.
7. Ejecutar [04-post-migration-validation.sql](./production-runbook/04-post-migration-validation.sql).
8. Desplegar backend con configuración validada; comprobar `/health`.
9. Desplegar frontend y su `runtime-config.js`; comprobar CORS y Socket.IO.
10. Hacer smoke tests controlados antes de reabrir.
11. Reabrir y monitorear la primera venta, gasto y cierre.

No saltar checkpoints ni desplegar primero una UI que dependa de un esquema aún
no preparado.

## 14. Backend y frontend

Backend: construir desde commit autorizado con `npm ci` y `npm run build:render`,
confirmar Prisma 6.19.3, `NODE_ENV=production`, health 200, logs sin secretos y
una sola versión activa tras el reemplazo.

Frontend: usar `npm ci` y `npm run build:prod`, colocar la URL HTTPS real en la
configuración pública sólo si no es same-origin, publicar de forma atómica y
limpiar caché/CDN conforme al proveedor. Verificar que el navegador no traduzca
la app y que no queden referencias a localhost.

## 15. Socket.IO y CORS

- `FRONTEND_ORIGINS` y `SOCKET_ORIGINS` deben ser listas de orígenes HTTPS
  exactos, sin comodines, rutas o credenciales. `capacitor://localhost` sólo se
  agrega si la aplicación móvil publicada realmente lo necesita.
- Producción no incorpora localhost automáticamente.
- Probar conexión, autenticación, reconexión y actualización entre dos clientes.
- Confirmar soporte WebSocket del proxy y afinidad si existiera más de una
  instancia. Sin esa confirmación, NO-GO para tiempo real.

## 16. Mercado Pago

No se probó ni contactó Mercado Pago. En 16B deben verificarse, sin copiarlos a
logs o documentos, el token del ambiente correcto, URLs success/pending/failure,
webhook, HTTPS, idempotencia y correspondencia con la URL desplegada. Primero se
prueba un flujo autorizado de bajo riesgo; un callback hacia localhost, dominio
anterior o entorno incorrecto es NO-GO.

## 17. Smoke tests antes de reabrir

- login válido e inválido;
- lectura de caja actual y reportes;
- productos, promociones, usuarios, insumos y movimientos;
- comanda pendiente y retorno correcto después del cobro;
- CORS desde el frontend real y rechazo desde un origen no autorizado;
- Socket.IO conectado y evento reflejado en un segundo cliente;
- consola sin 401 espurios, errores de red o excepciones;
- diseño a 1024x768, 1280x800 y escritorio sin controles cortados.

Las pruebas que escriben deben usar registros controlados y ser reconciliadas o
revertidas de manera contable, nunca mediante borrado improvisado.

## 18. Primera venta, gasto y cierre

Tras reabrir, observar una operación controlada por vez:

1. Abrir caja y registrar sus cifras iniciales.
2. Crear y cobrar una venta; comprobar exactamente una Order completada, sus
   OrderItems, un Payment y un incremento de caja.
3. Registrar un gasto con clave idempotente; repetir la misma intención y
   comprobar que no se duplica.
4. Validar descuento de inventario si la receta aplica.
5. Cerrar caja y reconciliar efectivo, tarjeta, gastos, transacciones y diferencia.

Detener nuevas operaciones ante el primer desfase.

## 19. Reconciliación posterior

Comparar snapshot previo, post-saneamiento, post-migración y post-smoke. Antes
de reabrir, los conteos sólo pueden variar en Payment `-2` y suma `-380.00` por
el saneamiento conocido; las migraciones de esquema no deben cambiar filas ni
importes. Después de reabrir, toda variación debe explicarse por operaciones con
ID y responsable. Deben seguir en cero duplicados Payment y huérfanos.

## 20. Rollback por escenario

| Escenario | Respuesta |
| --- | --- |
| A. Preflight no coincide | No escribir; conservar mantenimiento y diagnosticar |
| B. Saneamiento falla | El procedimiento hace rollback; no migrar |
| C. Validación post-saneamiento falla | Mantener cerrado; restaurar backup sólo tras confirmar que no hubo nuevas escrituras |
| D. `migrate resolve/deploy` falla | No desplegar app; inspeccionar `_prisma_migrations`; no usar reset/db push |
| E. Backend falla | Volver al artefacto backend anterior compatible; conservar mantenimiento |
| F. Frontend falla | Restaurar artefacto estático anterior y su runtime config |
| G. Socket/CORS falla | Mantener cerrado o revertir configuración/artefactos; no abrir parcialmente |
| H. Fallo tras reabrir | Detener escrituras, tomar snapshot y reconciliar; no restaurar ciegamente porque borraría operaciones nuevas |

Si ya hubo escrituras nuevas, el rollback debe ser hacia adelante o mediante
compensación transaccional auditada; nunca sobrescribir la base completa sin un
plan que preserve dichas operaciones.

## 21. Checkpoints humanos de 16B

Cada punto exige evidencia y una aprobación explícita antes de continuar:

1. Destino productivo confirmado.
2. Mantenimiento efectivo y procesos escritores detenidos.
3. Backup completo restaurado con éxito en entorno desechable.
4. Snapshot read-only aprobado.
5. Saneamiento y validación post-saneamiento aprobados.
6. Historia Prisma y migraciones aprobadas.
7. Backend saludable y configuración segura.
8. Frontend, CORS, Socket.IO y Mercado Pago aprobados.
9. Smoke tests aprobados.
10. Autorización para reabrir y monitorear primeras operaciones.

## 22. Criterios GO

Todos deben cumplirse: auditoría de dependencias aceptada o remediada; URLs y
runtime confirmados; backup restaurable; snapshot exacto; sólo duplicación 1023;
credenciales mínimas y segregadas; origen HTTPS exacto; migraciones ensayadas;
rollback disponible; responsables presentes; pruebas automáticas y manuales
aprobadas.

## 23. Criterios NO-GO y pendientes actuales

Actualmente se cumple al menos un NO-GO:

- una vulnerabilidad crítica en dependencias productivas del frontend;
- URLs/proveedores productivos exactos y versión Node remota sin confirmar;
- soporte/configuración productiva de WebSocket y callbacks sin confirmar;
- backup final, snapshot real e historia `_prisma_migrations` sólo pueden
  verificarse en una 16B expresamente autorizada;
- la suite Angular completa en ChromeHeadless quedó bloqueada por el entorno
  Windows/GPU/caché; las pruebas focalizadas y el build no sustituyen la
  validación manual integral.

Validaciones locales finales de 16A:

| Validación | Resultado |
| --- | --- |
| Backend TypeScript | PASS |
| Backend lint | PASS con 215 advertencias, 0 errores |
| Backend unitarias | 228/228 PASS |
| Integración transaccional Etapa 15 | 63/63 PASS en base local aislada |
| Prisma validate/generate | PASS |
| Backend build | PASS |
| Frontend TypeScript | PASS |
| Frontend lint | PASS con 97 advertencias, 0 errores |
| Frontend build de producción | PASS; advertencia SCSS de Reportes +4.00 kB |
| Frontend focalizadas ChromeHeadless | **NO EJECUTADO — BLOQUEO AMBIENTAL** GPU/caché Windows |

Por tanto, este documento prepara el procedimiento pero **no autoriza migrar**.

## 24. Decisión de la Etapa 16A

El repositorio queda mejor preparado: configuración de origen productivo
explícita, URL runtime HTTPS, plantillas sanitizadas, SQL con rollback y
validaciones, y secuencia de despliegue/retorno documentada. Sin embargo, los
NO-GO anteriores deben resolverse o aceptarse formalmente antes de solicitar una
ejecución productiva.

**ETAPA 16A BLOQUEADA — NO MIGRAR PRODUCCIÓN**
