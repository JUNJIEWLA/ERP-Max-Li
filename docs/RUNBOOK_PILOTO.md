# Runbook del piloto — MaxLi Manager

Procedimiento operativo mínimo para poner el piloto en marcha, respaldarlo,
verificarlo y volver atrás cuando algo sale mal. Cubre ISSUE-015.

Alcance: **un solo servidor** con PostgreSQL y la aplicación detrás de un
reverse proxy que termina TLS. No hay contenedores, orquestador ni monitoreo
centralizado; nada de eso hace falta para un piloto y todo lo que se añada hay
que operarlo.

Objetivos de recuperación, como **objetivos operativos, no garantías**:

| Objetivo | Valor | Qué significa |
|---|---|---|
| **RPO** | ≤ 24 h | Con un backup diario, un desastre puede costar hasta un día de operación. Si eso es inaceptable para el negocio, hay que subir la frecuencia antes de salir del piloto, no después. |
| **RTO** | ~60 min | Tiempo objetivo entre detectar el fallo y volver a vender. Depende de que el backup esté verificado y de que alguien haya ensayado la restauración; sin ensayo previo, esta cifra es ficción. |

---

## 1. Prerrequisitos

- Java 21 LTS y Maven 3.9+
- PostgreSQL 15+ y sus clientes (`pg_dump`, `pg_restore`, `psql`) en el servidor
- Node 20 LTS para construir el frontend
- Un reverse proxy (nginx, Caddy o ALB) que termine TLS
- Un destino para la copia off-host: otra máquina, un disco cifrado o un bucket

### Variables de entorno

Las mismas que documenta el `README.md`. Las de este runbook:

| Variable | Uso |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod`. Sin perfil declarado la aplicación no arranca. |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL. Los scripts de `ops/` reutilizan estas tres y ninguna otra. |
| `JWT_SECRET` | Secreto de firma, mínimo 32 bytes. |
| `CORS_ALLOWED_ORIGINS` | Origen del frontend, solo `https://`. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Solo en la primera instalación. |
| `BACKUP_DIR` | Opcional. Destino de los dumps; por defecto `ops/backups/`. |

> `DB_URL` va en formato JDBC (`jdbc:postgresql://host:5432/maxli_db`). Los
> scripts le retiran el prefijo `jdbc:` y conservan el resto —incluido
> `?sslmode=require`— para hablar con las herramientas de PostgreSQL.

**Ningún secreto se escribe en el repositorio.** Las variables viven en el
gestor de servicios (`systemd` `EnvironmentFile=` con permisos `600`, o el
equivalente del proveedor), nunca en un archivo versionado.

---

## 2. Healthchecks

La aplicación expone exactamente tres sondas, públicas y sin autenticación
porque quien las consulta es el proxy, que no tiene sesión:

| Ruta | Responde por | Uso |
|---|---|---|
| `GET /actuator/health` | Estado agregado | Diagnóstico manual. |
| `GET /actuator/health/liveness` | El **proceso**. No consulta PostgreSQL. | ¿Hay que reiniciar? |
| `GET /actuator/health/readiness` | El proceso **y** PostgreSQL. | ¿Puede atender tráfico? |

El cuerpo es solo el estado (`{"status":"UP"}`): sin componentes, versiones ni
datos de conexión. Ningún otro endpoint de Actuator está expuesto — `/actuator`,
`/actuator/env`, `/actuator/beans`, `/actuator/metrics` y compañía responden
`401`.

La distinción importa al configurar el proxy:

- **Reiniciar el proceso** solo ante `liveness` en fallo. Si PostgreSQL se cae,
  reiniciar la aplicación no arregla nada y solo alarga la caída.
- **Sacar de rotación** ante `readiness` en fallo (`503`), y devolverla cuando
  vuelva a `200`.
- **No usar `/actuator/health` como sonda automática.** El agregado consulta la
  base, y con PostgreSQL inalcanzable la petición se queda esperando el timeout
  de conexión en lugar de responder rápido. `readiness` responde `503` de
  inmediato; es la que debe ir en el proxy.

### El proxy debe hablar HTTPS

En `prod` la aplicación no atiende nada en texto plano, y eso **incluye las
sondas**. El proxy tiene dos opciones:

