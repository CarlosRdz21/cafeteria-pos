# Datos ficticios locales

`npm run seed:local` crea o actualiza de forma idempotente:

- usuarios `admin_local`, `barista_local`, `mesero_local` e `inactivo_local`;
- categoría `Bebidas de prueba [LOCAL]`;
- cinco productos ficticios marcados `[LOCAL]`;
- categoría e insumos ficticios marcados `[LOCAL]`;
- promoción `promocion-local-pruebas`.

La contraseña se recibe exclusivamente en `LOCAL_SEED_PASSWORD`, se transforma
con bcrypt y nunca se imprime. El script carga `.env.test`, pasa el guardián y
no contiene datos personales o comerciales reales.

Para eliminar sólo la semilla identificable:

```powershell
$env:ALLOW_DESTRUCTIVE_TESTS='true'
npm run seed:local:clean
```

La limpieza no trunca tablas ni elimina la base. Antes de usarla, confirma con
`npm run db:test:validate` que el destino es `cafeteria_pos_test`.

