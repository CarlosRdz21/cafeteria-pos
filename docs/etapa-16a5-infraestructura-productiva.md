# Etapa 16A.5 — infraestructura productiva previa a 16B

## Resumen

Auditoría realizada el 27 de septiembre de 2026 en modo exclusivamente
read-only. Se inspeccionó el repositorio local y se hicieron consultas públicas
DNS y HTTP/HTTPS sin autenticación. No se consultó MySQL en esta etapa porque la
configuración necesaria ya estaba respaldada por los preflights anteriores. No
se ejecutaron despliegues, reinicios, migraciones, pagos ni escrituras en
producción.

La infraestructura **no está preparada todavía para el preflight final de
16B**. El dominio candidato está activo en Hostinger y tiene HTTPS válido, pero
sirve la página predeterminada de Hostinger, no el POS Angular. Además, no se
pudo identificar una URL pública real del backend, por lo que siguen sin poder
validarse su hosting, HTTPS, health, versión remota de Node, CORS efectivo,
Socket.IO/WebSocket y variables productivas.

Durante 16A.5 la cafetería se reportó cerrada y la operación detenida. Esto no
autoriza cambios y debe confirmarse otra vez inmediatamente antes de 16B.

## Arquitectura esperada

- Frontend: Angular 19.2.x, artefacto estático generado en
  `dist/cafeteria-pos`.
- Configuración pública en runtime: `assets/runtime-config.js`, con la propiedad
  `serverUrl`; no debe contener secretos.
- Backend: Node.js, Express, TypeScript, Prisma y Socket.IO sobre el mismo
  servidor HTTP.
- Base de datos: MySQL/MariaDB remota.
- Cliente móvil: Capacitor 8, `appId` `com.cafeteria.pos` y `webDir`
  `dist/cafeteria-pos`.

No existe `render.yaml`, configuración de Railway, Dockerfile ni otro manifiesto
de proveedor que demuestre dónde está desplegado el backend. El nombre del script
`build:render` expresa una intención histórica, no confirma un servicio real.

## Frontend

### URL, hosting y HTTPS

Se verificaron públicamente los dos candidatos conocidos:

- `https://dulcearomacafeteria.com`
- `https://www.dulcearomacafeteria.com`

Resultados:

- El dominio raíz resuelve a `145.223.105.55` y
  `2a02:4780:b:1202:0:14d6:8d5d:2`.
- `www` es CNAME del dominio raíz.
- HTTP redirige con 301 a HTTPS.
- HTTPS responde 200 y la validación TLS fue correcta.
- Los headers identifican LiteSpeed, Hostinger/hPanel y PHP.
- El contenido es la página predeterminada de Hostinger, no Angular.
- `/assets/runtime-config.js` responde 404.

Por ello el hosting web candidato queda confirmado en Hostinger, pero el
frontend productivo del POS no está desplegado.

### Runtime config

`src/index.html` carga `assets/runtime-config.js`. En el repositorio dicho
archivo expone únicamente:

```js
window.__CAFETERIA_POS_CONFIG__ = { serverUrl: '' };
```

En navegador web, un valor vacío hace que Angular use el mismo origen de la
página. Si el backend se aloja en otro origen, `serverUrl` debe ser la URL HTTPS
pública exacta del backend. En Capacitor se necesita una URL HTTPS explícita;
`capacitor.config.ts` no define actualmente `server.url`.

### Build local

`npm run build:prod` finalizó correctamente usando Node 22.22.0 y npm 10.9.4.
El artefacto quedó en `dist/cafeteria-pos`, con bundles versionados por hash,
`index.html` y `assets/runtime-config.js`. Tamaño inicial informado por Angular:
671.98 kB sin comprimir y 157.84 kB de transferencia estimada.

Existe una advertencia no bloqueante: `reports.component.scss` mide 16.00 kB y
supera en 4.00 kB el presupuesto de advertencia de 12.00 kB.

### Deploy previsto

Antes de ejecutarlo debe confirmarse en hPanel el document root real y el método
de publicación. El procedimiento esperado es:

1. Construir desde el commit autorizado con `npm ci` y `npm run build:prod`.
2. Respaldar el contenido web anterior.
3. Publicar atómicamente el contenido de `dist/cafeteria-pos` en el document
   root confirmado.
4. Configurar `assets/runtime-config.js` con una URL pública no secreta sólo si
   API y frontend son cross-origin.
5. Configurar el fallback de SPA hacia `index.html`; no existe todavía una regla
   `.htaccess` confirmada en el repositorio.
6. Invalidar `index.html` y `runtime-config.js` en caché; conservar caché larga
   para assets con hash.
7. Ejecutar smoke tests públicos y autenticados autorizados.

Estado frontend: **FAIL** por servir contenido incorrecto y carecer del runtime
config desplegado.

## Backend y hosting

