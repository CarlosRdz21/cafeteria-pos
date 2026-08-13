# Caso de estudio: Cafeteria POS

## 1. Resumen ejecutivo

Cafeteria POS es una aplicacion de punto de venta desarrollada para apoyar la operacion diaria de una cafeteria. El sistema centraliza la toma de pedidos, la gestion de comandas, el cobro, la administracion de productos, el control de caja, el registro de gastos, el control de insumos y la consulta de reportes.

La solucion esta orientada a negocios pequenos o medianos que requieren agilizar la atencion al cliente, reducir errores manuales y mantener mayor visibilidad sobre ventas, inventario operativo y movimientos de caja. El proyecto combina una aplicacion web construida con Angular, un backend con Node.js y Express, persistencia mediante Prisma y base de datos, comunicacion en tiempo real con Socket.IO y empaquetado movil mediante Capacitor para Android.

## 2. Contexto del proyecto

En una cafeteria, los procesos operativos suelen depender de actividades repetitivas: registrar productos, tomar pedidos, enviar comandas, cobrar, controlar caja, revisar ventas, administrar insumos y dar seguimiento a gastos. Cuando estas tareas se realizan de forma manual o con herramientas separadas, pueden aparecer problemas como:

- Perdida de comandas o pedidos incompletos.
- Errores al calcular totales, cambios o pagos.
- Falta de seguimiento entre meseros, baristas y administradores.
- Dificultad para conocer el estado real de caja.
- Poca visibilidad sobre productos, promociones, gastos e insumos.
- Dependencia de registros fisicos que son dificiles de auditar.

Cafeteria POS busca resolver estos puntos mediante una plataforma unica que acompana el flujo completo de venta dentro del negocio.

## 3. Planteamiento del problema

El negocio requiere una herramienta que permita registrar ventas de manera rapida y confiable, separar responsabilidades por rol y mantener informacion actualizada para la toma de decisiones. Sin un sistema POS especializado, la cafeteria puede enfrentar retrasos en la atencion, errores de comunicacion entre el area de servicio y preparacion, diferencias en caja y falta de informacion historica para analizar el comportamiento de ventas.

El problema principal se puede resumir asi:

> La cafeteria necesita digitalizar y centralizar su operacion diaria para mejorar la rapidez de atencion, la trazabilidad de pedidos, el control financiero y la administracion de productos e insumos.

## 4. Objetivo general

Desarrollar un sistema POS para cafeteria que permita gestionar pedidos, pagos, comandas, caja, productos, usuarios, promociones, gastos e inventario de insumos desde una aplicacion moderna, segura y adaptable a dispositivos web y Android.

## 5. Objetivos especificos

- Registrar ordenes de venta con productos, cantidades, variantes y personalizaciones.
- Guardar comandas pendientes y notificarlas en tiempo real al personal correspondiente.
- Procesar pagos en efectivo y tarjeta, incluyendo calculo de cambio para pagos en efectivo.
- Controlar la apertura y cierre de caja.
- Registrar gastos asociados a la operacion del negocio.
- Administrar productos, categorias, insumos, movimientos de inventario y promociones.
- Gestionar usuarios con roles diferenciados.
- Consultar reportes administrativos.
- Configurar parametros de impresion para tickets o comandas.
- Permitir ejecucion como aplicacion web y como aplicacion Android mediante Capacitor.

## 6. Alcance del sistema

El sistema contempla los siguientes modulos principales:

| Modulo | Descripcion |
| --- | --- |
| Autenticacion | Inicio de sesion y proteccion de rutas segun el rol del usuario. |
| Punto de venta | Seleccion de productos, busqueda, filtros por categoria, armado de orden y calculo de totales. |
| Comandas pendientes | Registro y seguimiento de pedidos que aun no han sido cobrados o completados. |
| Checkout | Procesamiento de pagos y finalizacion de ordenes. |
| Caja | Apertura, cierre, ventas en efectivo, ventas con tarjeta, gastos y diferencias. |
| Productos | Administracion de productos, precios, imagenes, disponibilidad, categorias y variantes. |
| Promociones | Configuracion de descuentos o promociones aplicables a productos o categorias. |
| Insumos | Administracion de insumos, categorias, stock actual, costos y stock minimo. |
| Movimientos de insumos | Registro de entradas y salidas de inventario. |
| Gastos | Captura de gastos operativos y asociacion opcional a caja. |
| Usuarios | Administracion de cuentas, roles y estado activo. |
| Reportes | Consulta de informacion administrativa para ventas y operacion. |
| Impresora | Configuracion de datos del negocio e impresora termica. |
| Prueba de red | Validacion de conectividad con el servidor. |

