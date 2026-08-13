# Etapa 11: auditoría y mantenimiento de dependencias

Fecha de revisión final: 22 de julio de 2026.

## Alcance y línea base

La revisión se realizó en `chore/etapa-11-dependencias`, partiendo de la Etapa 10 limpia y validada. La línea base tenía 29 pruebas de frontend y 113 de backend aprobadas, TypeScript correcto, cero errores de ESLint, formato correcto, builds correctos y validación/generación de Prisma correcta.

El entorno local fue Node.js 24.13.0 y npm 11.6.2. El CLI de Angular 19 advierte que Node 24 no es una versión soportada por esa línea. No se agregó `engines`, `.nvmrc` ni `.node-version` porque el repositorio no confirma la versión real de Hostinger.

## Inventario directo

### Frontend

| Dependencia o grupo                       | Uso comprobado                                      | Clasificación      | Decisión                                       |
| ----------------------------------------- | --------------------------------------------------- | ------------------ | ---------------------------------------------- |
| Angular core, router, forms y plataformas | Aplicación, rutas, formularios y SSR                | Producción/build   | Conservar; runtime actualizado a 19.2.25       |
| Angular CDK y Material                    | Componentes y plantillas Angular                    | Producción         | Conservar en 19.2.19                           |
| Angular CLI, compiler-cli y build-angular | Scripts `ng`, compilación y pruebas                 | Desarrollo/build   | Conservar en Angular 19                        |
| angular-eslint, ESLint y Prettier         | Scripts de lint y formato                           | Desarrollo         | Conservar                                      |
| Capacitor core y Android                  | Plataforma Android                                  | Producción móvil   | Actualizar coordinadamente a 8.4.2             |
| Capacitor CLI                             | Scripts Android                                     | Desarrollo         | Actualizar a 8.4.2 y mover a `devDependencies` |
| date-fns                                  | Formato y cálculos de fechas                        | Producción         | Conservar                                      |
| Express y Angular SSR                     | Servidor SSR generado                               | Producción         | Conservar; Express actualizado a 4.22.2        |
| RxJS y zone.js                            | Reactividad y runtime Angular                       | Producción         | Conservar                                      |
| socket.io-client                          | Comunicación en tiempo real                         | Producción         | Actualizar a 4.8.3                             |
| Karma, Jasmine y tipos                    | Pruebas Angular                                     | Desarrollo         | Conservar                                      |
| TypeScript y typescript-eslint            | Compilación y análisis                              | Desarrollo         | Conservar en versiones compatibles             |
| bcryptjs                                  | Sin import, script, configuración ni carga dinámica | Sin uso confirmado | Eliminada                                      |
| mysql2                                    | Sin import; el frontend consume la API              | Sin uso confirmado | Eliminada                                      |

### Backend

| Dependencia o grupo           | Uso comprobado                                       | Clasificación         | Decisión                      |
| ----------------------------- | ---------------------------------------------------- | --------------------- | ----------------------------- |
| `@prisma/client` y Prisma CLI | Acceso MySQL, generación y validación                | Producción/desarrollo | Alinear y actualizar a 6.19.3 |
| bcryptjs                      | Hash y verificación de contraseñas                   | Producción            | Conservar                     |
| cors                          | Middleware CORS                                      | Producción            | Conservar                     |
| dotenv                        | Carga de entorno                                     | Producción            | Conservar                     |
| Express                       | API HTTP                                             | Producción            | Conservar en 5.2.1            |
| jsonwebtoken                  | Firma y validación JWT                               | Producción            | Conservar                     |
| socket.io                     | Tiempo real                                          | Producción            | Conservar en 4.8.3            |
| Vitest                        | 113 pruebas automatizadas                            | Desarrollo            | Conservar                     |
| TypeScript, ts-node y nodemon | Build, scripts y desarrollo                          | Desarrollo            | Conservar                     |
| ESLint y Prettier             | Estándares de código                                 | Desarrollo            | Conservar                     |
| mysql2                        | Sin imports; Prisma es el único cliente MySQL activo | Sin uso confirmado    | Eliminada                     |
| `@types/bcrypt`               | El proyecto usa bcryptjs con tipos propios           | Sin uso confirmado    | Eliminada                     |
| `@types/socket.io`            | Socket.IO incluye tipos propios                      | Sin uso confirmado    | Eliminada                     |

Mercado Pago no introduce un SDK npm: la integración activa utiliza un servicio propio y `fetch` nativo. No se agregó ni reemplazó ninguna biblioteca HTTP.

