# Migración a MySQL (Prisma) desde CleanExportSnapshot

## 1) Configurar MySQL

- Crea una base de datos (ej. `cafeteria_pos`)
- Copia `backend/.env.mysql.example` a `backend/.env`
- Ajusta `DATABASE_URL`

Ejemplo:

```env
DATABASE_URL="mysql://usuario:password@host:3306/cafeteria_pos"
```

## 2) Instalar dependencias

```bash
cd backend
npm install
```

## 3) Generar cliente Prisma con schema MySQL

```bash
npm run prisma:mysql:generate
```

## 4) Crear tablas en MySQL

Opciones:

- Desarrollo (con migración):

```bash
npm run prisma:mysql:migrate -- --name init_mysql_pos
```

- Rápido (sin migración SQL versionada):

```bash
npm run prisma:mysql:push
```

## 5) Exportar snapshot limpio desde la app

Usa en frontend el método:

```ts
const snapshot = await db.buildCleanExportSnapshot();
```

Guárdalo como JSON (ej. `clean-snapshot.json`).

## 6) Importar snapshot a MySQL

```bash
npm run import:clean-snapshot -- ../clean-snapshot.json
```

Para limpiar tablas antes de importar:

```bash
npm run import:clean-snapshot -- ../clean-snapshot.json --truncate
```

## Notas

- El script valida `integrity` del snapshot (si existe).
- Usa `categoryId` + catálogos (productos/insumos).
- Genera pagos automáticos desde `order.paymentMethod` si el snapshot no trae tabla de pagos separada.
- Los usuarios se importan con `username` y un `email` local generado (`@local.migrated`) para compatibilidad con el backend actual.

