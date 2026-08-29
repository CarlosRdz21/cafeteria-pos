# Migraciones archivadas

Este directorio conserva migraciones históricas que no pertenecen al historial
activo de MySQL. Prisma sólo ejecuta las carpetas ubicadas en `migrations/`.

## SQLite

`sqlite/20260201003637_init` corresponde al proveedor SQLite usado antes de la
migración definitiva a MySQL. Su SQL usa `AUTOINCREMENT`, identificadores entre
comillas dobles y tipos propios de SQLite. Nunca fue aplicado ni registrado en
`cafeteria_pos_test` y no debe marcarse artificialmente como aplicado.
