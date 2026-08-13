# Etapa 10: lint, formato y estándares

## Alcance

Esta etapa incorpora verificaciones graduales sin modificar contratos, endpoints, eventos de
Socket.IO, Prisma ni lógica de negocio. ESLint y Prettier excluyen código generado, dependencias,
cobertura, binarios y artefactos de compilación.

## Línea base

- Frontend: TypeScript correcto, 29 pruebas correctas y build de producción correcto.
- Backend: TypeScript correcto, 113 pruebas correctas, build correcto y esquema Prisma MySQL
  válido.
- No existían ESLint, Prettier, scripts de calidad, CI ni hooks.
- `.editorconfig` ya definía UTF-8, espacios de dos caracteres y newline final.

## Configuración adoptada

- ESLint 9 con flat config independiente para frontend y backend.
- Reglas recomendadas de JavaScript y TypeScript.
- Reglas recomendadas de Angular para componentes y templates, incluidos templates inline.
- Prettier independiente; no se ejecuta como regla ESLint.
- `eslint-config-prettier` evita conflictos entre responsabilidades de lint y formato.
- `sort-imports` sólo revisa miembros dentro de un import; no reordena declaraciones completas.
- La deuda heredada de `any`, igualdad laxa, consola y elementos sin uso se reporta como warning.

## Resultado inicial de ESLint

| Proyecto | Errores iniciales | Advertencias iniciales | Resultado configurado       |
| -------- | ----------------: | ---------------------: | --------------------------- |
| Frontend |                 1 |                    111 | 0 errores, 112 advertencias |
| Backend  |                 1 |                    131 | 0 errores, 131 advertencias |

El error frontend era `prefer-as-const` en una propiedad del flujo de pago. Se mantuvo el código y
se convirtió la regla en advertencia para evitar tocar lógica durante esta etapa. El error backend
era un `require()` intencional en una prueba que carga un script CommonJS; también se conserva como
advertencia.

### Deuda por regla

| Regla                                   | Frontend | Backend | Estrategia                                               |
| --------------------------------------- | -------: | ------: | -------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`    |       53 |      82 | Reducir por servicio o módulo con pruebas                |
| `@typescript-eslint/no-unused-vars`     |       31 |       2 | Corregir en grupos pequeños                              |
| `eqeqeq`                                |       16 |      42 | Revisar coerción y contratos antes de cambiar            |
| `sort-imports`                          |        9 |       2 | Aplicar sólo al tocar cada archivo                       |
| `no-console`                            |        2 |       2 | Sustituir gradualmente por el mecanismo de logs acordado |
| `@typescript-eslint/prefer-as-const`    |        1 |       0 | Revisar junto con el módulo de checkout                  |
| `@typescript-eslint/no-require-imports` |        0 |       1 | Mantener mientras el smoke script sea CommonJS           |

Los archivos con más hallazgos frontend son `printer.service.ts` (24),
`checkout.component.ts` (16), `products-admin.component.ts` (16), `pos.component.ts` (12) y
`cash-register.service.ts` (12). En backend son `supply-movements.controller.ts` (21),
`order.controller.ts` (17), `products.controller.ts` (14), `supplies.controller.ts` (10) y
`expenses.controller.ts` (10).

## Matriz TypeScript

| Opción                       | Frontend             | Backend              | Decisión                                   |
| ---------------------------- | -------------------- | -------------------- | ------------------------------------------ |
| `strict`                     | Activa               | Activa               | Conservar                                  |
| `noImplicitAny`              | Incluida en `strict` | Incluida en `strict` | Conservar                                  |
| `strictNullChecks`           | Incluida en `strict` | Incluida en `strict` | Conservar                                  |
| `noImplicitOverride`         | Activa               | No explícita         | Posponer medición backend                  |
| `noImplicitReturns`          | Activa               | No explícita         | Posponer medición backend                  |
| `noFallthroughCasesInSwitch` | Activa               | No explícita         | Posponer medición backend                  |
| `noUnusedLocals`             | No activa            | No activa            | Posponer; ESLint ya mide deuda             |
| `noUnusedParameters`         | No activa            | No activa            | Posponer; Express requiere firmas estables |
| `useUnknownInCatchVariables` | Heredada de `strict` | Heredada de `strict` | Conservar sin migración masiva             |
| `exactOptionalPropertyTypes` | No activa            | No activa            | Posponer por impacto en contratos          |
| `noUncheckedIndexedAccess`   | No activa            | No activa            | Posponer por impacto transversal           |

No se habilitaron reglas ESLint type-aware en esta primera adopción. Deben medirse por separado antes
de introducir el coste de crear programas TypeScript dentro del lint.

## Formato

`format:check` cubre únicamente configuraciones creadas o modificadas en esta etapa. El código
histórico bajo `src/`, `backend/src/` y `backend/tests/` queda como deuda de formato medida por
incorporación gradual; incluirlo ahora produciría un diff estético masivo. Los scripts `format` y
`lint:fix` existen, pero su ejecución debe mantenerse sobre rutas explícitas y revisadas.

## Exclusiones

Se excluyen `node_modules`, `dist`, `coverage`, `.angular`, assets, binarios, bases locales,
minificados y el cliente Prisma generado. `backend/dist` continúa versionado y sólo puede
regenerarse mediante `npm run build`; conviene revisar su política de versionado en una etapa
posterior, junto con el proceso real de despliegue.

## Editor y automatización

VS Code recomienda las extensiones oficiales de Angular, ESLint y Prettier. El formato al guardar
está desactivado y el arreglo ESLint requiere una acción explícita. `.gitattributes` y
`.editorconfig` fijan UTF-8/LF para cambios futuros sin ejecutar una renormalización del historial.

No se agregaron hooks ni CI. Si se adopta GitHub Actions posteriormente, una propuesta segura es
ejecutar instalación reproducible, `verify` frontend y `verify` backend sin smoke test, MySQL real,
secretos ni despliegue.

## Comandos

Ejecutar desde la raíz o desde `backend`, según corresponda:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run verify
```

`npm run format` sólo formatea la lista controlada definida en cada `package.json`. No debe
reemplazarse por `prettier --write .` sin una migración de formato aislada.
