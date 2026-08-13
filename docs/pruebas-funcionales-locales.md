# Pruebas funcionales locales

## Automatizadas

`npm run test:local:smoke` valida contra el backend local:

- health HTTP 200;
- login de administrador, barista y mesero;
- rechazo del usuario inactivo;
- creación/autenticación/eliminación de un usuario temporal;
- creación, consulta y eliminación de un pedido temporal;
- limpieza posterior y cierre del servidor.

Las suites unitarias cubren permisos, pagos idempotentes, caja, inventario,
promociones, reportes, errores MySQL y seguridad Socket.IO. Las integraciones
MySQL usan el mismo guardián y limpian sus prefijos temporales.

## Lista manual reproducible

Con el seed cargado y ambas aplicaciones iniciadas, registra fecha y resultado
de: apertura/cierre de caja, modificación/finalización de pedido, efectivo y
reintento, gasto, alta de producto, movimiento de inventario, promoción,
reportes, dos pestañas Socket.IO, caída/reconexión del backend, error controlado
de impresora y cierre de sesión.

No se debe probar Mercado Pago real. Al finalizar, elimina sólo datos
temporales identificables, conserva el seed mínimo, ejecuta
`npm run db:test:inspect` y confirma que los puertos 3000/4200 quedaron libres.

