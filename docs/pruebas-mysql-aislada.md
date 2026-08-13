# Base MySQL aislada para pruebas

El smoke test y las futuras pruebas de integracion deben usar una base separada. Nunca deben apuntar a la base operativa.

## Configuracion recomendada

- Base sugerida: `cafeteria_pos_test`.
- Usuario sugerido: `cafeteria_pos_test_runner`.
- Conceder permisos solamente sobre `cafeteria_pos_test`.
- No reutilizar el usuario, contraseña ni host de produccion.
- Mantener `TEST_DATABASE_URL` fuera de Git.
- Definir `PRODUCTION_DATABASE_URL` solo para que la proteccion pueda comparar URLs; no imprimirla.

Variables requeridas para el smoke test:

```text
NODE_ENV=test
ALLOW_DESTRUCTIVE_TESTS=true
DATABASE_URL=mysql://USUARIO_PRUEBAS:CLAVE_PRUEBAS@HOST_PRUEBAS:3306/cafeteria_pos_test
TEST_DATABASE_URL=mysql://USUARIO_PRUEBAS:CLAVE_PRUEBAS@HOST_PRUEBAS:3306/cafeteria_pos_test
PRODUCTION_DATABASE_URL=mysql://VALOR_NO_MOSTRADO
TEST_BASE_URL=http://127.0.0.1:3001
TEST_ADMIN_USERNAME=ADMIN_EXISTENTE_DE_PRUEBAS
TEST_ADMIN_PASSWORD=CLAVE_DEL_ADMIN_DE_PRUEBAS
```

El script se niega a continuar si `NODE_ENV=production`, falta la autorizacion explicita, las URLs activas no coinciden, el nombre no contiene `test`, `testing`, `qa` o `ci`, o la URL coincide con `PRODUCTION_DATABASE_URL`.

## Permisos minimos y validacion previa

Comandos conceptuales para una instalacion aislada:

```sql
CREATE DATABASE `cafeteria_pos_test`;
CREATE USER 'cafeteria_pos_test_runner'@'HOST_PRUEBAS'
  IDENTIFIED BY 'CLAVE_CONFIGURADA_FUERA_DE_GIT';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `cafeteria_pos_test`.* TO 'cafeteria_pos_test_runner'@'HOST_PRUEBAS';
SHOW GRANTS FOR 'cafeteria_pos_test_runner'@'HOST_PRUEBAS';
```

No se debe otorgar acceso a `*.*`, `GRANT OPTION`, `SUPER`, `PROCESS` ni
`FILE`. Agregar `DROP` solamente durante un reset expresamente autorizado y
revocarlo cuando deje de ser necesario.

Desde `backend`, `npm run db:test:validate` carga `.env.test`, comprueba la
separacion estatica y muestra la URL con la contrasena oculta. Este comando no
abre conexiones ni modifica MySQL.

Antes de cualquier conexion real todavia se debe:

1. comprobar `SHOW GRANTS` y confirmar que el usuario no accede a otras bases;
2. confirmar que la base no contiene datos reales;
3. guardar un respaldo logico de la base aislada fuera del repositorio;
4. conservar `ALLOW_DESTRUCTIVE_TESTS=false` salvo durante una operacion
   destructiva expresamente autorizada.

## Procedimiento manual exacto

1. Crear una base nueva cuyo nombre contenga `test`, `testing`, `qa` o `ci`; no
   reutilizar una copia conectada a producción.
2. Crear un usuario MySQL limitado a esa base y sin permisos globales. Guardar
   sus credenciales fuera del repositorio.
3. Revisar host y nombre visualmente, validar `schema.mysql.prisma` y aplicar el
   esquema únicamente a la base aislada. No usar `migrate reset`.
4. Configurar las variables mostradas arriba. `DATABASE_URL` debe ser
   exactamente igual a `TEST_DATABASE_URL`, y `PRODUCTION_DATABASE_URL` debe
   ser distinta. Crear un administrador exclusivo de pruebas.
5. Confirmar de nuevo la URL sin imprimir la contraseña y arrancar el backend
   con `NODE_ENV=test` en `TEST_BASE_URL`.
6. Desde `backend`, ejecutar `npm run test:smoke`. El script debe terminar con
   `SMOKE_OK`.
7. Verificar que el pedido y el usuario con prefijo `qa_smoke_` fueron
   eliminados por el bloque `finally`. Si quedó alguno, inspeccionarlo y
   eliminar sólo ese registro en la base aislada.
8. Detener el backend y revocar el usuario o sus permisos temporales si ya no
   se utilizará la base.

No se incluye un comando automatico de `db push`, `migrate reset`, truncado o seed para evitar que una variable mal configurada destruya datos.

## Datos y limpieza

El smoke test crea nombres con prefijo `qa_smoke_`, propaga JWT, consulta el pedido y usa `try/finally` para eliminar primero el pedido y luego el usuario. Si la limpieza falla, el script muestra una advertencia sin tokens, contraseñas ni URLs.

La revisión estática de la Etapa 12 confirmó que el script:

- se bloquea con `NODE_ENV=production`;
- exige `ALLOW_DESTRUCTIVE_TESTS=true`;
- compara exactamente `DATABASE_URL` y `TEST_DATABASE_URL`;
- rechaza coincidencia con `PRODUCTION_DATABASE_URL`;
- exige un marcador de entorno de pruebas en el nombre de la base;
- genera nombres únicos;
- propaga JWT;
- elimina pedido y usuario en `finally`.

No se ejecutó el smoke test durante la Etapa 12.

Para una limpieza manual, buscar exclusivamente registros con el prefijo `qa_smoke_` dentro de la base confirmada de pruebas. Revisar el conjunto antes de borrar; no usar consultas masivas en una base no verificada.

Las pruebas de concurrencia para caja, IDs manuales e inventario requieren esta infraestructura y no se consideran aprobadas hasta ejecutarse contra ella.