No se encontró una URL pública real del backend en el repositorio, configuración
local ni documentación vigente. Las búsquedas públicas realizadas tampoco
aportaron una URL verificable. Por tanto, no se atribuye el backend a Render,
Railway, Hostinger VPS ni otro proveedor.

Los comandos locales esperados son:

- Build: `npm ci` y `npm run build:render` en `backend`.
- Start: `npm start`, que ejecuta `node dist/server.js`.
- Prisma Client: se genera como parte del build.

El despliegue futuro deberá separar explícitamente la aplicación del paso de
migración. `prisma migrate deploy` no está incluido en `npm start` ni debe
añadirse implícitamente a un arranque normal.

### Node

No hay `engines`, `.nvmrc` ni `.node-version`. Los metadatos del lockfile exigen,
entre otros:

- Angular 19.2.x: Node `^18.19.1 || ^20.11.1 || ^22.0.0`.
- Prisma 6.19.3: Node `>=18.18`.

Node 22.22.0 local es compatible y permitió el build. La versión remota es
desconocida; antes de 16B se debe fijar en el proveedor una versión 22.x
compatible y verificarla, sin asumir que coincide con el entorno local.

Estado backend: **PENDIENTE** por faltar URL, proveedor, runtime remoto, método
real de despliegue y rollback.

## Health

El backend define GET `/`, `/health` y `/api/health`. Estas rutas informan estado
y hora del proceso, pero no consultan la base de datos. No existe `/health/db`.

En los dominios candidatos `/api/health` devuelve 404, coherente con que alojan
la página predeterminada y no el backend. Al no existir otra URL identificada,
no se pudo probar health público ni salud de DB. Cuando se confirme la URL se
debe registrar status, respuesta sanitizada y latencia; para DB será necesario
un chequeo read-only independiente o un endpoint específico autorizado.

## CORS

El backend crea una lista exacta combinando `FRONTEND_ORIGINS` y
`SOCKET_ORIGINS`:

- En producción `FRONTEND_ORIGINS` es obligatorio.
- Los orígenes productivos deben ser HTTPS o `capacitor:` y no pueden incluir
  ruta ni credenciales.
- Se rechaza `*`.
- Los orígenes localhost se agregan sólo fuera de producción.
- `credentials` está habilitado.
- Las solicitudes sin header `Origin` se permiten.
- Express usa los métodos/headers predeterminados del middleware CORS; no hay
  una lista adicional específica en la aplicación.

No es posible confirmar que `https://dulcearomacafeteria.com` y/o
`https://www.dulcearomacafeteria.com` estén presentes en las variables del
servicio real. Variables: **PENDIENTE**. Estado CORS: **PENDIENTE**.

## Socket.IO y WebSocket

- El servidor Socket.IO comparte el servidor HTTP del backend.
- Path predeterminado: `/socket.io`.
- CORS: mismos orígenes exactos, GET/POST y `credentials: true`.
- El cliente construye la URL con el mismo `getServerUrl()` usado por la API.
- Auth: token JWT en `auth.token`.
- El servidor valida el JWT, vuelve a comprobar usuario activo y asigna salas
  por roles autorizados.
- No se limita `transports`; quedan disponibles polling y WebSocket según los
  defaults de Socket.IO.

`/socket.io/?EIO=4&transport=polling` devuelve 404 en el dominio web candidato.
Sin URL de backend no se efectuó handshake ni se usaron tokens. Queda pendiente
un smoke test autenticado autorizado que conecte y desconecte sin emitir eventos
de negocio. Tampoco se puede afirmar que la infraestructura desconocida soporte
WebSocket entrante.

Estado Socket.IO/WebSocket: **PENDIENTE**.

## MySQL

Se documenta la evidencia ya verificada en etapas anteriores, sin abrir una
nueva conexión en 16A.5:

- Host: `srv1102.hstgr.io`.
- Puerto: `3306`.
- Base: `u349605213_dulceAroma`.
- Versión conocida: MariaDB `11.8.9-MariaDB-log`.
- La cuenta entonces disponible tenía privilegios de escritura limitados a esa
  base. No se publica su nombre ni se cambian privilegios.

Los conteos del clon de la etapa 15 son históricos y **no representan el estado
actual de producción**. `_prisma_migrations` estaba ausente en el último
preflight read-only y deberá comprobarse otra vez inmediatamente antes de 16B.

## Credenciales para 16B

| Operación | Credencial requerida | Estado |
| --- | --- | --- |
| Preflight final | Cuenta separada, idealmente sólo `SELECT` | PENDIENTE |
| Backup | Lectura/exportación y acceso necesario a rutinas, triggers y eventos | PENDIENTE |
| Baseline Prisma | Permisos para crear y registrar `_prisma_migrations` | PENDIENTE |
| Saneamiento 1023 | Transacción acotada con `SELECT`/bloqueo y `DELETE` sobre los registros autorizados | PENDIENTE |
| Migraciones | DDL mínimo para `CREATE`, `ALTER` e índices requeridos | PENDIENTE |
| Runtime backend | Cuenta distinta con CRUD sólo sobre las tablas requeridas, sin administración de esquema | PENDIENTE |

