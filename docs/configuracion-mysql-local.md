# Configuración de MySQL local

La única base autorizada por los scripts de prueba es
`localhost:3306/cafeteria_pos_test`. `DATABASE_URL` debe coincidir exactamente
con `TEST_DATABASE_URL` y diferir de `PRODUCTION_DATABASE_URL`.

SQL conceptual para un usuario nuevo (elige usuario y contraseña locales; no
los copies al repositorio):

```sql
CREATE DATABASE IF NOT EXISTS cafeteria_pos_test;
CREATE USER IF NOT EXISTS 'usuario_test'@'localhost' IDENTIFIED BY 'CAMBIAR_LOCALMENTE';
GRANT ALL PRIVILEGES ON cafeteria_pos_test.* TO 'usuario_test'@'localhost';
SHOW GRANTS FOR 'usuario_test'@'localhost';
```

No otorgues privilegios globales (`*.*`) ni acceso a otras bases. La inspección
de esta etapa confirmó dos grants, cero alcances externos y cero privilegios
prohibidos para el usuario local existente.

Comandos seguros:

```powershell
cd backend
npm run db:test:validate
npm run db:test:inspect
npm run db:test:connection
npm exec prisma validate -- --schema prisma/schema.mysql.prisma
npm exec prisma migrate status -- --schema prisma/schema.mysql.prisma
```

No ejecutes `migrate reset`, `db push`, `DROP DATABASE` ni comandos Prisma si
la guarda no confirma host, puerto y base. Las migraciones locales se ejecutan
mediante los scripts protegidos existentes.

