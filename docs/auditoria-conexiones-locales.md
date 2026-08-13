# Auditoría de conexiones locales — Etapa 14A

Fecha: 2026-07-26. Rama: `dev/etapa-14a-entorno-local`.

La ruta activa local queda limitada a Angular `localhost:4200` → Express/Socket.IO
`localhost:3000` → MySQL `localhost:3306/cafeteria_pos_test`. No se consultó ni
modificó Render, Hostinger, DNS o la aplicación productiva.

| Archivo | Variable o referencia | Destino actual | Riesgo | Acción |
|---|---|---|---|---|
| `src/app/core/config/server.config.ts` | API y Socket.IO | `http://localhost:3000` | Bajo | Valida protocolo, host y puerto; descarta valores externos de `localStorage`. |
| `backend/scripts/start-local.js` | `DATABASE_URL` y `TEST_DATABASE_URL` | Archivo ignorado `.env.test` | Bajo | Ejecuta el guardián antes de iniciar y elimina credenciales de Mercado Pago del proceso. |
| `backend/src/app.ts` | CORS REST | `localhost:4200`, `127.0.0.1:4200` | Bajo | Rechaza orígenes externos y comodín. |
| `backend/src/server.ts` | CORS Socket.IO | Orígenes locales anteriores | Bajo | Usa un validador específico y conserva contratos/eventos. |
| `backend/.env.hostinger.example` | Plantilla histórica de despliegue | Marcadores, no flujo local | Medio | Se conserva como documentación; nunca la carga `dev:local`. |
| `backend/.env.mysql.example` | URLs de retorno y plantilla MySQL | Marcadores/productivo documental | Medio | Se conserva aislada; no participa en scripts locales. |
| `docs/seguridad-frontend.md` | Hostinger | Contexto histórico | Bajo | Documentación, sin ejecución. |
| pruebas `*.spec.ts` | Render/dominio productivo | Valores ficticios de rechazo | Bajo | Son casos negativos que comprueban el bloqueo. |

No quedaron referencias activas a Render, Hostinger o al dominio productivo en
la configuración ejecutada por `start:local`, `dev:local`, API o Socket.IO.
Las menciones restantes son plantillas históricas, documentación o pruebas de
rechazo.

