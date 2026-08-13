# Diagnóstico de calidad — Etapa 6

## Archivos abordados

- `backend/src/modules/orders/order.controller.ts`: se extrajo únicamente la identidad pura usada al fusionar productos. Las transacciones de pedido, pago y caja permanecen juntas porque no existe una base MySQL aislada para demostrar una separación más profunda.
- `src/app/features/orders/pending-orders/pending-orders.component.ts`: el adaptador de productos quedó aislado y probado.
- `src/app/features/expenses/expenses/expenses.component.ts`: filtros y agregaciones quedaron como funciones puras probadas.
- `src/app/app.component.ts`: la suscripción global de sesión se libera al destruir la aplicación.

## Plan posterior para archivos grandes

| Archivo | Líneas aproximadas | Próxima extracción segura | Requisito previo |
|---|---:|---|---|
| `pos.component.ts` | 2160 | Adaptadores y cálculos puros de presentación | Pruebas de POS y pedidos directos |
| `reports.component.ts` | 2089 | Transformaciones de filas y totales por reporte | Datos de prueba representativos |
| `products-admin.component.ts` | 2019 | Adaptador API/formulario e imagen | Pruebas de creación y edición |
| `printer.service.ts` | 1144 | Abstracción tipada de Web Bluetooth | Mocks estables del navegador |
| `checkout.component.ts` | 1111 | Estado y mensajes del flujo Mercado Pago | Pruebas de los estados de pago |
| `cash-register.component.ts` | 912 | Cálculos derivados de caja | Base MySQL aislada o repositorios simulados |

No deben moverse transacciones, consultas Prisma ni flujos de Mercado Pago hasta contar con pruebas integrales aisladas.
