# Matriz de seguridad de rutas — Etapa 5

Esta matriz documenta el contrato de acceso derivado de las rutas backend y de los guards y controles visibles del frontend. `mesero` es el rol persistido por la administración actual; `waiter` se conserva como variante legacy tipada por la sesión Angular.

| Método | Endpoint | Módulo | JWT | Roles permitidos | Estado antes de Etapa 5 |
|---|---|---|---|---|---|
| GET | `/` | sistema | No | Público | Público |
| GET | `/health` | sistema | No | Público | Público |
| GET | `/api/health` | sistema | No | Público | Público |
| POST | `/api/auth/login` | auth | No | Público | Público |
| GET | `/api/auth/debug/users` | auth | Sí, además token debug | admin | Solo token debug |
| GET | `/api/users` | usuarios | Sí | admin | Público |
| POST | `/api/users` | usuarios | Sí | admin | Público |
| PUT | `/api/users/:id` | usuarios | Sí | admin | Público |
| DELETE | `/api/users/:id` | usuarios | Sí | admin | Público |
| GET | `/api/printer-settings` | impresión | Sí | admin, barista | Público |
| PUT | `/api/printer-settings` | impresión | Sí | admin, barista | Público |
| GET | `/api/products` | productos | Sí | admin, barista, mesero/waiter | Público |
| POST | `/api/products` | productos | Sí | admin | Público |
| PUT | `/api/products/:id` | productos | Sí | admin | Público |
| DELETE | `/api/products/:id` | productos | Sí | admin | Público |
| GET | `/api/product-categories` | productos | Sí | admin, barista, mesero/waiter | Público |
| POST | `/api/product-categories` | productos | Sí | admin | Público |
| PATCH | `/api/product-categories/:id` | productos | Sí | admin | Público |
| DELETE | `/api/product-categories/:id` | productos | Sí | admin | Público |
| GET | `/api/promotions` | promociones | Sí | admin, barista, mesero/waiter | Público |
| PUT | `/api/promotions` | promociones | Sí | admin | Público |
| DELETE | `/api/promotions/:id` | promociones | Sí | admin | Público |
| GET | `/api/supplies` | inventario | Sí | admin | Público |
| POST | `/api/supplies` | inventario | Sí | admin | Público |
| PUT | `/api/supplies/:id` | inventario | Sí | admin | Público |
| GET | `/api/supply-categories` | inventario | Sí | admin | Público |
| POST | `/api/supply-categories` | inventario | Sí | admin | Público |
| GET | `/api/supply-movements` | inventario | Sí | admin, barista | Público |
| POST | `/api/supply-movements/entry` | inventario | Sí | admin, barista | Público |
| POST | `/api/supply-movements/exit` | inventario | Sí | admin, barista | Público |
| GET | `/api/expenses` | gastos | Sí | admin, barista | Público |
| POST | `/api/expenses` | gastos | Sí | admin, barista | Público |
| DELETE | `/api/expenses/:id` | gastos | Sí | admin | Solo admin |
| GET | `/api/cash-registers/current` | caja | Sí | admin, barista | Público |
| GET | `/api/cash-registers` | caja | Sí | admin, barista | Público |
| POST | `/api/cash-registers/open` | caja | Sí | admin, barista | Público |
| POST | `/api/cash-registers/current/close` | caja | Sí | admin, barista | Público |
| POST | `/api/cash-registers/current/record-sale` | caja | Sí | admin, barista | Público |
| POST | `/api/cash-registers/current/record-expense` | caja | Sí | admin, barista | Público |
| POST | `/api/orders` | pedidos | Sí | admin, barista, mesero/waiter | Público |
| GET | `/api/orders` | pedidos | Sí | admin, barista, mesero/waiter | Público |
| GET | `/api/orders/:id` | pedidos | Sí | admin, barista, mesero/waiter | Público |
| PUT | `/api/orders/:id` | pedidos | Sí | admin, barista, mesero/waiter | Público |
| PATCH | `/api/orders/:id/status` | pedidos | Sí | admin, barista, mesero/waiter | Público |
| PATCH | `/api/orders/:id/cancel` | pedidos | Sí | admin, barista, mesero/waiter | Público |
| DELETE | `/api/orders/:id` | pedidos | Sí | admin | Solo admin |
| POST | `/api/payments` | pagos | Sí | admin, barista, mesero/waiter | Público |
| POST | `/api/payments/mercado-pago/preference` | pagos | Sí | admin, barista, mesero/waiter | Público |
| POST | `/api/payments/mercado-pago/verify` | pagos | Sí | admin, barista, mesero/waiter | Público |
| POST | `/api/payments/mercado-pago/point/order` | pagos | Sí | admin, barista | Público |
| GET | `/api/payments/mercado-pago/point/order/:id` | pagos | Sí | admin, barista | Público |
| GET | `/api/payments/reports` | reportes | Sí | admin, barista | Público |

## Criterios

- `401` se usa cuando falta el JWT o no puede verificarse.
- `403` se usa cuando el JWT es válido, pero el rol no está permitido.
- Los guards Angular reflejan navegación y visibilidad, pero la autorización efectiva corresponde al backend.
- Los endpoints públicos se limitan al estado del servicio y al inicio de sesión.
- No hay webhooks públicos registrados actualmente.