## 7. Actores del sistema

### Administrador

Tiene acceso completo al sistema. Puede administrar productos, promociones, usuarios, insumos, reportes, caja, gastos y configuracion de impresora.

### Barista

Puede operar caja, visualizar y atender comandas, registrar movimientos de insumos, registrar gastos y acceder a funciones operativas necesarias para preparar pedidos.

### Mesero

Puede registrar pedidos y comandas desde el punto de venta, dando seguimiento a ordenes pendientes de acuerdo con los permisos configurados.

## 8. Descripcion funcional

### 8.1 Inicio de sesion y roles

El sistema utiliza autenticacion con token JWT en el backend. En el frontend, las rutas estan protegidas mediante guards que validan si el usuario esta autenticado y si cuenta con el rol necesario. Esto permite separar las responsabilidades del negocio y evitar accesos no autorizados a modulos administrativos.

### 8.2 Punto de venta

El modulo POS permite visualizar productos por categoria, buscar productos por nombre y agregarlos a una orden. La orden actual muestra cantidades, subtotales y total. Tambien permite limpiar productos, ajustar cantidades, guardar la orden como comanda pendiente o cobrar directamente cuando el rol del usuario lo permite.

El sistema considera productos personalizables, especialmente bebidas, con opciones como:

- Temperatura.
- Tamanos.
- Tipo de leche o agua.
- Sabores adicionales.
- Ingredientes removibles.
- Ingredientes extra con costo adicional.

### 8.3 Comandas pendientes

Las comandas pendientes permiten separar el registro del pedido del momento de cobro. Cuando se crea una orden pendiente, el backend emite eventos en tiempo real mediante Socket.IO para notificar a baristas y administradores. Esto mejora la comunicacion entre areas y reduce la dependencia de avisos verbales.

### 8.4 Pagos y checkout

El sistema permite completar ordenes con metodo de pago en efectivo o tarjeta. Para efectivo, registra el monto recibido y el cambio. Los pagos quedan asociados a la orden para facilitar reportes y seguimiento.

Tambien existe soporte en backend para integracion con Mercado Pago, incluyendo creacion de preferencias, verificacion de pagos y ordenes para terminal Point, lo que permite extender el sistema hacia pagos digitales.

### 8.5 Caja

El modulo de caja permite controlar la apertura y cierre de turnos. Registra monto inicial, ventas en efectivo, ventas con tarjeta, gastos, total de transacciones, monto esperado, monto final y diferencia. Este control ayuda a detectar inconsistencias y mantener trazabilidad financiera.

### 8.6 Administracion de productos y promociones

El administrador puede gestionar productos y categorias. Cada producto puede tener precio, descripcion, imagen, disponibilidad, categoria, stock opcional y configuraciones especiales para variantes o personalizaciones.

El sistema tambien incluye promociones activas, tipos de descuento, alcance por producto o categoria, vigencia por fechas y dias de la semana.

### 8.7 Insumos e inventario operativo

La aplicacion administra insumos por categoria, unidad de medida, stock actual, costo unitario y stock minimo. Los movimientos de insumos permiten registrar entradas y salidas, motivo, referencia, usuario responsable y notas. Esto ayuda a controlar materia prima usada en la operacion.

### 8.8 Gastos

El modulo de gastos permite registrar conceptos operativos, monto, categoria, usuario, notas y si el gasto se pago desde caja. Esto permite que el cierre de caja considere egresos reales del turno.

### 8.9 Reportes

El sistema cuenta con un modulo de reportes para administradores. Su objetivo es concentrar informacion relevante sobre ventas, pagos, caja y operacion para apoyar la toma de decisiones.

### 8.10 Impresion

La configuracion de impresora permite definir datos del negocio como nombre, direccion, telefono y parametros de corte de papel. En Android, el proyecto incluye un plugin nativo para impresora termica, lo que permite adaptar el POS a escenarios de uso fisico en mostrador.

## 9. Arquitectura tecnica

La aplicacion esta dividida en tres capas principales:

| Capa | Tecnologia | Responsabilidad |
| --- | --- | --- |
| Frontend | Angular 19, Angular Material, RxJS | Interfaz de usuario, navegacion, formularios, guards, consumo de API y comunicacion por sockets. |
| Backend | Node.js, Express, TypeScript, Socket.IO | API REST, autenticacion, reglas de negocio, eventos en tiempo real y gestion de pagos. |
| Persistencia | Prisma, MySQL | Modelado y acceso a datos para usuarios, productos, ordenes, pagos, caja, gastos, insumos y promociones. |
| Movil | Capacitor Android | Empaquetado de la aplicacion para dispositivos Android e integracion con funciones nativas. |

