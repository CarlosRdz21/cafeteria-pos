# Etapa 16B.4 — validación integral post-migración y pre-deploy

## Alcance y resultado

- Fecha local: 2026-09-28 (`America/Mexico_City`).
- Producción: consultas `READ ONLY`, health checks `GET` y comandos Prisma de
  inspección exclusivamente.
- Escrituras productivas: **0**.
- Deploy, reinicio, cambios de Render/Hostinger/DNS, commit, push, merge o
  rebase: **no ejecutados**.
- POS: **FROZEN**.
- Resultado técnico: **NO-GO**.

Los bloqueos están en dependencias, configuración del artefacto frontend,
contrato conocido de Render, un esquema Prisma alterno desactualizado y la
imposibilidad de comparar de forma verificable contra el objeto live
`5ebf4ce` sin ampliar el alcance Git.

## Producción read-only e integridad

La conexión se hizo contra el destino productivo autorizado, con Oracle MySQL
Client y TLS solicitado/observado `TLSv1.2`. La sesión completa comenzó con
`START TRANSACTION READ ONLY` y terminó con `ROLLBACK`. Las variables sensibles
se mantuvieron sólo en memoria y fueron eliminadas al terminar.

Antes de la ejecución completa hubo tres intentos locales sin escritura:

1. dos fallaron antes de abrir conexión por parsing/quoting local;
2. uno abrió una transacción `READ ONLY` y falló en el primer `SELECT` por un
   alias reservado de MariaDB; al cerrarse la conexión la transacción quedó
   revertida;
3. corregido únicamente el alias, la sesión completa terminó en `ROLLBACK`.

| Métrica | Esperado | Observado | Resultado |
|---|---:|---:|---|
| Order | 1710 | 1710 | PASS |
| OrderItem | 3459 | 3459 | PASS |
| Payment | 1631 | 1631 | PASS |
| SUM Payment.amount | 239563.00 | 239563.00 | PASS |
| Expense | 579 | 579 | PASS |
| SUM Expense.amount | 138266.40 | 138266.40 | PASS |
| CashRegister | 171 | 171 | PASS |
| CashRegister abiertas | 0 | 0 | PASS |
| órdenes con más de un Payment | 0 | 0 | PASS |

La actividad máxima permaneció exactamente como en 16B.3:

- Order: ID 1736, `2026-09-26 18:21:35.058`;
- Payment: ID 1650, `2026-09-26 18:47:39.214`;
- Expense: ID 582, `2026-09-26 23:39:56.732`;
- CashRegister: ID 171.

Controles:

- Payment 953: presente, Order 1023, `190.00`, cash;
- Payment 954: ausente;
- Payment 955: ausente;
- CashRegister 96: coincide con 16B.3 (`closed`, 12 transacciones,
  cashSales `1148.00`, cardSales `160.00`, expenses `0.00`);
- Order 1540: `completed`, total `378.00`, un Payment por `115.00`;
  **PASS_KNOWN_EXCEPTION**.

Conclusión: `PRODUCTION FREEZE: PASS` y
`PRODUCTION DATA INTEGRITY: PASS`.

## Esquema productivo y Prisma

| Control | Observado | Resultado |
|---|---|---|
| `Payment_orderId_key` | presente, `NON_UNIQUE=0` | PASS |
| `Payment_orderId_idx` | ausente | PASS |
| `Payment_orderId_fkey` | presente | PASS |
| `Expense.idempotencyKey` | `varchar(191)`, nullable | PASS |
| `Expense_idempotencyKey_key` | presente, `NON_UNIQUE=0` | PASS |
| Expense históricas con clave NULL | 579 | PASS |
| `_prisma_migrations` | 3 completas, 0 revertidas | PASS |

Las tres migraciones observadas fueron las esperadas. `prisma migrate status`
indicó `Database schema is up to date!`. `prisma migrate diff` devolvió una
migración vacía. No se ejecutaron `deploy`, `resolve`, `db push`, `reset` ni
`migrate dev`.

Validaciones locales del esquema operativo
`backend/prisma/schema.mysql.prisma`:

