# Etapa 16A.2 — Preflight productivo de solo lectura

Estado: **preparado, no ejecutado**. Este procedimiento requiere una autorización
separada y explícita. No autoriza migraciones, despliegues ni cambios de
configuración.

## Alcance permitido

- consultar paneles del proveedor sin modificar valores;
- ejecutar `GET /health` y revisar TLS/cabeceras de una URL ya desplegada;
- consultar versiones, `SELECT`, `SHOW` e `information_schema` con una cuenta
  MySQL de privilegio mínimo y sólo lectura;
- comprobar la existencia de variables sin revelar sus valores;
- intentar el handshake de Socket.IO sin emitir eventos de negocio, sólo si ya
  existe una credencial de prueba no mutante y autorizada;
- guardar evidencia sanitizada: fecha, commit, estado y conteos, nunca secretos.

## Acciones expresamente prohibidas

- `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP` o procedimientos que
  escriban;
- `prisma migrate`, `prisma db push`, `migrate reset` o `migrate dev`;
- deploy, reinicio, cambio de variables, DNS, CORS, callbacks o credenciales;
- login si el flujo pudiera migrar o reescribir una contraseña heredada;
- ventas, pagos, gastos, aperturas/cierres de caja o eventos Socket de negocio;
- mostrar `DATABASE_URL`, tokens, contraseñas, secretos JWT o credenciales.

## Checkpoints y evidencia esperada

### 1. Identidad del artefacto

Registrar rama, commit completo y estado limpio del artefacto candidato. El
commit debe coincidir con el que se pretenda evaluar. Una divergencia es NO-GO.

### 2. Arquitectura real

Leer de los paneles autorizados, sin editar:

- proveedor y URL HTTPS exacta del frontend;
- proveedor y URL HTTPS exacta del backend;
- host lógico, puerto y nombre de base MySQL, sin usuario ni contraseña;
- comando de build/start y cantidad de instancias;
- versión real de Node y política de actualización del proveedor.

Todo dato que no pueda verificarse se conserva como `PENDIENTE DE
CONFIRMACIÓN PRODUCTIVA` y mantiene el NO-GO para migrar.

### 3. HTTP y TLS

Realizar exclusivamente un `GET` al health check existente. Evidencia mínima:
status HTTP, fecha, URL sin parámetros sensibles, certificado válido y cabeceras
CORS observadas. No usar `POST`, no iniciar sesión y no invocar rutas de negocio.

### 4. Frontend, API, CORS y Socket.IO

Confirmar que el frontend usa la URL real esperada y no `localhost`. Comparar el
origen exacto con `FRONTEND_ORIGINS` y `SOCKET_ORIGINS` sin copiar los valores
completos fuera del panel. Si es viable sin mutación, comprobar únicamente la
conexión/handshake Socket.IO; no emitir eventos. Un origen comodín, HTTP o una
URL inconsistente es NO-GO.

### 5. Base y esquema

Con una cuenta restringida a lectura, ejecutar
[01-preflight-readonly.sql](./production-runbook/01-preflight-readonly.sql). La
salida debe incluir:

- `VERSION()`, `DATABASE()`, `@@hostname` y hora del snapshot;
- tablas/columnas críticas y `SHOW CREATE TABLE`;
- índices de `Payment` y `Expense`;
- conteos, sumas, estados y anomalías referenciales;
- Order 1023, sus Payments y CashRegister 96;
- duplicados globales de Payment;
- presencia, definición e historial de `_prisma_migrations`.

No continuar si el destino no coincide, la cuenta permite escrituras, aparece
una anomalía inesperada o la historia Prisma no se puede explicar.

### 6. Mercado Pago

Sólo verificar en el panel que existen las variables requeridas por el código:
`MP_ACCESS_TOKEN`, `MP_SUCCESS_URL`, `MP_PENDING_URL`, `MP_FAILURE_URL`,
`MP_AUTO_RETURN`, `MP_POINT_TERMINAL_ID`, `MP_POINT_TERMINAL_SERIAL`,
`MP_POINT_STORE_ID`, `MP_POINT_POS_ID` y `MP_POINT_PRINT_ON_TERMINAL` cuando
apliquen. No revelar valores, probar cobros ni cambiar callbacks. El repositorio
auditado no define una variable ni una ruta de webhook propia; no inventarla.

### 7. Capacidad de respaldo

Confirmar únicamente que el operador autorizado dispone de `mysqldump`, espacio,
ubicación externa al despliegue y una base desechable para el ensayo. La creación
y restauración del backup requieren autorización posterior; en 16A.2 no se
ejecutan por defecto.

### 8. Decisión

El reporte debe separar hechos comprobados, pendientes y datos no disponibles.
Un preflight aprobado sólo habilita solicitar la siguiente etapa; no autoriza
escrituras ni migraciones.

## Formato de cierre

```text
Commit verificado:
Frontend URL/proveedor:
Backend URL/proveedor:
Node productivo:
Health/TLS:
CORS:
Socket.IO:
MySQL destino/versión:
Esquema e índices:
Historia Prisma:
Conteos y duplicados:
Mercado Pago (existencia, sin valores):
Capacidad de backup:
Pendientes:
Resultado: APROBADO / BLOQUEADO
```