## Vulnerabilidades y actualizaciones

### Línea base de npm audit

| Proyecto | Total | Críticas | Altas | Moderadas | Bajas | Producción |
| -------- | ----: | -------: | ----: | --------: | ----: | ---------: |
| Frontend |    64 |        3 |    34 |        25 |     2 |         20 |
| Backend  |    13 |        0 |     8 |         4 |     1 |         10 |

Las rutas productivas principales eran Angular/SSR, Express, Socket.IO y Prisma. En desarrollo aparecían Angular CLI/build, Capacitor CLI, ts-node, nodemon y ESLint. Cada corrección se aplicó al paquete directo o a una lista explícita de transitivas compatibles; no se ejecutó `npm audit fix`, `--force`, `--legacy-peer-deps` ni una actualización global.

### Cambios aplicados

| Paquete o grupo                   | Antes   | Después                                                                                  | Tipo                   | Motivo                                                             |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| Prisma y Prisma Client            | 6.19.1  | 6.19.3                                                                                   | Patch                  | Retirar cadena vulnerable de `@prisma/config` manteniendo Prisma 6 |
| Express frontend                  | 4.22.1  | 4.22.2                                                                                   | Patch                  | Mantenimiento compatible                                           |
| socket.io-client                  | 4.8.1   | 4.8.3                                                                                    | Patch                  | Corregir transitivas de Engine.IO/parser/ws                        |
| Capacitor core, Android y CLI     | 8.1.0   | 8.4.2                                                                                    | Minor compatible       | Mantenimiento coordinado dentro de Capacitor 8                     |
| Angular runtime y compiler        | 19.2.17 | 19.2.25                                                                                  | Patch                  | Último parche del runtime Angular 19                               |
| Transitivas backend               | Varias  | qs 6.15.3, path-to-regexp 8.4.2, Engine.IO 6.6.9, adapter 2.5.8, parser 4.2.7, ws 8.21.1 | Patch/minor compatible | Eliminar vulnerabilidades productivas                              |
| body-parser backend               | 2.2.2   | 2.3.0                                                                                    | Minor compatible       | Corregir DoS por configuración inválida del límite                 |
| Transitivas backend de desarrollo | Varias  | brace-expansion 1.1.16, picomatch 2.3.2, diff 4.0.4                                      | Patch compatible       | Eliminar vulnerabilidades de tooling                               |
| Transitivas frontend              | Varias  | path-to-regexp 0.1.13, engine.io-client 6.6.6, parser 4.2.7, ws 8.21.1                   | Patch compatible       | Reducir vulnerabilidades productivas                               |
| Transitivas frontend finales      | Varias  | Actualizaciones compatibles de Babel, glob, proxy, XML, Karma y Socket.IO                | Patch/minor compatible | Retirar todas las correcciones disponibles sin `--force`           |

Prisma Validate, Generate, pruebas y build pasaron después del parche. No se ejecutó ninguna migración, `db push` o cambio del esquema MySQL.

Angular core, common, compiler, forms, router y plataformas quedaron alineados en 19.2.25; compiler-cli también quedó en 19.2.25. CDK, Material, CLI, build-angular y SSR permanecen en parches compatibles de Angular 19. TypeScript 5.7.3 cumple el peer `>=5.5 <5.9` de compiler-cli 19.2.25. La actualización completa a una versión Angular sin avisos pendientes requiere una versión mayor y se pospone.

## Duplicados y lockfiles

`npm dedupe --dry-run` propuso un cambio amplio en frontend (incluidos cambios de resolución de RxJS) y no se aplicó. El dry-run del backend era menor, pero se prefirieron actualizaciones transitivas explícitas y verificables. Reducir copias no justificaba un diff global sin beneficio probado.

Existe un `package-lock.json` versión 3 por proyecto. Ambos fueron modificados exclusivamente por npm. No se encontraron tokens, URLs privadas, referencias `file:`, localhost, rutas locales ni repositorios SSH; las resoluciones usan el registro público de npm. No se agregaron `overrides`.

## Licencias

La revisión de metadatos de dependencias directas no encontró copyleft ni licencias desconocidas de impacto inmediato. Predomina MIT; Prisma Client, Prisma, RxJS y TypeScript usan Apache-2.0; `tslib` usa 0BSD; dotenv usa BSD-2-Clause; el backend declara ISC. Algunas transitivas usan ISC, BlueOak o Unlicense. Estas licencias son permisivas, aunque deben conservarse sus avisos y atribuciones aplicables.