- `prisma validate`: PASS contra la candidata MySQL local;
- `prisma generate`: PASS;
- Payment `orderId @unique`: presente;
- Expense `idempotencyKey String? @unique`: presente.

Discrepancia: `backend/prisma/schema.prisma` no representa el esquema
productivo endurecido: Payment conserva `orderId` no único y Expense no declara
`idempotencyKey`. Los scripts reales de postinstall/build/migración usan
explícitamente `schema.mysql.prisma`, pero el requisito de consistencia del
archivo alterno no se cumple. Clasificación: **BLOCKING para 16B.4 hasta decidir
si se elimina, actualiza o documenta formalmente como esquema no productivo**.

## Backups

| Backup | Tamaño | SHA-256 | Git ignore | Resultado |
|---|---:|---|---|---|
| `dulce_aroma_production_pre_16b_20260927_224955.sql` | 10,363,867 | `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56` | sí | MATCH |
| `dulce_aroma_production_post_16b1_pre_schema_20260928_000858.sql` | 10,363,683 | `66D9D4662F62B7DC030F6251A589418A1BDA8C5C4DD465D8E79B1DFA9586FB87` | sí | MATCH |

Los archivos no fueron modificados.

## Git y candidato real

- Rama: `test/integridad-contable-pos`.
- HEAD: `55a7f9ca08c2a180fa6df6c8efba3ee493d808e1`.
- Referencia histórica live informada: `5ebf4ce`.
- `5ebf4ce` no existe en objetos, ramas ni refs remotas locales.
- La consulta pública del recurso web respondió, pero la API pública de
  comparación devolvió 404 y no proporcionó un delta verificable.
- No se ejecutó `git fetch` para no cambiar `.git` ni ampliar el alcance.

Por ello `CANDIDATE VS LIVE DELTA` queda **BLOCKED**. No se afirma una revisión
de cambios que no pudo demostrarse.

El árbol previo a esta documentación contenía solamente documentación y dos
scripts locales de diagnóstico sin rastrear; no había cambios funcionales sin
commit en `src` o `prisma`. Esos cambios previos se conservaron intactos.

## Backend

Estrategia de dependencias: se conservaron `node_modules` y lockfile existentes.
No se ejecutó `npm ci` porque reemplazaría el árbol instalado durante una etapa
que no autoriza cambios de dependencias.

| Validación | Resultado |
|---|---|
| TypeScript app + tests | PASS |
| build | PASS |
| lint | PASS, 0 errores y 215 warnings |
| unit tests | PASS, 231/231 |
| integración MySQL local | PASS, 64/64 |
| auditoría de producción | FAIL, 3 altas y 1 moderada |

La auditoría no se corrigió. Las altas reportadas trazan a Prisma CLI/
`deepmerge-ts`; la moderada incluye `qs`. Aunque parte del hallazgo corresponde
a tooling, `npm audit --omit=dev` no produjo el resultado obligatorio de cero
vulnerabilidades.

La integración se ejecutó exclusivamente contra
`cafeteria_pos_prod_clone_transaction_test` en localhost con usuario dedicado,
nunca contra producción. Al terminar:

- 9 archivos y 64 pruebas: PASS;
- caja histórica 160 restaurada;
- 0 cajas y 0 órdenes `TEST_` remanentes;
- 0 órdenes con pagos duplicados;
- huella de 13 tablas idéntica antes/después;
- métricas históricas restauradas exactamente.

Cobertura confirmada por pruebas y revisión:

- segundo Payment para una orden: impedido/idempotente;
- conflicto `P2002`: manejado y reconciliado;
- pago concurrente y pago versus cierre: consistente;
- actualizaciones de caja: atómicas;
- Expense con idempotency key, reintentos, concurrencia y eliminación: PASS;
- histórico Expense sin key: compatible;
- gastos/pagos concurrentes sin `lost update`: PASS;
- inventario: incluidas las tres suites MySQL;
- Socket.IO de órdenes: emisiones ubicadas después de resolver la transacción.

`PAYMENT HARDENING`, `EXPENSE HARDENING` y `CASH REGISTER HARDENING`: PASS.