1. consultarlas por `https://`, o
2. consultarlas por HTTP interno **reenviando `X-Forwarded-Proto: https`**.

Sin una de las dos, la sonda recibe un `302` a `https://` y el proxy la
interpretará como caída. Ejemplo con nginx:

```nginx
location /actuator/health/readiness {
    proxy_pass         http://127.0.0.1:8080;
    proxy_set_header   X-Forwarded-Proto https;   # el proxy la fija; nunca la
    proxy_set_header   X-Forwarded-Host  $host;   # acepta del cliente
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
}
```

Comprobación manual:

```bash
curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1:8080/actuator/health/readiness
# {"status":"UP"}
```

---

## 3. Backup

### Manual

```bash
export DB_URL='jdbc:postgresql://localhost:5432/maxli_db'
export DB_USER='maxli'
export DB_PASSWORD='...'          # del gestor de secretos, no del historial del shell

ops/backup-postgres.sh                 # deja el dump en ops/backups/
ops/backup-postgres.sh /var/backups/maxli   # o en la ruta que se indique
```

El script vuelca en formato custom, escribe primero un archivo temporal y solo
lo publica después de releerlo con `pg_restore --list`. Deja junto al dump un
`.sha256`. Si algo falla, no queda ningún archivo con pinta de backup bueno.

Nombre resultante: `maxli_db-20260817T012948Z.dump` (sello **UTC**, para que
ordenen bien aunque cambie el huso o el servidor esté en otra zona).

### Diario por cron

```cron
# Backup de MaxLi todas las madrugadas a las 02:15 (hora del servidor).
15 2 * * * /usr/bin/env bash -lc 'set -a; . /etc/maxli/backup.env; set +a; \
    /opt/maxli/ops/backup-postgres.sh /var/backups/maxli' \
    >> /var/log/maxli-backup.log 2>&1
```

Donde `/etc/maxli/backup.env` (permisos `600`, dueño root) contiene `DB_URL`,
`DB_USER` y `DB_PASSWORD`. Cron arranca con un entorno casi vacío: si no se
cargan ahí, el script fallará con un mensaje claro en lugar de respaldar a
medias.

Revisar `/var/log/maxli-backup.log` forma parte de la rutina. **Un cron que
falla en silencio es peor que no tener backup**, porque genera confianza sin
respaldo detrás.

### Retención

Sugerencia para el piloto: 7 diarios + 4 semanales. Purga con `find`:

```bash
find /var/backups/maxli -name '*.dump*' -mtime +7 -delete
```

### Copia fuera del servidor — responsabilidad operativa

Un backup en el mismo disco que la base **no protege del caso que importa**: el
servidor que se pierde entero. Sacar la copia de la máquina es una decisión de
operación que este repositorio no toma por nadie, y aquí no se integra ningún
proveedor de nube.

Lo mínimo exigible:

- **Cifrada en tránsito y en reposo.** El dump lleva datos de clientes, ventas y
  hashes de contraseña. Por ejemplo, `age -r <clave-pública>` o `gpg -c` antes
  de copiarla, o `rsync -e ssh` a un destino ya cifrado.
- **Fuera del servidor** —otra máquina, un disco que no vive conectado, o un
  bucket con versionado.
- **Con la clave de descifrado guardada aparte del backup.** Una copia que nadie
  puede abrir el día del incidente no es una copia.
- Anotar quién tiene acceso.

### Prueba periódica de restauración

**Al menos una vez al mes**, y siempre antes de un despliegue con migraciones:

```bash
ops/ensayo-backup-restore.sh
```

Crea dos bases desechables (`maxli_ensayo_*`), aplica las migraciones reales,
siembra un marcador, respalda, restaura en la segunda base, comprueba el
marcador y `flyway_schema_history`, y borra las bases pase lo que pase. Nunca
toca `maxli_db`.

Para ensayar un backup **real** en vez de uno sintético, restaurarlo a mano
sobre una base desechable (§4) y verificar que la última migración coincide con
la de producción.

---

## 4. Restauración

> **La aplicación debe estar detenida, o al menos sin escrituras, durante toda
> la restauración.** `pg_restore --clean` borra y recrea cada objeto: una
> aplicación viva escribiendo en medio deja la base inconsistente y la venta que
> estuviera en curso se pierde sin dejar rastro claro.

