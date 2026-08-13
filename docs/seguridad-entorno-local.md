# Seguridad del entorno local

`backend/scripts/test-database-safety.js` bloquea:

- `NODE_ENV=production`;
- hosts distintos de `localhost` o `127.0.0.1`;
- bases distintas de `cafeteria_pos_test`;
- diferencia entre `DATABASE_URL` y `TEST_DATABASE_URL`;
- coincidencia con `PRODUCTION_DATABASE_URL`;
- marcadores de Render o Hostinger;
- operaciones destructivas sin `ALLOW_DESTRUCTIVE_TESTS=true`.

Los logs sólo muestran entorno, host, puerto y base. Usuario, contraseña y URL
completa permanecen ocultos. `.env`, `.env.*`, respaldos, claves, certificados
y logs están ignorados; sólo se versionan plantillas explícitamente seguras.

El frontend acepta exclusivamente `http://localhost:3000` o
`http://127.0.0.1:3000`. CORS REST y Socket.IO sólo permiten los orígenes
locales del puerto 4200. El script `dev:local` elimina del proceso
`MP_ACCESS_TOKEN` y `MP_DEVICE_ID`; la integración externa falla de forma
explícita si no hay token. La ausencia de impresora no impide el arranque y su
configuración continúa siendo local al dispositivo.

Producción no debe usar esta rama. No hacer push, merge, despliegue, cambios de
DNS, migraciones remotas ni copiar credenciales productivas.