## Frontend

- `@angular/ssr`: `19.2.27`, como la referencia corregida.
- TypeScript: PASS.
- lint: PASS, 0 errores y 97 warnings.
- build production: PASS al permitir la descarga de Google Fonts.
- advertencia de build: SCSS de reportes `16.00 kB`, supera warning de `12 kB`
  pero no el límite de error de `20 kB`.
- primer build sandbox: bundles completos, fallo ambiental al descargar Google
  Fonts; la repetición con red terminó correctamente.
- tests: **ENVIRONMENT BLOCKER**. ChromeHeadless no pudo iniciar tras tres
  intentos por caída de GPU y bloqueo de su caché temporal en Windows; ningún
  caso llegó a ejecutarse.

Auditoría frontend de producción:

- 0 críticas;
- 5 altas;
- 7 moderadas;
- total 12;
- sin `audit fix` ni actualización automática.

La versión cumple el requisito específico de SSR 19.2.27, pero avisos más
recientes alcanzan a Angular 19.2.25/SSR 19.2.27. Clasificación: **WARNING** y
requiere una etapa separada de actualización/evaluación.

### URLs productivas

El frontend obtiene una única URL base para REST y Socket.IO. En web no local:

1. usa `window.__CAFETERIA_POS_CONFIG__.serverUrl` si no está vacío;
2. en caso contrario usa `window.location.origin`.

El artefacto generado contiene:

```js
window.__CAFETERIA_POS_CONFIG__ = { serverUrl: '' };
```

Por ello un frontend desplegado en los dominios web usaría ese mismo dominio
para `/api` y `/socket.io`, no `https://api.dulcearomacafeteria.com`, salvo un
proxy inverso no demostrado. Resultado:

- `FRONTEND PRODUCTION API URL`: FAIL;
- `FRONTEND PRODUCTION WEBSOCKET`: FAIL.

La corrección esperada en la futura configuración pública (sin secretos) es
`serverUrl: 'https://api.dulcearomacafeteria.com'`, pero no se aplicó en esta
etapa.

## CORS, entorno y Socket.IO

La implementación candidata:

- divide `FRONTEND_ORIGINS` y `SOCKET_ORIGINS` por comas;
- recorta espacios y un slash final;
- rechaza `*`;
- exige orígenes exactos, sin rutas, query, fragmento ni credenciales;
- en `NODE_ENV=production` sólo admite HTTPS o esquema Capacitor;
- Express y Socket.IO usan el mismo `Set` combinado;
- no agrega localhost cuando `NODE_ENV=production`;
- conserva el path Socket.IO predeterminado `/socket.io`;
- usa credenciales y métodos GET/POST para Socket.IO;
- autentica JWT, vuelve a consultar usuario activo y asigna rooms por rol;
- Render es compatible con el transporte WebSocket de esta arquitectura.

Orígenes esperados:

```text
https://dulcearomacafeteria.com,https://www.dulcearomacafeteria.com
```

La lista conocida de nombres en Render contiene `DATABASE_URL`, `JWT_SECRET` y
`FRONTEND_ORIGINS`, pero no `NODE_ENV`. Sin `NODE_ENV=production`, el código usa
`development` como default e incorpora localhost a la allowlist. No fue posible
verificar el valor efectivo de `FRONTEND_ORIGINS` porque esta etapa prohíbe
mostrar o solicitar secretos/configuración remota.

Clasificación del contrato conocido:

