# Riesgos de sesión del frontend

El JWT se conserva actualmente en `sessionStorage` para mantener compatibilidad con la arquitectura y el despliegue existentes. Esta ubicación limita la persistencia a la pestaña, pero cualquier JavaScript ejecutado mediante una vulnerabilidad XSS podría leer el token.

Las medidas compatibles aplicadas son:

- Validar `exp` antes de considerar una sesión autenticada.
- Eliminar tokens inválidos o expirados.
- Limpiar la sesión ante respuestas HTTP 401, excepto el intento de login.
- No usar guards Angular como sustituto de la autorización backend.
- Eliminar listeners Socket.IO antes de reconectar o cerrar sesión.

## Migración recomendada

Una etapa independiente puede migrar la sesión a una cookie `HttpOnly`, `Secure` y `SameSite` apropiada. Esto reduce la lectura del token desde JavaScript, pero exige coordinar CSRF, CORS con credenciales, renovación de sesión, dominio, HTTPS, Socket.IO y despliegue en Hostinger. No debe hacerse como un cambio aislado del frontend.