La estrategia está definida, pero la separación y el mínimo privilegio aún no
están confirmados. No se crearon usuarios ni se tocaron privilegios.

## Estrategia Prisma

Se mantiene la estrategia aprobada en 16A.4:

1. Preflight final read-only y ventana cerrada confirmada.
2. Backup final verificado.
3. Baseline controlado para la base existente.
4. Saneamiento 1023 sólo con autorización específica y validaciones propias.
5. Aplicación de migraciones pendientes mediante el mecanismo autorizado.
6. Validación posterior contable, de restricciones y de aplicación.

No se ejecutó Prisma contra producción en 16A.5.

## Mercado Pago

Existe integración real en código para Checkout y Point. Variables encontradas,
reportadas sin valores:

- `MP_ACCESS_TOKEN`: **PENDIENTE**.
- `MP_SUCCESS_URL`, `MP_PENDING_URL`, `MP_FAILURE_URL` y `MP_AUTO_RETURN`:
  **PENDIENTE**.
- `MP_POINT_TERMINAL_ID`, `MP_POINT_TERMINAL_SERIAL`, `MP_POINT_STORE_ID`,
  `MP_POINT_POS_ID` y `MP_POINT_PRINT_ON_TERMINAL`: **PENDIENTE**.

No se encontró una ruta de webhook/notificación entrante en el backend. No puede
determinarse desde el repositorio si producción usa sandbox o credenciales
reales. No se ejecutaron llamadas, pagos, webhooks ni pruebas con terminales.

Clasificación: **PENDIENTE**.

## Deploy backend previsto

No debe ejecutarse hasta confirmar proveedor, servicio, URL, variables y plan de
rollback. Secuencia esperada:

1. Seleccionar el commit autorizado y runtime Node compatible.
2. Configurar secretos únicamente en el gestor del proveedor.
3. Ejecutar `npm ci` y `npm run build:render` dentro de `backend`.
4. Ejecutar los checkpoints de base de datos de 16B por separado.
5. Iniciar con `npm start`.
6. Probar `/health`, conectividad DB read-only, CORS y handshake Socket.IO.
7. Habilitar tráfico sólo después de aprobar los smoke tests.

El proveedor, número de instancias, proxy, soporte WebSocket y mecanismo de
release/rollback siguen pendientes.

## Orden seguro de migración y despliegue

La base de datos y el código no deben retroceder o avanzar de forma
independiente sin comprobar compatibilidad. El orden propuesto para 16B es:

1. Confirmar cafetería cerrada y bloquear escrituras operativas.
2. Ejecutar preflight final read-only con datos actuales.
3. Crear y validar el backup final.
4. Ejecutar baseline/saneamiento/migraciones sólo en los checkpoints autorizados.
5. Validar esquema y datos antes de desplegar código.
6. Desplegar backend compatible y ejecutar health/smoke.
7. Desplegar frontend y runtime config, luego validar CORS/Socket.IO y flujos.
8. Reabrir operación sólo tras la aprobación explícita.

La compatibilidad exacta del backend actualmente desplegado no puede analizarse
sin identificar su commit/artefacto real.

## Backup

El procedimiento documentado utiliza `mysqldump` con transacción consistente,
rutinas, triggers, eventos, binarios y `utf8mb4`, solicita la contraseña de forma
interactiva, guarda fuera del repositorio/public root y valida tamaño, checksum,
marcadores y tablas. Debe incluir una restauración de prueba en una base
desechable cuando corresponda.

En esta estación `mysqldump` y el cliente `mysql` no están disponibles en `PATH`.
Por ello el procedimiento conceptual está documentado, pero el puesto de trabajo
no está listo para producir/verificar el backup final. Antes de 16B se debe
instalar o localizar un cliente aprobado, comprobar versión, espacio y destino
seguro. El backup final no se ejecutó, como exige esta etapa.

Estado backup: **PENDIENTE**.

## Rollback

### Frontend

Conservar una copia verificable del contenido estático anterior y del runtime
config. Ante fallo, restaurarlos atómicamente, purgar caché de documentos no
versionados y repetir smoke tests. Falta confirmar el mecanismo real de hPanel,
el document root y si existe una versión Angular anterior; hoy el contenido
observado es la página predeterminada.

### Backend

Conservar artefacto/imagen y commit anterior, variables compatibles y mecanismo
de rollback del proveedor. Ante fallo, retirar tráfico, restaurar el release
anterior y verificar health, DB, CORS y Socket.IO. El mecanismo real no puede
cerrarse sin conocer el proveedor.