- MATCH: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGINS` por nombre;
- opcionales usados: `JWT_EXPIRES_IN`, `AUTH_DEBUG_TOKEN`, `MP_ACCESS_TOKEN`,
  `MP_POINT_TERMINAL_SERIAL`;
- EXTRA/obsoletos para el candidato: `DB_HOST`, `DB_NAME`, `DB_USER`,
  `DB_PASSWORD`, `DB_PORT`;
- MISSING operativo: `NODE_ENV=production`;
- `PORT` es opcional y Render puede inyectarlo; el servidor usa
  `process.env.PORT || 3000`;
- otras variables opcionales soportadas: `SOCKET_ORIGINS`, `JSON_BODY_LIMIT`,
  límites de login y parámetros adicionales de Mercado Pago.

Resultado: implementación CORS correcta, pero `CORS: FAIL` para preparación
productiva y `RENDER ENV CONTRACT: FAIL` hasta validar `NODE_ENV` y el valor
exacto de los orígenes. `SOCKET.IO: PASS` en código/tests; su URL frontend sigue
en FAIL por el runtime config vacío.

## Health

Consultas GET permitidas:

| URL | Resultado |
|---|---|
| `https://api.dulcearomacafeteria.com/` | HTTP 200, `ok=true` |
| `https://api.dulcearomacafeteria.com/health` | HTTP 200, `ok=true`, `healthy` |
| `https://api.dulcearomacafeteria.com/api/health` | HTTP 200, `ok=true`, `healthy` |

Los tres son liveness del proceso y no consultan Prisma/MySQL. El candidato no
expone `/health/db`, `/api/health/db` ni un endpoint equivalente de readiness de
base de datos.

## Riesgos y decisión

Bloqueos de 16B.4:

1. auditoría backend distinta de cero, con vulnerabilidades altas;
2. `backend/prisma/schema.prisma` alterno no representa los hardenings;
3. delta contra `5ebf4ce` no verificable con los objetos disponibles;
4. artefacto frontend con runtime URL vacío para una arquitectura cross-origin;
5. `NODE_ENV=production` no aparece en la lista conocida de Render;
6. valor real de `FRONTEND_ORIGINS` no verificado;
7. pruebas frontend bloqueadas por el entorno Chrome/GPU.

Aspectos aprobados: freeze e integridad productiva, esquema físico, backups,
Prisma operativo, drift vacío, backend types/build/lint/unit/integration,
hardenings financieros, build frontend, implementación Socket.IO y health.

## Resumen final

```text
PRODUCTION FREEZE: PASS
PRODUCTION DATA INTEGRITY: PASS
PRODUCTION SCHEMA: PASS
PRE-16B BACKUP HASH: MATCH
POST-16B1 PRE-SCHEMA BACKUP HASH: MATCH
CURRENT BRANCH: test/integridad-contable-pos
CURRENT HEAD: 55a7f9ca08c2a180fa6df6c8efba3ee493d808e1
LIVE BACKEND REFERENCE: 5ebf4ce / UNKNOWN LOCALLY
CANDIDATE VS LIVE DELTA: BLOCKED
PRISMA VALIDATE: PASS
PRISMA GENERATE: PASS
PRISMA MIGRATE STATUS: PASS
SCHEMA DRIFT: NONE
BACKEND PROD AUDIT: FAIL — 3 high, 1 moderate
BACKEND TYPESCRIPT: PASS
BACKEND BUILD: PASS
BACKEND LINT: PASS — 215 warnings
BACKEND UNIT TESTS: PASS — 231
BACKEND INTEGRATION TESTS: PASS — 64
PAYMENT HARDENING: PASS
EXPENSE HARDENING: PASS
CASH REGISTER HARDENING: PASS
FRONTEND PROD AUDIT: WARNING — 0 critical, 5 high, 7 moderate
FRONTEND BUILD: PASS
FRONTEND TESTS: ENVIRONMENT BLOCKER
FRONTEND PRODUCTION API URL: FAIL
FRONTEND PRODUCTION WEBSOCKET: FAIL
CORS: FAIL — implementation correct, production contract incomplete
RENDER ENV CONTRACT: FAIL
SOCKET.IO: PASS
PRODUCTION HEALTH: PASS
PRODUCTION WRITES: 0
GIT SAFETY: PASS
PRE-DEPLOY TECHNICAL STATUS: NO-GO
16B.4: FAIL
BACKEND DEPLOY: NOT AUTHORIZED
FRONTEND DEPLOY: NOT AUTHORIZED
POS: FROZEN
```

**ETAPA 16B.4 NO APROBADA — NO DESPLEGAR**

## REMEDIACIÓN 16B.4-R1

