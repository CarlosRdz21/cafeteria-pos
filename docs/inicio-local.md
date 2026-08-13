# Inicio local seguro

## Requisitos

- Node 22 LTS recomendado.
- MySQL local en `localhost:3306`.
- Base `cafeteria_pos_test`.
- Usuario MySQL limitado exclusivamente a `cafeteria_pos_test.*`.
- `backend/.env.test` local e ignorado por Git, basado en
  `backend/.env.local.example`.

## Preparación

1. Inicia MySQL.
2. Desde `backend`, ejecuta `npm run db:test:validate`,
   `npm run db:test:inspect` y `npm run db:test:connection`.
3. Define `LOCAL_SEED_PASSWORD` sólo en la terminal actual, con al menos 12
   caracteres, y ejecuta `npm run seed:local`. No guardes esa contraseña en Git.
4. Inicia el backend con `npm run dev:local`.
5. En otra terminal, desde la raíz, ejecuta `npm run start:local`.
6. Abre `http://localhost:4200`.

Usuarios ficticios: `admin_local`, `barista_local`, `mesero_local` e
`inactivo_local`. Los cuatro usan la contraseña proporcionada mediante
`LOCAL_SEED_PASSWORD`; el último debe ser rechazado.

## Comprobaciones

- Health: `http://localhost:3000/api/health`.
- Smoke protegido: define temporalmente `LOCAL_SEED_PASSWORD` y ejecuta
  `npm run test:local:smoke` desde `backend`.
- La consola debe mostrar etiquetas `[LOCAL]` y la base
  `cafeteria_pos_test`, nunca una URL completa.

## Detención

Usa `Ctrl+C` en frontend y backend. Comprueba que no existan listeners en los
puertos 3000 y 4200. No uses hooks de despliegue, Render, Hostinger, DNS,
Mercado Pago real ni una base llamada `cafeteria_pos`.

