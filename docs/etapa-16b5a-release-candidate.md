# Etapa 16B.5-A — Release candidate local

Fecha: 2026-09-28.

## Alcance y estado previo

- Rama inicial: `test/integridad-contable-pos`.
- HEAD inicial: `55a7f9ca08c2a180fa6df6c8efba3ee493d808e1`.
- Referencia Live documentada: `5ebf4ce80ffcb21ba68ee709a9ea69998dc945c7`.
- Producción congelada; escrituras productivas: 0.
- No se autorizó push, merge, deploy, restart, SQL productivo ni reapertura del POS.

La verificación humana 16B.4-R3 confirmó, sin guardar cambios ni reiniciar:

- `NODE_ENV=production`;
- `FRONTEND_ORIGINS` con los dos orígenes HTTPS aprobados;
- contrato de entorno Render: PASS;
- pre-deploy técnico: GO.

No se registran valores secretos en este documento.

## Clasificación del working tree

### INCLUDE — configuración y pruebas frontend

- `angular.json`: enlaza la configuración Karma validada.
- `karma.conf.cjs`: launcher ChromeHeadless reproducible sin GPU.
- `src/assets/runtime-config.js`: base productiva única para API y Socket.IO.

### INCLUDE — manifests y lockfiles

- `backend/package.json`.
- `backend/package-lock.json`.
- `package.json`.
- `package-lock.json`.

Estos archivos fijan Prisma CLI/Client 6.12.0, `qs` 6.16.0 y el estado de
dependencias reproducido mediante `npm ci`.

### INCLUDE — herramientas de validación local

- `backend/scripts/restore-prod-clone-transaction-open-register.js`.
- `backend/scripts/verify-prod-clone-transaction-state.js`.

Ambas están limitadas al clon transaccional local y contienen controles de
destino. No contienen credenciales.

### INCLUDE — documentación

- `docs/etapa-16a2-preflight-productivo-resultado.md`.
- `docs/etapa-16b0-backup-productivo.md`.
- `docs/etapa-16b1-saneamiento-order-1023.md`.
- `docs/etapa-16b2-baseline-prisma.md`.
- `docs/etapa-16b3-aplicacion-esquema-productivo.md`.
- `docs/etapa-16b4-validacion-predeploy.md`.
- `docs/etapa-16b5a-release-candidate.md`.

### Prisma y hardening funcional

No existen cambios Prisma pendientes en el working tree. El schema canónico
`backend/prisma/schema.mysql.prisma`, las migraciones Payment/Expense y los
cambios de transacciones, concurrencia, caja, auth, usuarios, Socket.IO,
validación y shutdown ya forman parte del historial validado de la rama. El
schema SQLite legado no se modificó.

### EXCLUDE

- `.env` y `.env.*` locales con valores;
- dumps y backups `*.sql`;
- `node_modules`, `dist` frontend y `coverage`;
- logs, temporales, certificados, llaves, passwords y tokens.

Los elementos excluidos están ignorados y no forman parte del staged diff.

## Secret scan

El candidato fue inspeccionado antes de stage. No contiene llaves privadas,
JWT reales, tokens GitHub, tokens Mercado Pago ni credenciales productivas.
Las URLs MySQL encontradas son placeholders, destinos localhost o hosts
deliberadamente ficticios de pruebas. Resultado: PASS.

## Comparación contra Live

Live y candidato comparten la base
`46509ccd281f198e864cc35e2593458d6f0e9a3b`. Live conserva dos commits
exclusivos que sólo eliminan comentarios en archivos `.env.*.example`; la rama
candidata conserva 43 commits exclusivos antes del commit de release. El delta
funcional fue revisado en 16B.4-R2.

## Validación requerida del staged candidate

Antes del commit se exige y se registra en el reporte final de ejecución:

- backend audit productivo: 0/0/0/0;
- backend TypeScript/build: PASS;
- backend lint: 0 errores;
- backend unit: 231/231;
- backend integration local: 64/64;
- frontend audit productivo: 0 críticas, 5 altas, 4 moderadas, 0 bajas;
- frontend build: PASS;
- frontend tests: 55/55;
- API y Socket.IO: `https://api.dulcearomacafeteria.com`;
- SCSS budget: warning no bloqueante.

## Commit local

El hash del commit no puede incluirse dentro del propio commit sin romper su
reproducibilidad. Se registra en el reporte final de la etapa junto con el
`git show --stat`, el estado post-commit y la comparación final contra Live.

El commit permanece local. Push y deploy continúan no autorizados.
