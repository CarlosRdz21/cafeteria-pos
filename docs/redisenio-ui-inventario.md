# Inventario visual — rediseño Dulce Aroma Café

Fecha de revisión: 13 de agosto de 2026  
Rama: `ui/redisenio-completo-dulce-aroma`

## Diagnóstico general

La aplicación utiliza Angular standalone y Angular Material. La mayor parte de las pantallas mantiene su plantilla y estilos dentro del archivo `.ts`; los archivos HTML/SCSS externos que existen en algunas funcionalidades no siempre son la fuente renderizada. Actualmente no hay un shell compartido: cada pantalla incorpora su propia barra azul, navegación y espaciado. El tema global es `indigo-pink`, por lo que el azul/morado aparece como identidad principal.

El rediseño puede realizarse sin cambiar rutas, servicios, contratos ni reglas de negocio. El shell requiere cambios limitados en `AppComponent.ts` únicamente para presentación: sesión visible, navegación por rol, drawer móvil, fecha/hora e indicador de conexión.

| Pantalla | Archivo | Estado actual | Problema visual | Estrategia |
|---|---|---|---|---|
| Shell general | `src/app/app.component.ts` | Solo renderiza `router-outlet` | No existe navegación o marco compartido | Crear shell café con sidebar, topbar y contenido; ocultarlo en login |
| Menú lateral | No existe | Navegación duplicada en menús de cada pantalla | Descubribilidad baja e inconsistencia | Sidebar fijo en escritorio y drawer en móvil, filtrado por roles actuales |
| Topbar | No existe como componente global | Cada vista usa toolbar azul | Repite marca y acciones; no muestra contexto | Topbar global con usuario, rol, fecha, hora y conexión |
| Login | `src/app/features/auth/login/login.component.ts` | Card blanca sobre degradado azul/morado | No representa la identidad de cafetería | Fondo café, panel premium, logo actual, campos oscuros y botón crema |
| POS | `src/app/features/pos/pos.component.ts` | Toolbar azul, productos y orden en paneles claros | Jerarquía genérica y navegación duplicada | Grid premium: catálogo oscuro y orden sticky; conservar todos los eventos |
| Categorías POS | `src/app/features/pos/pos.component.ts` | Chips grises/azules | Selección poco integrada con la marca | Chips café/crema con estados accesibles |
| Productos POS | `src/app/features/pos/pos.component.ts` | Cards claras con imágenes | Espaciado y acciones poco consistentes | Cards cálidas, imagen dominante, hover y precio destacado |
| Orden actual | `src/app/features/pos/pos.component.ts` | Panel blanco lateral | Total y acciones compiten visualmente | Panel sticky oscuro, resumen legible y CTA crema |
| Variantes de producto | `src/app/features/pos/pos.component.ts` | Diálogo Material con estilos locales | Formulario denso | Secciones, chips y acciones consistentes sin cambiar selecciones |
| Comandas pendientes | `src/app/features/orders/pending-orders/pending-orders.component.ts` | Toolbar azul y cards operativas claras | Estados y acciones no tienen jerarquía uniforme | Cards operativas oscuras con badges y acciones existentes |
| Edición de comanda | `src/app/features/orders/pending-orders/pending-orders.component.ts` | Diálogo inline | Lectura densa | Ordenar visualmente productos, totales y acciones |
| Checkout | `src/app/features/orders/checkout/checkout.component.ts` | Formulario claro de una columna principal | Separación débil entre resumen y pago | Dos columnas en escritorio y apilado móvil |
| Pago efectivo | `src/app/features/orders/checkout/checkout.component.ts` | Campo, sugerencias y cambio sobre blanco | El cambio no domina suficientemente | Panel de efectivo, sugerencias crema y cambio destacado |
| Pago tarjeta/Mercado Pago | `src/app/features/orders/checkout/checkout.component.ts` | Controles Material estándar | Estados desconectados del tema | Panel consistente sin cambiar proveedores ni flujo |
| Caja y apertura | `src/app/features/cash/cash-register/cash-register.component.ts` | Toolbar azul y cards claras | Apariencia administrativa genérica | Dashboard de caja con KPIs oscuros y CTA principal |
| Cierre de caja | `src/app/features/cash/cash-register/cash-register.component.ts` | Formulario/dialog Material | Diferencia y esperado sin jerarquía premium | Resumen contable y estados semánticos accesibles |
| Reportes | `src/app/features/reports/reports/reports.component.ts` | Dashboard amplio blanco con acentos multicolor | Paleta fragmentada y tablas genéricas | KPIs, pestañas, gráficas CSS y tablas en café/crema |
| Ventas en reportes | `src/app/features/reports/reports/reports.component.ts` | Tabla/cards claras | Acciones y montos dispersos | Tabla moderna, totales alineados y acciones discretas |
| Inventario en reportes | `src/app/features/reports/reports/reports.component.ts` | Cards claras | Alertas dependen demasiado del color | Cards con badges, iconos y contraste adicional |
| Gastos en reportes | `src/app/features/reports/reports/reports.component.ts` | Tabla Material clara | Inconsistente con otros listados | Tabla temática con cabecera y hover unificados |
| Gastos | `src/app/features/expenses/expenses/expenses.component.ts` | Formulario, KPIs e historial sobre gris claro | Bloques poco diferenciados | Dashboard por secciones con superficies cálidas |
| Administración de insumos | `src/app/features/inventory/supplies-admin/supplies-admin.component.ts` | Formulario/listado Material claro | Alta densidad y acciones flotantes | Formulario por bloques y cards de inventario |
| Movimientos de insumos | `src/app/features/inventory/inventory-movements/inventory-movements.component.ts` | Formulario, filtros, KPIs e historial | Jerarquía vertical débil | Separar registro, filtros, indicadores e historial |
| Administración de productos | `src/app/features/products/products-admin/products-admin.component.ts` | Componente extenso con formulario y listado | Secciones largas y difícil escaneo | Agrupar visualmente información, variantes, ingredientes e inventario |
| Promociones | `src/app/features/promotions/promotions-admin/promotions-admin.component.ts` | Formulario y cards claras | Estado/alcance poco destacados | Cards con badges, vigencia y acciones consistentes |
| Usuarios | `src/app/features/users/users-admin/users-admin.component.ts` | Listado administrativo claro | Roles y estados con poca distinción | Tabla/cards modernas con badges semánticos |
| Impresora | `src/app/features/settings/printer-settings/printer-settings.component.ts` | Formulario Material aislado | No parece parte de Settings | Card de configuración con jerarquía y ayuda contextual existente |
| Configuración | `src/app/features/settings/settings/settings.component.ts` | Ajustes de servidor/red en card clara | Layout aislado | Layout Settings en cards temáticas |
| Diagnóstico de red | `src/app/features/settings/network-test/network-test.component.ts` | Pantalla técnica clara | Resultado difícil de escanear | Estado de conexión y pasos en paneles semánticos |
| Diálogos y confirmaciones | Varios componentes y `ui-dialog.service.ts` | Estilos Material predeterminados | Apariencia inconsistente | Overrides globales de overlay, título y acciones |
| Formularios | Todos los componentes | `mat-form-field` estándar indigo | Focus y errores no siguen la marca | Tokens globales para input, label, focus, error y disabled |
| Botones | Todos los componentes | Mezcla de primary/accent/warn | Azul/morado dominante | Primary crema, secondary café, danger rojo y focus visible |
| Tablas | Reportes y administración | Material blanco | Pierden contexto sobre fondos oscuros | Cabecera discreta, filas cálidas, hover y scroll seguro |
| Estados vacíos | POS, comandas, reportes, gastos e inventario | Iconos/textos aislados | Poco consistentes | Patrón global con icono, título, texto y CTA existente |
| Errores y snackbars | Varios componentes | Snackbars Material | Contraste y jerarquía variables | Superficies oscuras y borde semántico |
| Loaders/disabled | Login, checkout y acciones async | Texto/botón deshabilitado | Estado visual tenue | Opacidad, cursor y contraste consistentes |
| Responsive | Todas las pantallas | Reglas locales parciales | Toolbars y formularios pueden saturarse | Breakpoints compartidos; sidebar drawer y grids fluidos |

## Riesgos visuales a controlar

- Muchas plantillas y hojas de estilo son inline; los cambios deben hacerse en el `.ts` renderizado y no en archivos externos obsoletos.
- Las toolbars locales contienen acciones funcionales. No deben ocultarse globalmente hasta trasladar o conservar todas esas acciones en el grupo correspondiente.
- La vista POS ya posee navegación por menú; durante UI-1 coexistirá temporalmente con el sidebar hasta rediseñar POS en UI-2.
- Los iconos Material se mantienen porque ya forman parte de la aplicación; no se instalará otra librería.
- Los contrastes de crema sobre café se validarán con foco visible y sin depender exclusivamente del color.

## Orden aprobado

1. UI-1: sistema global, shell, sidebar, topbar y login.
2. UI-2: POS, orden, categorías y productos.
3. UI-3: comandas, checkout y pagos.
4. UI-4: caja y cierre.
5. UI-5: reportes.
6. UI-6: inventario, insumos y movimientos.
7. UI-7: gastos, productos y promociones.
8. UI-8: usuarios, impresora y configuración.
9. UI-9: responsive, accesibilidad y limpieza visual.