```bash
sudo systemctl stop maxli                     # 1. detener la aplicación

createdb -U postgres maxli_restaurada          # 2. base destino (no la viva)

DB_URL='jdbc:postgresql://localhost:5432/maxli_db' \
DB_USER='maxli' DB_PASSWORD='...' \
ops/restore-postgres.sh \
    --dump /var/backups/maxli/maxli_db-20260817T012948Z.dump \
    --base maxli_restaurada \
    --confirmar RESTAURAR:maxli_restaurada     # 3. restaurar
```

El script **no tiene base por defecto** y exige que la confirmación repita el
nombre del destino: es lo que impide vaciar la base equivocada por un copiar y
pegar. Antes de tocar nada verifica el `.sha256` y que el dump se deje leer; si
falla, la base queda intacta. La restauración va en una sola transacción, así
que un error a mitad no deja una base a medias. Al terminar comprueba
conectividad, `flyway_schema_history` y el número de tablas.

`DB_URL` solo aporta host y puerto: la base la manda `--base`.

Para volver a operar sobre la base restaurada, apuntar `DB_URL` a ella y
arrancar; o renombrar (`ALTER DATABASE`) con la aplicación detenida.

---

## 5. Despliegue

Secuencia mínima. **No se salta el paso 1**, ni siquiera "porque es un cambio
pequeño": el backup previo es lo único que hace reversible un despliegue con
migraciones.

```bash
# 1. Backup y anotar el archivo resultante
ops/backup-postgres.sh /var/backups/maxli

# 2. Construir y guardar el artefacto anterior antes de pisarlo
cd backend && mvn clean package -DskipTests=false
cp /opt/maxli/maxli-backend.jar /opt/maxli/maxli-backend.jar.anterior
cp target/maxli-backend-0.0.1-SNAPSHOT.jar /opt/maxli/maxli-backend.jar

cd .. && npm ci && npm run build      # frontend a dist/, servido por el proxy

# 3. Arrancar (Flyway aplica las migraciones pendientes al iniciar)
sudo systemctl restart maxli

# 4. Healthcheck
curl -fsS -H 'X-Forwarded-Proto: https' \
     http://127.0.0.1:8080/actuator/health/readiness      # {"status":"UP"}

# 5. Smoke test (§6)
```

Guardar siempre el `.jar` anterior: sin él no hay rollback de artefacto, solo
una reconstrucción a contrarreloj.

---

## 6. Verificación posterior (smoke test)

Los cinco puntos, en orden. Cualquiera que falle es un despliegue fallido.

1. **Readiness** — `curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1:8080/actuator/health/readiness` → `{"status":"UP"}`
2. **Sin errores de Flyway al arrancar** —
   ```bash
   journalctl -u maxli --since '5 min ago' | grep -iE 'flyway|migration|validate failed'
   ```
   No debe aparecer `FlywayValidateException`, `Migration checksum mismatch` ni
   `Detected applied migration not resolved locally`.
3. **Login** — iniciar sesión en la UI con una cuenta real. Debe devolver la
   cookie de sesión y cargar el panel.
4. **Consulta básica** — abrir Productos y confirmar que lista datos; abrir una
   venta reciente y ver su detalle.
5. **Historial de migraciones coherente** —
   ```sql
   SELECT version, description, success
     FROM flyway_schema_history
    ORDER BY installed_rank DESC LIMIT 5;
   ```
   Todas con `success = true`.

---

## 7. Criterios para declarar el despliegue fallido

Declarar fallo —sin discutirlo— ante cualquiera de estos:

- `readiness` no llega a `UP` en **5 minutos** desde el arranque.
- La aplicación no arranca: falta una variable, Flyway falla, la base no responde.
- Flyway reporta checksum mismatch o una migración aplicada que ya no existe en el repositorio.
- El login no funciona para ninguna cuenta.
- El POS no puede cerrar una venta, o la cierra dejando stock o caja inconsistentes.
- Errores 5xx sostenidos en la operación normal.
- Pérdida o corrupción visible de datos.