Fecha local: 2026-09-28. Esta remediación se realizó sólo sobre el candidato
local. No se intentó conectar a producción, no se ejecutó SQL productivo y no
se modificaron Render, Hostinger, DNS ni Mercado Pago. El POS sigue congelado.

### Git y referencia Live

- Rama: `test/integridad-contable-pos`.
- HEAD: `55a7f9ca08c2a180fa6df6c8efba3ee493d808e1`.
- `git cat-file -e 5ebf4ce^{commit}`: objeto inexistente localmente.
- Clasificación: `LIVE REFERENCE NOT AVAILABLE LOCALLY`.
- Delta candidato/Live: `STILL BLOCKED`.
- No se hizo `fetch` ni ninguna operación que modificara Git.

La ausencia de la referencia Live no bloqueó las demás remediaciones locales.

### Auditoría backend

Resultado anterior: 3 altas y 1 moderada. La cadena alta era
`prisma@6.19.3 -> @prisma/config@6.19.3 -> deepmerge-ts@7.1.5`; la moderada
era `qs@6.15.3`, transitiva de Express/body-parser.

Cambios mínimos:

- `@prisma/client`: `6.19.3` a `6.12.0`;
- `prisma`: `6.19.3` a `6.12.0`, coordinado con el cliente;
- `qs`: resuelto en `6.16.0`;
- no se utilizó `npm audit fix --force`.

`npm audit --omit=dev` posterior: 0 críticas, 0 altas, 0 moderadas y
0 bajas. Resultado: `PASS`. Archivos afectados: `backend/package.json` y
`backend/package-lock.json`.

### Prisma y schema canónico

El schema canónico es `backend/prisma/schema.mysql.prisma`. Los scripts de
generación, validación, build, pruebas y migraciones lo indican explícitamente;
el runtime consume el cliente generado a partir de él.

`backend/prisma/schema.prisma` es un artefacto legado SQLite con generator y
tipos distintos y no participa en el flujo MySQL operativo. No se modificó para
silenciar una validación que no le corresponde. Estado: `LEGACY`.

El schema canónico conserva `Payment.orderId @unique` y
`Expense.idempotencyKey String? @unique`. `prisma validate` y `prisma generate`
pasaron con Prisma Client 6.12.0. No se ejecutó `db pull`, `db push` ni una
migración.

### API, Socket.IO y serverUrl

No existen environments ni file replacements para esta configuración. La
fuente pública intencional es `src/assets/runtime-config.js`, cargada en runtime.

`serverUrl` representa la base del backend, no el content server de Capacitor.
`capacitor.config.ts` no define `server.url`; la aplicación móvil sirve assets
locales. `buildApiUrl` agrega `/api/...` y Socket.IO ejecuta `io(serverUrl)`, por
lo que ambos comparten el mismo origen.

La configuración productiva aplicada y verificada en
`dist/cafeteria-pos/assets/runtime-config.js` es:

```text
https://api.dulcearomacafeteria.com
```

En hostname local, el código conserva deliberadamente
`http://localhost:3000` para desarrollo; no se resuelve como backend cuando el
artefacto se sirve desde un hostname productivo. No se incorporaron secretos.
Archivo afectado: `src/assets/runtime-config.js`.

### CORS y contrato de entorno

Express y Socket.IO consumen el mismo `Set` combinado de `FRONTEND_ORIGINS` y
`SOCKET_ORIGINS`. El parser separa por comas, recorta espacios y slash final,
rechaza `*`, rutas, query, fragmentos y credenciales, y en producción exige
HTTPS o esquema Capacitor. No añade localhost con `NODE_ENV=production`.

