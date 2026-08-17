  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

---

## Seguridad y despliegue (ISSUE-010)

Esta sección cubre el contrato mínimo de autenticación y transporte. La
operación del piloto —healthchecks, backup/restore y rollback— está en
**[`docs/RUNBOOK_PILOTO.md`](docs/RUNBOOK_PILOTO.md)** (ISSUE-015).

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

---

## Operación del piloto (ISSUE-015)

El procedimiento completo —backup diario, restauración, despliegue, criterios de
fallo y rollback— está en **[`docs/RUNBOOK_PILOTO.md`](docs/RUNBOOK_PILOTO.md)**.
Resumen de lo que este repositorio aporta:

### Healthchecks

| Ruta | Responde por |
|---|---|
| `GET /actuator/health` | Estado agregado. Solo para diagnóstico manual: con PostgreSQL caído espera al timeout de conexión en vez de responder rápido. |
| `GET /actuator/health/liveness` | El proceso. **No** consulta PostgreSQL: si la base se cae, reiniciar la aplicación no arregla nada. |
| `GET /actuator/health/readiness` | El proceso **y** PostgreSQL. Es la que debe usar el proxy para sacar de rotación. |

Las tres son públicas —el proxy no tiene sesión— y devuelven solo el estado, sin
componentes ni datos de conexión. Cualquier otro endpoint de Actuator responde
`401`. En `prod` siguen exigiendo HTTPS: el proxy debe consultarlas por `https://`
o reenviar `X-Forwarded-Proto: https`, o leerá un `302` como si fuera una caída.

### Scripts de operación

| Script | Qué hace |
|---|---|
| `ops/verificar-prepiloto.sh` | **Gate de salida a piloto.** Un comando que dice si el entorno puede recibir operación real: perfil, variables, PostgreSQL, migraciones, sondas, rechazo del anónimo, configuración operativa, resoluciones B02/B04 y backups. No muta nada. |
| `ops/backup-postgres.sh` | Dump en formato custom, publicado solo tras verificarlo con `pg_restore --list`, con checksum SHA-256 y copia externa verificada (`--externo`, `--exigir-externo`). |
| `ops/restore-postgres.sh` | Restauración que exige nombrar la base destino en la confirmación y que esa base esté **vacía**; verifica checksum y dump antes de tocar nada. |
| `ops/ensayo-backup-restore.sh` | Ensayo completo backup→copia externa→restore sobre bases desechables. Correr antes de cada despliegue con migraciones. |
| `ops/verificar-scripts.sh` | Sintaxis y validación de entrada de los scripts de backup y restore. Sin PostgreSQL. |
| `ops/verificar-gate-prepiloto.sh` | Pruebas del gate contra una base desechable `maxli_gate_*` y un servidor de sondas de prueba. |

Todos reutilizan `DB_URL`, `DB_USER` y `DB_PASSWORD`. La contraseña viaja por el
entorno, nunca como argumento. **Los dumps no entran en Git**: contienen datos
de clientes y hashes de contraseña.

Antes del primer día del piloto se completa
[`docs/CHECKLIST_SALIDA_PILOTO.md`](docs/CHECKLIST_SALIDA_PILOTO.md), que decide
el go/no-go e incluye los pasos que ningún script puede hacer.

---

## E2E del flujo principal (Task 5)

Un único E2E recorre en el navegador, contra backend y base reales, el flujo que
sostiene el piloto: **login → apertura de turno → venta con NCF → devolución
con Nota de Crédito B04 → cierre cuadrado**. Lo ejecuta también GitHub Actions
(`.github/workflows/ci.yml`) en cada PR hacia `main`.

La devolución cierra el círculo del efectivo: la venta cobra RD$118.00, la nota
de crédito los reembolsa y el turno cierra en los RD$500.00 del fondo inicial,
con diferencia cero.

> ⚠️ **Nunca se ejecuta contra `maxli_db`.** El E2E borra devoluciones, ventas,
> movimientos y turnos. Solo puede correr sobre la base exclusiva **`maxli_e2e`**: el fixture
> aborta con error si `current_database()` no es exactamente ese nombre.

### Prerrequisitos

Java 21, Maven 3.9+, Node 20+, PostgreSQL 15+ con `psql` en el `PATH`, y el
navegador de Playwright: `npx playwright install chromium`.

### Puesta en marcha

```bash
# 1. Base exclusiva del E2E (una sola vez)
createdb maxli_e2e

# 2. Backend contra esa base: Flyway aplica las migraciones reales.
#    SPRING_DATASOURCE_URL gana sobre cualquier application-dev.yml local,
#    así que la sesión de E2E no puede acabar apuntando a maxli_db.
cd backend
SPRING_PROFILES_ACTIVE=dev \
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/maxli_e2e \
SPRING_DATASOURCE_USERNAME="$USER" \
BOOTSTRAP_ADMIN_PASSWORD='E2eBootstrap#2026' \
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173 \
mvn spring-boot:run

# 3. Fixture determinista (almacén, caja, producto RD$118.00 con stock 10,
#    resoluciones NCF B02 y B04). Repetible: limpia lo transaccional en
#    cada pasada, con las devoluciones antes que las ventas.
npm run e2e:fixture

# 4. Frontend
npx vite --host 127.0.0.1 --port 5173

# 5. E2E
npm run test:e2e
```

La contraseña inicial de `admin` se cambia en el primer inicio de sesión; el
E2E la cambia a `E2eFlujoPrincipal#2026` y reutiliza esa credencial en las
ejecuciones siguientes sobre la misma base. Ambas contraseñas son exclusivas de
la base efímera de pruebas y se pueden fijar con `BOOTSTRAP_ADMIN_PASSWORD` y
`E2E_ADMIN_NEW_PASSWORD`.