### 9.1 Componentes principales

- `src/app/pages`: contiene las pantallas funcionales del frontend.
- `src/app/core/services`: concentra servicios para consumir API, autenticacion, ordenes, pagos, caja, inventario, impresora y sockets.
- `backend/src/routes`: define los endpoints REST.
- `backend/src/controllers`: contiene la logica de entrada y salida de cada recurso.
- `backend/src/services`: agrupa reglas de negocio relacionadas con pagos, ordenes y autenticacion.
- `backend/prisma`: define el modelo de datos y migraciones.
- `android`: contiene la configuracion de la aplicacion Android generada con Capacitor.

## 10. Modelo de datos principal

El modelo de datos contempla las entidades necesarias para la operacion de una cafeteria:

- `User`: usuarios del sistema y roles.
- `ProductCategory`: categorias de productos.
- `Product`: productos vendibles, precios, disponibilidad y variantes.
- `Order`: ordenes de venta con estado pendiente, completado o cancelado.
- `OrderItem`: productos incluidos en cada orden.
- `Payment`: pagos asociados a ordenes.
- `CashRegister`: control de apertura y cierre de caja.
- `Expense`: gastos operativos.
- `SupplyCategory`: categorias de insumos.
- `ProductSupply`: insumos disponibles.
- `SupplyMovement`: entradas y salidas de insumos.
- `PrinterSetting`: configuracion de impresion.
- `Promotion`: descuentos y promociones configurables.

## 11. Flujo operativo propuesto

1. El usuario inicia sesion.
2. El sistema valida el rol y redirige al modulo correspondiente.
3. El mesero o barista selecciona productos desde el POS.
4. Si el producto tiene variantes, se configuran sus opciones antes de agregarlo.
5. La orden puede guardarse como comanda pendiente o cobrarse directamente.
6. Si se guarda como pendiente, baristas y administradores reciben notificacion en tiempo real.
7. La orden se actualiza, completa o cancela segun el avance del servicio.
8. Al cobrar, el sistema registra el pago y actualiza la caja abierta.
9. Los gastos y movimientos de insumos se registran durante la operacion.
10. El administrador consulta reportes y administra catalogos.
11. Al finalizar el turno, se realiza el cierre de caja y se revisan diferencias.

## 12. Beneficios esperados

- Reduccion de errores en pedidos y cobros.
- Mejor comunicacion entre meseros, baristas y administradores.
- Mayor rapidez en la toma y seguimiento de comandas.
- Control mas claro de caja y gastos.
- Mejor administracion de productos, promociones e insumos.
- Disponibilidad de informacion para reportes y decisiones administrativas.
- Posibilidad de operar desde navegador o dispositivo Android.
- Base tecnica preparada para integraciones futuras, como pagos digitales e impresion termica.

## 13. Riesgos y consideraciones

- La calidad de los reportes depende de que los usuarios registren correctamente ventas, gastos e insumos.
- El control de inventario requiere disciplina operativa para registrar entradas y salidas.
- La integracion con servicios externos de pago depende de configuraciones y credenciales validas.
- El uso en Android con impresora termica requiere pruebas con el modelo fisico de impresora.
- Es recomendable fortalecer pruebas automatizadas del backend y frontend conforme el sistema crezca.

## 14. Resultados esperados

Al implementar Cafeteria POS, se espera que la cafeteria tenga una operacion mas ordenada, con pedidos trazables, ventas registradas, caja controlada y administracion centralizada de catalogos. El sistema permite pasar de un proceso manual o disperso a un flujo digital integrado, reduciendo errores y facilitando el seguimiento administrativo.

## 15. Conclusiones

Cafeteria POS representa una solucion practica para digitalizar la operacion de una cafeteria. Su enfoque modular permite cubrir las necesidades principales del negocio: venta, comandas, caja, productos, insumos, gastos, usuarios y reportes.

Desde el punto de vista tecnico, el proyecto utiliza tecnologias modernas y adecuadas para una aplicacion de este tipo. Angular facilita una interfaz web interactiva, Express permite exponer una API clara, Prisma organiza el acceso a datos, Socket.IO habilita actualizaciones en tiempo real y Capacitor abre la posibilidad de utilizar la solucion en dispositivos Android.

El caso de estudio muestra que el sistema no solo resuelve el registro de ventas, sino que tambien apoya la coordinacion operativa y el control administrativo de la cafeteria.