## Versiones mayores pospuestas

| Grupo                 | Versión conservada | Mayor disponible durante la auditoría | Riesgo de actualizar ahora                              | Recomendación futura                            |
| --------------------- | ------------------ | ------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Angular y Angular CLI | 19                 | 21/22 según paquete                   | Migraciones de framework, builder y Node                | Etapa dedicada con guía `ng update`             |
| angular-eslint        | 19.8.1             | 22                                    | Debe alinearse con Angular                              | Actualizar junto con Angular                    |
| Prisma                | 6.19.3             | 7                                     | Cambios de runtime, configuración y compatibilidad Node | Etapa dedicada sin migrar datos automáticamente |
| Express frontend SSR  | 4.22.2             | 5                                     | Cambios de API y resolución de rutas                    | Evaluar junto con SSR                           |
| TypeScript            | 5.7.3              | 7                                     | Fuera de peers actuales de Angular                      | Actualizar después de Angular                   |
| ESLint                | 9.39.5             | 10                                    | Cambios de reglas/configuración                         | Etapa de tooling separada                       |
| Jasmine               | 5.6.0              | 6                                     | Posibles cambios de pruebas                             | Actualización aislada                           |
| zone.js               | 0.15.1             | 0.16                                  | Peer de Angular                                         | Actualizar con Angular                          |

No se actualizó una dependencia sólo por aparecer en `npm outdated`. Parches/minors sin vulnerabilidad activa —como date-fns, cors, dotenv y nodemon— se conservaron para evitar ampliar el diff sin una mejora de seguridad demostrada.

## Riesgos y pendientes

- El frontend conserva vulnerabilidades asociadas a la línea Angular 19 y sus herramientas. La solución completa publicada requiere un salto mayor; no es compatible con el alcance de esta etapa.
- Las vulnerabilidades exclusivas de desarrollo pueden afectar al servidor de desarrollo o al procesamiento de archivos no confiables en CI. No se debe exponer `ng serve`, Karma ni herramientas de build públicamente.
- Node 24.13.0 funciona en las validaciones locales, pero Angular CLI 19 lo reporta fuera de soporte. Debe confirmarse la versión efectiva de Hostinger antes de fijar `engines`; una línea LTS soportada por Angular 19 es preferible.
- El registro npm presentó cortes `ECONNRESET` durante la auditoría, pero posteriormente permitió completar instalaciones, verificaciones y consultas finales.
- No se comprobó contra MySQL remoto ni producción, conforme a la restricción de la etapa.

## Validación final

| Validación               | Frontend                                  | Backend                                   |
| ------------------------ | ----------------------------------------- | ----------------------------------------- |
| `npm ci`                 | Correcto desde lockfile                   | Correcto desde lockfile                   |
| TypeScript               | Correcto                                  | Correcto                                  |
| ESLint                   | 0 errores, 112 advertencias preexistentes | 0 errores, 131 advertencias preexistentes |
| Format check             | Correcto                                  | Correcto                                  |
| Pruebas                  | 29/29 correctas                           | 113/113 correctas                         |
| Build                    | Correcto                                  | Correcto                                  |
| Prisma Validate/Generate | No aplica                                 | Correctos con Prisma 6.19.3               |
| Verify                   | Correcto                                  | Correcto                                  |

La auditoría final del backend registra cero vulnerabilidades totales y cero de producción. El frontend registra 40 vulnerabilidades totales (2 bajas, 18 moderadas, 18 altas y 2 críticas) y 9 de producción (1 moderada, 7 altas y 1 crítica). npm sólo ofrece resolver las restantes mediante `--force` y la instalación de Angular/CLI 21, lo que constituye un cambio mayor expresamente fuera del alcance. No quedaron correcciones compatibles pendientes.

La conclusión es **Etapa 11 completada correctamente**. Los riesgos restantes están identificados, documentados y requieren una futura actualización mayor coordinada de Angular; no representan trabajo omitido que pueda resolverse de forma compatible dentro de esta etapa.

## Reversión

Los cambios son commits independientes. Para revertir toda la etapa, desde una rama de respaldo y en orden inverso, usar `git revert <hash>` para cada commit listado en el reporte final. Para revertir sólo un grupo, aplicar `git revert` al commit correspondiente. No usar `git reset --hard`; los lockfiles deben volver junto con su `package.json` en el mismo revert.
