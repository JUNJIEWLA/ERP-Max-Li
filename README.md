  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

---

## Seguridad y despliegue (ISSUE-010)

Esta sección cubre el contrato mínimo de autenticación y transporte. El paquete
operativo completo —contenedores, healthcheck, backup/restore, runbook— sigue
siendo ISSUE-015 y no forma parte de este documento.

### Variables de entorno

| Variable | Perfil | Obligatoria | Descripción |
|---|---|---|---|
| `JWT_SECRET` | prod | **Sí** | Secreto HMAC de firma. Mínimo 32 bytes (256 bits). Genérelo con `openssl rand -base64 48`. El arranque falla si falta, es corto, tiene poca entropía o conserva un valor de ejemplo del repositorio. |
| `JWT_EXPIRATION` | todos | No | Vigencia del token. Por defecto `8h`, un turno de caja. Admite notación (`8h`, `30m`) o milisegundos. |
| `CORS_ALLOWED_ORIGINS` | prod | **Sí** | Lista separada por comas de los orígenes del frontend, por ejemplo `https://erp.plazamax.do`. Sin comodines y solo `https://`: la sesión viaja en cookie y la API responde con `allowCredentials=true`. |
| `BOOTSTRAP_ADMIN_PASSWORD` | prod | Solo en la 1.ª instalación | Contraseña inicial de la cuenta `admin`. Mínimo 12 caracteres. Se consume una sola vez y nunca se escribe en logs. |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | todos | **Sí** | Conexión a PostgreSQL. |
| `SPRING_PROFILES_ACTIVE` | todos | **Sí** | `dev`, `prod` o `test`. **No hay valor por defecto**: sin perfil declarado el arranque falla. Debe declararse exactamente uno. |
| `LOGIN_MAX_INTENTOS`, `LOGIN_VENTANA`, `LOGIN_BLOQUEO` | todos | No | Freno de fuerza bruta. Por defecto 5 intentos por usuario+IP en 10 min y 15 min de bloqueo. |

> **Si ya tenía un `application-dev.yml` local**, borre de él los bloques `jwt:`
> y `cors:`. Ese archivo gana sobre `application.yml`, así que los valores
> antiguos siguen fijando la expiración en 24 h y anulan las 8 h del proyecto.

### Credencial administrativa inicial

La migración `V35` deja la cuenta `admin` **sin contraseña utilizable**: la
credencial `admin / Admin@2026` publicada en `V8` ya no sirve, ni en una
instalación nueva ni al actualizar una base existente. (Si en esa base alguien
ya había rotado la contraseña, `V35` no la toca.)

Para recuperar el acceso, arranque **una vez** con la variable definida:

```bash
cd backend
export SPRING_PROFILES_ACTIVE=dev       # o prod; ya no hay valor por defecto
export BOOTSTRAP_ADMIN_PASSWORD='...'   # mínimo 12 caracteres
mvn spring-boot:run
```

> El repositorio no incluye el wrapper `./mvnw`; use el `mvn` del sistema
> (Maven 3.9+).

- El bootstrap solo actúa mientras la cuenta siga bloqueada; en arranques
  posteriores no vuelve a tocar la contraseña, aunque la variable siga definida.
- El administrador queda obligado a cambiarla en su primer inicio de sesión.
- En el perfil `prod`, si la cuenta está bloqueada y no hay una contraseña
  segura, **la aplicación no arranca** y explica qué falta.
- Fuera de `prod` solo se registra una advertencia y la cuenta sigue bloqueada.

Retire la variable del entorno una vez completado el primer inicio de sesión.

### Contrato HTTPS / reverse proxy

En el perfil `prod` la aplicación **no atiende tráfico en texto plano**: redirige toda
petición a `https://` y publica HSTS (`max-age=31536000; includeSubDomains`),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y
`Referrer-Policy: same-origin`.

TLS lo termina un reverse proxy confiable (nginx, Caddy, ALB) que debe reenviar:

- `X-Forwarded-Proto` — sin esto toda petición parecería llegar en claro y el
  sitio entraría en un bucle de redirecciones;
- `X-Forwarded-Host` y `X-Forwarded-For` — este último es el que hace que el
  freno de fuerza bruta cuente la IP real del cliente y no la del proxy.

La aplicación las honra mediante `server.forward-headers-strategy: framework`,
ya configurado en el perfil `prod`. El proxy debe **descartar** esas cabeceras si
vienen del cliente y fijarlas él mismo.

No se versiona ningún certificado ni clave privada: son responsabilidad del
proxy.

### Sesión

El JWT viaja en una cookie `HttpOnly` (`Secure` y `SameSite=Lax` en producción),
no en `localStorage`: un XSS ya no puede extraer la sesión. Como contrapartida se
aplica protección CSRF por token sincronizador — el backend emite `XSRF-TOKEN` y
el SPA lo reenvía en `X-XSRF-TOKEN` en toda petición que modifique estado.

- `POST /api/auth/login` — abre la sesión y emite la cookie.
- `GET /api/auth/me` — identidad y permisos vigentes; el SPA la usa para
  recuperar la sesión al recargar.
- `POST /api/auth/logout` — borra la cookie de sesión.

Cambiar la contraseña, resetearla, suspender la cuenta o alterar roles/permisos
incrementa `token_version` e invalida de inmediato los tokens ya emitidos.