| Variable | Requerida | Formato esperado | Estado productivo conocido |
|---|---:|---|---|
| `DATABASE_URL` | sí | URL MySQL | conocida por nombre; valor no inspeccionado |
| `JWT_SECRET` | sí | secreto no vacío y seguro | conocida por nombre; valor no inspeccionado |
| `FRONTEND_ORIGINS` | sí en producción | orígenes HTTPS separados por coma | conocida; valor Live por verificar |
| `NODE_ENV` | operativamente sí | `production` | `NEEDS LIVE RENDER VERIFICATION` |
| `PORT` | no | entero; Render puede inyectarlo | usa `process.env.PORT || 3000` |
| `SOCKET_ORIGINS` | no | orígenes separados por coma | opcional; misma allowlist combinada |
| `JWT_EXPIRES_IN` | no | duración JWT | opcional usada |
| `AUTH_DEBUG_TOKEN` | no | secreto de diagnóstico | opcional usada |
| `JSON_BODY_LIMIT` y límites de login | no | límites válidos | opcionales usados |
| variables Mercado Pago | según integración | secretos/identificadores | opcionales; no inspeccionadas |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` | no | legado | no usadas por el candidato |

Valor requerido de `FRONTEND_ORIGINS`:

```text
https://dulcearomacafeteria.com,https://www.dulcearomacafeteria.com
```

Código CORS: `PASS`. Configuración requerida: `PASS` como contrato definido.
Estado Live de Render: `WARNING — NEEDS LIVE VERIFICATION`; no se marca FAIL
sólo por una comprobación remota prohibida en esta etapa.

### Auditoría frontend

Resultado anterior: 0 críticas, 5 altas y 7 moderadas. Se actualizó Express a
`4.22.3` y se fijó `qs@6.16.0` mediante `overrides`, eliminando el advisory de
`qs`. Resultado posterior: 0 críticas, 5 altas, 4 moderadas y 0 bajas.

Los nueve hallazgos restantes pertenecen a Angular 19.2.25/SSR 19.2.27. npm
sólo ofrece corrección mediante salto major a Angular 20, 21 o 22. No se hizo
ese cambio de plataforma en una remediación mínima. Estado: `WARNING`; se cumple
el requisito obligatorio de cero críticas. Archivos afectados: `package.json`
y `package-lock.json`.

### ChromeHeadless y regresión

El bloqueo era ambiental del navegador/GPU. Se añadió `karma.conf.cjs` con el
launcher `ChromeHeadlessNoGpu`, se enlazó desde `angular.json` y se creó
`npm run test:ci`. No se eliminaron ni omitieron pruebas.

| Validación | Resultado |
|---|---|
| Backend TypeScript | PASS |
| Backend build | PASS |
| Backend lint | PASS, 0 errores y 215 warnings |
| Backend unit tests | PASS, 231/231 |
| Backend integration MySQL local | PASS, 64/64 |
| Payment / Expense / CashRegister hardening | PASS |
| Clon transaccional posterior | PASS, fingerprint y métricas restauradas |
| Frontend typecheck | PASS |
| Frontend lint | PASS, 0 errores y 97 warnings |
| Frontend ChromeHeadless | PASS, 55/55 |
| Frontend build production | PASS |
| API y Socket.IO en artefacto | PASS |

El build conserva una advertencia no bloqueante: `reports.component.scss` mide
16 kB y supera por 4 kB el presupuesto configurado de 12 kB.

### Pendientes no bloqueantes para revalidación local

1. Confirmar en Render Live `NODE_ENV=production` y el valor exacto de
   `FRONTEND_ORIGINS` antes de desplegar.
2. Obtener por un procedimiento humano autorizado `5ebf4ce` si se necesita el
   delta candidato/Live.
3. Planificar y ensayar separadamente la actualización major de Angular.
4. Opcionalmente reducir el presupuesto SCSS de Reportes.

No quedan bloqueos funcionales locales para repetir 16B.4. Resultado:
`16B.4-R1 PASS`. No se autoriza deploy, commit, push, cambio Render ni reapertura
del POS.

**ETAPA 16B.4-R1 APROBADA — BLOQUEOS LOCALES REMEDIADOS, LISTO PARA REVALIDACIÓN PRE-DEPLOY**

## ETAPA 16B.4-R2 — REVALIDACIÓN FINAL PRE-DEPLOY

Fecha local: 2026-09-28. Producción permaneció congelada. La única consulta SQL
productiva fue una transacción read-only para contar cajas abiertas; terminó en
`ROLLBACK`, devolvió 0 y eliminó `MYSQL_PWD` del proceso. Escrituras productivas:
0. No se ejecutaron migraciones, despliegues, reinicios ni cambios de entorno.

### Render Live

El entorno de trabajo no dispone de Render CLI, token/API ni una sesión de
panel accesible. No se solicitaron, mostraron ni infirieron secretos y no se
intentó eludir esa ausencia. En consecuencia:

- `NODE_ENV LIVE`: `NOT VERIFIED`;
- `FRONTEND_ORIGINS LIVE`: `NOT VERIFIED`;
- contrato Render: `WARNING — LIVE INSPECTION UNAVAILABLE`.

El contrato local candidato continúa requiriendo `DATABASE_URL`, `JWT_SECRET`
y, con `NODE_ENV=production`, `FRONTEND_ORIGINS`. El valor requerido para esta
última variable sigue siendo:

```text
https://dulcearomacafeteria.com,https://www.dulcearomacafeteria.com
```

Los nombres conocidos históricamente en Render incluyen `DATABASE_URL`,
`JWT_SECRET` y `FRONTEND_ORIGINS`; `DB_HOST`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD` y `DB_PORT` son legado/no usados por el candidato. La presencia y
valor Live no fueron confirmados en R2. La falta de verificación de `NODE_ENV` y
`FRONTEND_ORIGINS` impide emitir GO.

