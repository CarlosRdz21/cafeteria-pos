# 05 — Preflight de infraestructura antes de 16B

Este checklist complementa el preflight contable. No autoriza despliegues,
migraciones ni cambios en producción.

## Condiciones de entrada

- [ ] Cafetería cerrada y operación detenida, confirmado nuevamente.
- [ ] URL y proveedor del backend confirmados por evidencia operativa.
- [ ] URL frontend, document root y método de publicación confirmados en
      Hostinger.
- [ ] Commit y artefactos autorizados identificados.
- [ ] Personal responsable y ventana/criterios de abortar confirmados.

## Frontend

- [ ] `npm ci` y `npm run build:prod` completan correctamente.
- [ ] Artefacto: `dist/cafeteria-pos`.
- [ ] Fallback SPA a `index.html` verificado.
- [ ] `assets/runtime-config.js` existe, es público, no contiene secretos y
      apunta al backend HTTPS correcto (o queda vacío si es same-origin).
- [ ] Orígenes raíz/`www` y política de redirección decididos.
- [ ] Política de caché: corta/no-cache para `index.html` y runtime config;
      larga para assets con hash.
- [ ] Snapshot anterior y restauración atómica probados.

## Backend

- [ ] Proveedor, servicio, URL HTTPS, proxy e instancias confirmados.
- [ ] Node remoto fijado y compatible; 22.x es el candidato validado localmente.
- [ ] Build `npm ci` + `npm run build:render`; start `npm start`.
- [ ] Migraciones separadas del start normal.
- [ ] `/health` o `/api/health` responde y la salud DB se comprueba por un
      mecanismo read-only adicional.
- [ ] Release anterior y rollback del proveedor identificados.

## CORS y Socket.IO

- [ ] `FRONTEND_ORIGINS` contiene cada origen HTTPS exacto y nunca `*`.
- [ ] `SOCKET_ORIGINS` contiene cada origen exacto requerido.
- [ ] Credenciales y preflight CORS funcionan desde el frontend desplegado.
- [ ] Polling y WebSocket entrante están soportados por proxy/proveedor.
- [ ] Handshake JWT autorizado conecta y desconecta sin eventos de negocio.

## MySQL, Prisma y backup

- [ ] Host `srv1102.hstgr.io`, puerto `3306` y base
      `u349605213_dulceAroma` reconfirmados sin imprimir secretos.
- [ ] Credenciales separadas/mínimas disponibles para preflight, backup,
      baseline, saneamiento, migración y runtime.
- [ ] Clientes `mysql`/`mysqldump` aprobados y con versión comprobada.
- [ ] Destino seguro y espacio suficiente verificados.
- [ ] Preflight final read-only aprobado con datos actuales.
- [ ] Backup final consistente creado, con tamaño, checksum, contenido y restore
      test validados en el checkpoint autorizado.
- [ ] Baseline Prisma sigue la estrategia aprobada en 16A.4.

## Mercado Pago

- [ ] Variables `MP_*` marcadas CONFIGURADA en el gestor del proveedor, sin
      copiar valores a logs o documentos.
- [ ] URLs de retorno HTTPS corresponden al frontend real.
- [ ] Se definió si se usa Checkout, Point y/o confirmación manual.
- [ ] No se ejecuta ninguna transacción hasta el smoke expresamente autorizado.

## Criterios de detenerse

Detener 16B si cambia cualquier conteo esperado del preflight, aparecen
escrituras operativas, falla el backup/restore, no existe rollback verificable,
la versión remota de Node no es compatible, health/DB no pasan, CORS no incluye
el frontend exacto o Socket.IO/WebSocket no conecta.

El estado y la evidencia completa de esta revisión están en
`docs/etapa-16a5-infraestructura-productiva.md`.
