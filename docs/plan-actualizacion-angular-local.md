# Plan de actualización de Angular local

Estado observado el 2026-07-26:

- Angular 19.2.25.
- Angular CLI 19.2.19.
- TypeScript 5.7.3.
- Node local 24.13.0, reportado como no soportado por Angular 19.
- SSR está instalado y existe configuración de servidor; debe comprobarse su
  uso real antes de retirar dependencias.

Se recomienda Node 22 LTS. Con nvm-windows:

```powershell
nvm install 22
nvm use 22
node --version
```

No se actualiza Angular en la Etapa 14A. La actualización futura debe partir de
un Git limpio en `upgrade/angular-19-a-21`, sin despliegue, y avanzar
Angular 19 → 20 → 21. Después de cada salto: `npm ci`, typecheck, lint,
pruebas, build, verify, smoke local y revisión de vulnerabilidades de
producción/desarrollo.

Antes de iniciar: entorno local funcional, base aislada, commit de respaldo,
compatibilidad oficial de Node confirmada y auditoría de SSR/Capacitor. No usar
actualizaciones mayores automáticas ni `npm audit fix --force`.