Declarado el fallo, empieza el rollback. **No se depura en producción con la
tienda parada**: primero se vuelve a un estado que funcione, después se
investiga con los logs y una copia de la base.

---

## 8. Rollback

### Caso A — el esquema sigue siendo compatible (lo habitual)

Ocurre cuando el despliegue no traía migraciones, o las que traía solo añaden
cosas (una tabla nueva, una columna que admite nulos) que la versión anterior
simplemente ignora.

```bash
sudo systemctl stop maxli
cp /opt/maxli/maxli-backend.jar.anterior /opt/maxli/maxli-backend.jar
sudo systemctl start maxli
```

Verificar con el smoke test (§6). **No se toca la base**: las migraciones nuevas
se quedan aplicadas y no estorban.

> Ojo: la versión anterior arranca con `ddl-auto: validate`. Si una migración
> nueva cambió algo que esa versión sí mira —renombrar una columna, volverla
> `NOT NULL`—, fallará al arrancar. Eso es el caso B.

### Caso B — el esquema ya no es compatible

Migraciones que renombran, borran, cambian tipos o añaden restricciones que los
datos viejos no cumplen. El artefacto anterior no puede hablar con esta base.

```bash
# 1. Detener la aplicación. No hay rollback con la base recibiendo escrituras.
sudo systemctl stop maxli

# 2. Restaurar el backup previo al despliegue (§4)
DB_URL='jdbc:postgresql://localhost:5432/maxli_db' \
DB_USER='maxli' DB_PASSWORD='...' \
ops/restore-postgres.sh \
    --dump /var/backups/maxli/<el-backup-del-paso-1-del-despliegue>.dump \
    --base maxli_db \
    --confirmar RESTAURAR:maxli_db

# 3. Volver al artefacto anterior
cp /opt/maxli/maxli-backend.jar.anterior /opt/maxli/maxli-backend.jar

# 4. Arrancar y verificar (§6)
sudo systemctl start maxli
```

**Se pierde todo lo ocurrido entre el backup y el fallo.** Por eso el backup se
toma inmediatamente antes de desplegar y por eso se despliega fuera del horario
de la tienda. Registrar qué operaciones quedaron dentro de esa ventana: las
ventas de ese lapso hay que reconstruirlas a mano desde los comprobantes.

### Lo que no se hace nunca

- ❌ **Editar una migración ya aplicada.** Flyway guarda el checksum de cada
  una; cambiar el archivo hace que el arranque falle en todas las bases donde
  ya corrió, incluidas las de los demás. Lo correcto es una migración nueva
  hacia adelante (`V36__...`).
- ❌ **Borrar filas de `flyway_schema_history`** para "reintentar". Deja el
  historial mintiendo sobre el estado real del esquema.
- ❌ **Improvisar SQL inverso** (`DROP COLUMN`, `ALTER ... TYPE`) contra la base
  productiva. Es exactamente cómo se convierte un despliegue fallido en pérdida
  de datos. El rollback de esquema es **restaurar el backup**, y no hay otro.
- ❌ Restaurar sobre `maxli_db` sin haber detenido la aplicación.

---

## 9. Retención de logs

La aplicación escribe a `stdout`; en un despliegue con `systemd` los recoge
`journald`. Configurar retención explícita para que el disco no se llene y para
tener con qué investigar:

```ini
# /etc/systemd/journald.conf
SystemMaxUse=2G
MaxRetentionSec=30day
```

Los logs **no contienen** contraseñas, tokens ni NCF completos; eso ya está
resuelto en el código y debe seguir así.

---

## 10. Resumen operativo

| Situación | Acción |
|---|---|
| Antes de cualquier despliegue | `ops/backup-postgres.sh` |
| Todos los días | Backup por cron + revisar el log |
| Cada mes | `ops/ensayo-backup-restore.sh` |
| `readiness` en `503` | Sacar de rotación; revisar PostgreSQL. **No** reiniciar por esto. |
| `liveness` en fallo | Reiniciar el proceso |
| Despliegue fallido, esquema compatible | Rollback de artefacto (§8 A) |
| Despliegue fallido, esquema incompatible | Detener, restaurar backup, artefacto anterior (§8 B) |
| Servidor perdido | Reinstalar, restaurar la copia off-host, verificar (§6) |