### Git Live y candidato

Se mostró y revisó el remoto antes del único `git fetch` autorizado. Era el
repositorio HTTPS público sin credenciales visibles. El fetch no modificó rama,
HEAD ni working tree.

- Live documentado disponible: `5ebf4ce80ffcb21ba68ee709a9ea69998dc945c7`.
- Punta obtenida: `origin/main`.
- Mensaje: `Quitar comentarios`.
- Base común con el candidato: `46509ccd281f198e864cc35e2593458d6f0e9a3b`.
- Divergencia: 2 commits exclusivos Live y 43 exclusivos candidato.
- Los dos commits Live sólo retiran comentarios de
  `backend/.env.hostinger.example` y `backend/.env.mysql.example`.
- Identidad Live: `DOCUMENTED_REFERENCE_ONLY`, porque Render no pudo comprobarse.
- Delta candidato/Live: `REVIEWED` en Git.

El candidato real fue identificado como HEAD más los cambios tracked y
untracked del working tree. No existen cambios staged.

### Dependencias y Prisma

Ambos `npm ci` terminaron correctamente y no alteraron manifests ni lockfiles.

| Componente | Versión/resultado |
|---|---|
| Prisma CLI | 6.12.0 |
| `@prisma/client` | 6.12.0 |
| `qs` backend | 6.16.0 |
| Backend `npm audit --omit=dev` | 0 critical / 0 high / 0 moderate / 0 low |
| Frontend `npm audit --omit=dev` | 0 critical / 5 high / 4 moderate / 0 low |
| Schema canónico | `backend/prisma/schema.mysql.prisma` |
| Prisma validate | PASS |
| Prisma generate | PASS |

La CLI mostró el schema legado al imprimir `--version`, pero validate/generate y
todos los scripts operativos utilizaron explícitamente el schema MySQL canónico.
No se ejecutó ninguna operación Prisma contra una base productiva.

Los nueve advisories restantes del frontend no cambiaron desde R1, no tienen
fix compatible dentro de Angular 19 y npm propone un salto major. Se mantienen
como `ACCEPTED TEMPORARY TECHNICAL DEBT`; la actualización major requiere una
etapa separada.

### Regresión final

| Validación | Resultado |
|---|---|
| Backend TypeScript | PASS |
| Backend build | PASS |
| Backend lint | PASS, 0 errores / 215 warnings |
| Backend unit | PASS, 231/231 |
| Backend integration MySQL local | PASS, 64/64 |
| Estado del clon después de integración | PASS, fingerprint exacto |
| Payment / Expense / CashRegister hardening | PASS |
| Frontend typecheck | PASS |
| Frontend lint | PASS, 0 errores / 97 warnings |
| Frontend tests | PASS, 55/55 |
| Frontend build production | PASS |
| API productiva en runtime config | PASS |
| Socket.IO desde la misma base | PASS |