### Base de datos

Usar el dump final verificado de 16B. Una restauración completa sólo es segura si
la operación sigue detenida y no existen escrituras posteriores que se perderían.
Con actividad posterior se debe decidir entre corrección hacia adelante, PITR del
proveedor o restauración controlada. La disponibilidad de PITR no está
confirmada.

Rollback de código y rollback de base no son equivalentes. Antes de cada uno se
debe verificar que el código anterior sea compatible con el esquema resultante.
Estado global de rollback: **PENDIENTE**.

## Matriz de infraestructura

| Componente | Valor real | Evidencia | Estado |
| --- | --- | --- | --- |
| Frontend URL | Dominio raíz y `www` candidatos | DNS/HTTPS público | FAIL |
| Frontend hosting | Hostinger Web/hPanel | Headers y página predeterminada | PASS |
| HTTPS frontend | 301 HTTP→HTTPS; TLS válido; 200 | Consulta pública | PASS |
| Contenido frontend | Página predeterminada, no Angular | HTML/título servido | FAIL |
| runtime-config | Ruta esperada `/assets/runtime-config.js`; responde 404 | Código local y GET público | FAIL |
| Build frontend | `dist/cafeteria-pos` generado correctamente | `npm run build:prod` local | PASS |
| Backend URL | No identificada | Repo, docs y búsqueda pública | PENDIENTE |
| Backend hosting | No confirmado | Sin manifiesto ni URL verificable | PENDIENTE |
| HTTPS backend | No comprobable | Falta URL | PENDIENTE |
| Health | `/health` y `/api/health` existen en código; dominio da 404 | Rutas locales y GET público | PENDIENTE |
| DB health | No existe endpoint dedicado | Auditoría de rutas | PENDIENTE |
| Node | 22.22.0 local compatible; remoto desconocido | Build y lockfile | PENDIENTE |
| CORS | Whitelist exacta y credenciales; valores productivos desconocidos | Código backend | PENDIENTE |
| Socket.IO | Path `/socket.io`, JWT y origen compartido; URL real ausente | Código y 404 público | PENDIENTE |
| WebSocket | Capacidad del proveedor no confirmada | Hosting backend desconocido | PENDIENTE |
| MySQL | Host, puerto, base y versión identificados | Preflight anterior | PASS |
| Credenciales MySQL | Estrategia definida; separación no confirmada | Documentación y evidencia previa | PENDIENTE |
| Prisma strategy | Baseline y secuencia aprobados en 16A.4 | Documento 16A.4 | PASS |
| Mercado Pago | Integración en código; configuración productiva desconocida | Servicios y rutas locales | PENDIENTE |
| Backup | Procedimiento documentado; clientes locales ausentes; final no ejecutado | Runbook y `PATH` local | PENDIENTE |
| Rollback frontend | Estrategia general; mecanismo Hostinger pendiente | Auditoría | PENDIENTE |
| Rollback backend | Estrategia general; proveedor/release pendiente | Auditoría | PENDIENTE |
| Rollback DB | Dump/restore condicionado; PITR desconocido | Runbook | PENDIENTE |

## Pendientes bloqueantes

1. Confirmar en Hostinger document root, método de publicación, fallback SPA y
   política de caché; retirar la página predeterminada sólo durante un deploy
   autorizado.
2. Confirmar la URL y el proveedor reales del backend.
3. Confirmar build/start/release/rollback, proxy, instancias y soporte de
   WebSocket del backend.
4. Fijar y verificar la versión remota de Node.
5. Confirmar que los orígenes frontend exactos estén configurados en
   `FRONTEND_ORIGINS` y `SOCKET_ORIGINS`.
6. Probar HTTPS y health del backend; definir una verificación DB read-only,
   porque el health actual no consulta DB.
7. Ejecutar un handshake Socket.IO autenticado y no mutante una vez disponible
   la URL y un JWT de smoke autorizado.
8. Confirmar todas las variables de Mercado Pago y URLs de retorno dentro del
   gestor del proveedor, sin revelar valores.
9. Instalar/localizar clientes MySQL aprobados y ensayar el procedimiento de
   backup/restore fuera de producción.
10. Preparar credenciales separadas y de mínimo privilegio para cada checkpoint
    de 16B.
11. Confirmar artefactos y mecanismos reales de rollback de frontend y backend,
    y disponibilidad de PITR.
12. Reconfirmar cafetería cerrada y ejecutar el preflight final read-only con
    datos actuales inmediatamente antes de 16B.

## Resultado

La auditoría cumplió su objetivo sin modificar producción, pero existen bloqueos
de infraestructura que impiden autorizar 16B. Estado: **INFRAESTRUCTURA
BLOQUEADA — RESOLVER PENDIENTES**.