El artefacto `dist/cafeteria-pos/assets/runtime-config.js` contiene
`https://api.dulcearomacafeteria.com` y no contiene localhost. La referencia a
localhost que existe en el código fuente queda limitada por diseño a hostname
local y no es la configuración backend productiva.

La advertencia de `reports.component.scss` sigue en 16 kB, 4 kB por encima del
budget de 12 kB. El build pasa; clasificación: `NON-BLOCKING WARNING`.

### Producción, salud y backups

- cajas abiertas: 0;
- rollback read-only: PASS;
- limpieza de `MYSQL_PWD`: PASS;
- `GET /`: HTTP 200 y `ok=true`;
- `GET /health`: HTTP 200 y `healthy`;
- `GET /api/health`: HTTP 200 y `healthy`;
- health productivo: PASS;
- backup PRE-16B: hash
  `A90ABF1D8BF9673F57356C78C13F487EED05906017541E1BEDDB59FAC4D1ED56`, MATCH;
- backup POST-16B1/PRE-SCHEMA: hash
  `66D9D4662F62B7DC030F6251A589418A1BDA8C5C4DD465D8E79B1DFA9586FB87`, MATCH.

### Secret scan

Se inspeccionaron las adiciones del candidato respecto de Live y todos los
archivos untracked no ignorados. No se detectaron llaves privadas, JWT reales,
tokens GitHub, tokens Mercado Pago ni credenciales productivas. Las coincidencias
de URLs MySQL se revisaron sin mostrar passwords: son placeholders, localhost o
hosts deliberadamente ficticios de pruebas. Resultado: `PASS`.

Los `.env` locales, dumps SQL, `node_modules`, `dist` frontend y `coverage`
están ignorados y deben permanecer fuera del release.

### Release content plan

Contenido exacto pendiente para el próximo commit, sin ejecutar `git add`:

**A. Configuración funcional/test frontend**

- `src/assets/runtime-config.js`;
- `angular.json`;
- `karma.conf.cjs`.

**B. Dependency manifests/lockfiles**

- `backend/package.json`;
- `backend/package-lock.json`;
- `package.json`;
- `package-lock.json`.

**C. Prisma**

- no hay cambios Prisma sin commit en el working tree;
- el schema MySQL y sus migraciones aprobadas ya forman parte de HEAD y deben
  conservarse en el release.

**D. Herramientas locales de verificación**

- `backend/scripts/restore-prod-clone-transaction-open-register.js`;
- `backend/scripts/verify-prod-clone-transaction-state.js`.

**E. Documentación**

- `docs/etapa-16a2-preflight-productivo-resultado.md`;
- `docs/etapa-16b0-backup-productivo.md`;
- `docs/etapa-16b1-saneamiento-order-1023.md`;
- `docs/etapa-16b2-baseline-prisma.md`;
- `docs/etapa-16b3-aplicacion-esquema-productivo.md`;
- `docs/etapa-16b4-validacion-predeploy.md`.

**F. No incluir**

- `.env`, `.env.*` locales con valores, dumps SQL y backups;
- passwords, tokens, certificados o llaves;
- `node_modules`, `dist` frontend, `coverage` y temporales.

El plan de contenido está `READY`; no equivale a autorización de commit o
deploy.

### Dictamen R2

El candidato local está íntegramente identificado y pasa regresión, auditoría
backend, build frontend, pruebas, health, backups y secret scan. Sin embargo,
los criterios de GO exigen confirmar Live `NODE_ENV=production` y
`FRONTEND_ORIGINS`; ambos quedaron `NOT VERIFIED`. También la identidad del
commit Live sólo puede considerarse referencia documentada, no confirmación del
panel Render.

Por ello:

- `PRE-DEPLOY TECHNICAL STATUS`: `NO-GO`;
- `16B.4-R2`: `FAIL` por verificación Live incompleta;
- backend deploy: `NOT AUTHORIZED`;
- frontend deploy: `NOT AUTHORIZED`;
- POS: `FROZEN`.

**ETAPA 16B.4-R2 NO APROBADA — NO DESPLEGAR**
