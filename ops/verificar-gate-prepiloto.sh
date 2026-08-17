#!/usr/bin/env bash
#
# Pruebas del gate de salida a piloto (ops/verificar-prepiloto.sh).
#
# El gate decide si un entorno puede recibir operación real. Un gate que
# aprueba lo que debería rechazar es peor que no tenerlo: da permiso con la
# firma de una comprobación. Por eso aquí casi todos los casos son negativos —
# se monta un entorno roto de una forma concreta y se exige que el gate lo vea.
#
#   Uso:  ops/verificar-gate-prepiloto.sh
#
# Necesita PostgreSQL accesible (PGHOST/PGPORT/PGUSER/PGPASSWORD), Maven para
# aplicar las migraciones reales y python3 para el servidor de sondas de prueba.
#
# NUNCA toca la base del piloto: crea una base propia con nombre único
# 'maxli_gate_*' y la borra al terminar, pase lo que pase.

set -Eeuo pipefail
umask 077

readonly NOMBRE_SCRIPT="$(basename "$0")"
readonly DIRECTORIO_OPS="$(cd "$(dirname "$0")" && pwd)"
readonly RAIZ="$(cd "$DIRECTORIO_OPS/.." && pwd)"
readonly GATE="$DIRECTORIO_OPS/verificar-prepiloto.sh"
readonly SERVIDOR="$DIRECTORIO_OPS/servidor-salud-de-prueba.py"

correctas=0
fallidas=0

verde() { printf '  \033[32mok\033[0m    %s\n' "$1"; }
rojo()  { printf '  \033[31mFALLA\033[0m %s\n' "$1"; }
paso()  { echo; echo "── $* ──────────────────────────────────────"; }

fallar() {
    echo "[$NOMBRE_SCRIPT] ERROR: $*" >&2
    exit 1
}

# ── Contrato ──────────────────────────────────────────────────────────

for herramienta in psql createdb dropdb mvn python3 curl; do
    command -v "$herramienta" >/dev/null 2>&1 || fallar "falta '$herramienta'."
done

[[ -f "$GATE" ]] || fallar "no existe $GATE. Es lo que estas pruebas verifican."
[[ -f "$SERVIDOR" ]] || fallar "no existe $SERVIDOR."

readonly HOST="${PGHOST:-localhost}"
readonly PUERTO="${PGPORT:-5432}"
readonly USUARIO="${PGUSER:-$(whoami)}"
readonly PASSWORD="${PGPASSWORD:-ensayo-local-sin-uso}"

psql --host="$HOST" --port="$PUERTO" --username="$USUARIO" --dbname=postgres \
     --quiet --tuples-only --command="SELECT 1" >/dev/null 2>&1 \
    || fallar "no hay un PostgreSQL accesible en $HOST:$PUERTO como '$USUARIO'."

readonly SUFIJO="$(date -u +%Y%m%d%H%M%S)_$$"
readonly BASE="maxli_gate_${SUFIJO}"
readonly TEMPORAL="$(mktemp -d)"
readonly ESTADO_SONDAS="$TEMPORAL/sondas"
readonly BACKUPS_LOCALES="$TEMPORAL/backups"
readonly BACKUPS_EXTERNOS="$TEMPORAL/externo"
readonly MIGRACIONES="$RAIZ/backend/src/main/resources/db/migration"

# Guarda explícita: si alguien edita el nombre, la suite se niega a correr antes
# de crear o borrar nada.
[[ "$BASE" == maxli_gate_* ]] || fallar "la suite solo opera sobre bases 'maxli_gate_*'."

pid_servidor=""

limpiar() {
    local estado=$?
    echo
    echo "[$NOMBRE_SCRIPT] Limpiando…"
    if [[ -n "$pid_servidor" ]]; then
        kill "$pid_servidor" 2>/dev/null || true
        wait "$pid_servidor" 2>/dev/null || true
        echo "  servidor de sondas detenido"
    fi
    if [[ "$BASE" == maxli_gate_* ]]; then
        dropdb --host="$HOST" --port="$PUERTO" --username="$USUARIO" \
               --if-exists --force "$BASE" 2>/dev/null \
            && echo "  base desechable eliminada: $BASE" \
            || echo "  base desechable no existía: $BASE"
    fi
    rm -rf "$TEMPORAL"
    echo "  temporales eliminados"
    exit $estado
}
trap limpiar EXIT INT TERM

sql() {
    psql --host="$HOST" --port="$PUERTO" --username="$USUARIO" --dbname="$BASE" \
         --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 --command="$1"
}

# ── Preparación: base desechable con el esquema real ──────────────────

paso "Base desechable y migraciones reales"
createdb --host="$HOST" --port="$PUERTO" --username="$USUARIO" "$BASE"
echo "base: $BASE"

(cd "$RAIZ/backend" && mvn --quiet flyway:migrate \
    -Dflyway.url="jdbc:postgresql://${HOST}:${PUERTO}/${BASE}" \
    -Dflyway.user="$USUARIO" \
    -Dflyway.password="$PASSWORD" \
    -Dflyway.locations="filesystem:src/main/resources/db/migration") \
    || fallar "Flyway no pudo migrar la base de prueba."

echo "migraciones aplicadas: $(sql "SELECT count(*) FROM flyway_schema_history WHERE success")"

# ── Preparación: configuración operativa mínima ───────────────────────
#
# Tras las migraciones la base tiene el 'admin' que V35 dejó bloqueado y nada
# más: ni almacén, ni caja, ni resoluciones. Ese estado es justamente uno de los
# escenarios rojos, así que se prueba antes de sembrar.

paso "Sembrando el entorno válido de referencia"
sql "INSERT INTO almacen (nombre, descripcion, estado, fecha_creacion)
     VALUES ('Almacén Gate', 'Prueba del gate', 'ACTIVO', NOW())" >/dev/null
sql "INSERT INTO caja (nombre, estado, id_almacen, fecha_creacion)
     SELECT 'Caja Gate', 'ACTIVO', a.id_almacen, NOW()
       FROM almacen a WHERE a.nombre = 'Almacén Gate'" >/dev/null
# Hash con forma de BCrypt real: lo que el gate mira es que no sea el centinela
# 'LOCKED::' que deja V35, no que la contraseña sirva para nada.
sql "INSERT INTO usuario (username, email, password_hash, estado, fecha_creacion)
     VALUES ('cajera.gate', 'cajera.gate@ejemplo.invalid',
             '\$2a\$10\$C6UzMDM.H6dfI/f/IKcEe.e0000000000000000000000000000000',
             'ACTIVO', NOW())" >/dev/null
sql "INSERT INTO usuario_rol (id_usuario, id_rol)
     SELECT u.id_usuario, r.id_rol FROM usuario u, rol r
      WHERE u.username = 'cajera.gate' AND r.nombre = 'CAJERO'" >/dev/null

sembrar_resoluciones() {
    sql "DELETE FROM resolucion_ncf WHERE tipo_ncf IN ('B02','B04')" >/dev/null
    sql "INSERT INTO resolucion_ncf (tipo_ncf, descripcion, numero_resolucion, prefijo,
             secuencia_inicio, secuencia_final, secuencia_actual,
             fecha_vencimiento, estado, fecha_creacion)
         VALUES
           ('B02','Consumidor Final (gate)','GATE-B02-001','B02',
            1, 10000, 1, CURRENT_DATE + 365, 'ACTIVO', NOW()),
           ('B04','Nota de Crédito (gate)','GATE-B04-001','B04',
            1, 10000, 1, CURRENT_DATE + 365, 'ACTIVO', NOW())" >/dev/null
}
sembrar_resoluciones
echo "almacén, caja, usuario habilitado y resoluciones B02/B04 sembrados"

# ── Preparación: servidor de sondas ───────────────────────────────────

paso "Servidor de sondas de prueba"
mkdir -p "$ESTADO_SONDAS"
archivo_puerto="$TEMPORAL/puerto"
python3 "$SERVIDOR" "$ESTADO_SONDAS" "$archivo_puerto" &
pid_servidor=$!

for _ in $(seq 1 50); do
    [[ -s "$archivo_puerto" ]] && break
    sleep 0.1
done
[[ -s "$archivo_puerto" ]] || fallar "el servidor de sondas no publicó su puerto."
readonly PUERTO_SONDAS="$(cat "$archivo_puerto")"
readonly URL_BASE="http://127.0.0.1:${PUERTO_SONDAS}"
echo "sondas en $URL_BASE"

sondas_sanas() {
    echo 200 > "$ESTADO_SONDAS/salud"
    echo 200 > "$ESTADO_SONDAS/liveness"
    echo 200 > "$ESTADO_SONDAS/readiness"
    echo 401 > "$ESTADO_SONDAS/protegida"
}
sondas_sanas

# ── Preparación: backups local y externo ──────────────────────────────

paso "Backups de referencia"
mkdir -p "$BACKUPS_LOCALES" "$BACKUPS_EXTERNOS"

checksum_de() {
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "$(dirname "$1")" && sha256sum "$(basename "$1")" > "$(basename "$1").sha256")
    else
        (cd "$(dirname "$1")" && shasum -a 256 "$(basename "$1")" > "$(basename "$1").sha256")
    fi
}

readonly DUMP="${BASE}-$(date -u +%Y%m%dT%H%M%SZ).dump"

sembrar_backups() {
    rm -f "$BACKUPS_LOCALES"/* "$BACKUPS_EXTERNOS"/*
    # No es un dump de verdad: el gate comprueba antigüedad e integridad del
    # archivo, no que PostgreSQL sepa leerlo. Eso ya lo hace backup-postgres.sh
    # al publicarlo y restore-postgres.sh al consumirlo.
    printf 'dump sintético del gate %s\n' "$SUFIJO" > "$BACKUPS_LOCALES/$DUMP"
    checksum_de "$BACKUPS_LOCALES/$DUMP"
    cp "$BACKUPS_LOCALES/$DUMP" "$BACKUPS_LOCALES/$DUMP.sha256" "$BACKUPS_EXTERNOS/"
}
sembrar_backups
echo "backup local y copia externa: $DUMP"

# ── Ejecución del gate ────────────────────────────────────────────────

ENTORNO_BASE=(
    SPRING_PROFILES_ACTIVE="prod"
    DB_URL="jdbc:postgresql://${HOST}:${PUERTO}/${BASE}"
    DB_USER="$USUARIO"
    DB_PASSWORD="$PASSWORD"
    JWT_SECRET="secreto-de-prueba-del-gate-con-longitud-y-variedad-suficientes-9f3a"
    CORS_ALLOWED_ORIGINS="https://erp.ejemplo.invalid"
    MAXLI_URL_BASE="$URL_BASE"
    BACKUP_DIR="$BACKUPS_LOCALES"
    BACKUP_EXTERNO_DIR="$BACKUPS_EXTERNOS"
    MIGRACIONES_DIR="$MIGRACIONES"
)

ejecutar_gate() {
    env "${ENTORNO_BASE[@]}" "$@" bash "$GATE" 2>&1
}

# El gate debe rechazar y explicar por qué. Un rechazo sin motivo accionable
# manda al operador a leer el script para saber qué arreglar.
debe_fallar_con() {
    local descripcion="$1" fragmento="$2"
    shift 2
    local salida estado=0
    salida="$(ejecutar_gate "$@")" || estado=$?

    if [[ $estado -eq 0 ]]; then
        rojo "$descripcion — el gate aprobó y debía rechazar"
        fallidas=$((fallidas + 1))
        return
    fi
    if [[ "$salida" != *"$fragmento"* ]]; then
        rojo "$descripcion — rechazó, pero sin explicar «${fragmento}»"
        printf '        salida: %s\n' "$salida"
        fallidas=$((fallidas + 1))
        return
    fi
    verde "$descripcion"
    correctas=$((correctas + 1))
}

debe_aprobar() {
    local descripcion="$1"
    shift
    local salida estado=0
    salida="$(ejecutar_gate "$@")" || estado=$?

    if [[ $estado -ne 0 ]]; then
        rojo "$descripcion — el gate rechazó un entorno válido (estado $estado)"
        printf '        salida: %s\n' "$salida"
        fallidas=$((fallidas + 1))
        return
    fi
    verde "$descripcion"
    correctas=$((correctas + 1))
}

# ── Escenarios: perfil y variables ────────────────────────────────────

paso "Perfil y variables obligatorias"

debe_fallar_con "sin SPRING_PROFILES_ACTIVE no hay gate" "SPRING_PROFILES_ACTIVE" \
    SPRING_PROFILES_ACTIVE=""
debe_fallar_con "un perfil que no es prod se rechaza" "prod" \
    SPRING_PROFILES_ACTIVE="dev"
debe_fallar_con "sin JWT_SECRET se rechaza" "JWT_SECRET" \
    JWT_SECRET=""
debe_fallar_con "un JWT_SECRET corto se rechaza" "JWT_SECRET" \
    JWT_SECRET="corto"
debe_fallar_con "sin CORS_ALLOWED_ORIGINS se rechaza" "CORS_ALLOWED_ORIGINS" \
    CORS_ALLOWED_ORIGINS=""
debe_fallar_con "un origen CORS sin HTTPS se rechaza" "HTTPS" \
    CORS_ALLOWED_ORIGINS="http://erp.ejemplo.invalid"
debe_fallar_con "un comodín en CORS se rechaza" "comodín" \
    CORS_ALLOWED_ORIGINS="https://*.ejemplo.invalid"
debe_fallar_con "HTTPS desactivado a mano se rechaza" "require-https" \
    MAXLI_SECURITY_REQUIRE_HTTPS="false"
debe_fallar_con "la cookie sin Secure se rechaza" "Secure" \
    MAXLI_SECURITY_COOKIE_SECURE="false"

# ── Escenarios: base de datos y migraciones ───────────────────────────

paso "Conectividad y migraciones"

debe_fallar_con "una base inalcanzable se rechaza" "PostgreSQL" \
    DB_URL="jdbc:postgresql://${HOST}:${PUERTO}/maxli_gate_inexistente_${SUFIJO}"

# Se retira la última migración aplicada: el esquema queda por detrás de lo que
# el repositorio trae, que es exactamente el despliegue a medio aplicar.
ultima_version="$(sql "SELECT version FROM flyway_schema_history
                        WHERE success ORDER BY installed_rank DESC LIMIT 1")"
sql "DELETE FROM flyway_schema_history WHERE version = '${ultima_version}'" >/dev/null
debe_fallar_con "una migración pendiente se rechaza" "pendiente"
# Se repone para que el resto de escenarios parta de un esquema al día.
sql "INSERT INTO flyway_schema_history
       (installed_rank, version, description, type, script, checksum,
        installed_by, installed_on, execution_time, success)
     SELECT max(installed_rank) + 1, '${ultima_version}', 'repuesta por la suite',
            'SQL', 'V${ultima_version}__repuesta.sql', 0, current_user, NOW(), 0, true
       FROM flyway_schema_history" >/dev/null

# Una migración que quedó a medias deja su fila con success=false. Flyway se
# negará a arrancar la próxima vez, pero el gate debe verlo antes de que alguien
# reinicie la aplicación creyendo que el despliegue terminó bien.
sql "INSERT INTO flyway_schema_history
       (installed_rank, version, description, type, script, checksum,
        installed_by, installed_on, execution_time, success)
     SELECT max(installed_rank) + 1, '9999', 'migración a medias', 'SQL',
            'V9999__a_medias.sql', 0, current_user, NOW(), 0, false
       FROM flyway_schema_history" >/dev/null
debe_fallar_con "una migración fallida en el historial se rechaza" "fallida"
sql "DELETE FROM flyway_schema_history WHERE version = '9999'" >/dev/null

# ── Escenarios: sondas y ruta protegida ───────────────────────────────

paso "Sondas y superficie protegida"

echo 200 > "$ESTADO_SONDAS/protegida"
debe_fallar_con "una ruta protegida abierta a anónimos se rechaza" "anónimo"
sondas_sanas

echo 503 > "$ESTADO_SONDAS/readiness"
debe_fallar_con "readiness caída se rechaza" "readiness"
sondas_sanas

echo 503 > "$ESTADO_SONDAS/liveness"
debe_fallar_con "liveness caída se rechaza" "liveness"
sondas_sanas

debe_fallar_con "una aplicación inalcanzable se rechaza" "alcanzable" \
    MAXLI_URL_BASE="http://127.0.0.1:1"

# ── Escenarios: configuración operativa ───────────────────────────────

paso "Configuración operativa mínima"

sql "UPDATE almacen SET estado = 'INACTIVO'" >/dev/null
debe_fallar_con "sin almacén activo se rechaza" "almacén"
sql "UPDATE almacen SET estado = 'ACTIVO'" >/dev/null

sql "UPDATE caja SET estado = 'INACTIVO'" >/dev/null
debe_fallar_con "sin caja activa se rechaza" "caja"
sql "UPDATE caja SET estado = 'ACTIVO'" >/dev/null

# El 'admin' que deja V35 tiene el centinela LOCKED:: y no puede iniciar sesión:
# una base donde solo queda esa cuenta no tiene a nadie que pueda vender.
sql "UPDATE usuario SET estado = 'INACTIVO' WHERE username = 'cajera.gate'" >/dev/null
debe_fallar_con "sin usuarios habilitados se rechaza" "usuario"
sql "UPDATE usuario SET estado = 'ACTIVO' WHERE username = 'cajera.gate'" >/dev/null

# ── Escenarios: resoluciones NCF ──────────────────────────────────────

paso "Resoluciones NCF B02 y B04"

sql "DELETE FROM resolucion_ncf WHERE tipo_ncf = 'B04'" >/dev/null
debe_fallar_con "sin resolución B04 se rechaza" "B04"
sembrar_resoluciones

sql "UPDATE resolucion_ncf SET fecha_vencimiento = CURRENT_DATE - 1
      WHERE tipo_ncf = 'B04'" >/dev/null
debe_fallar_con "una B04 vencida se rechaza" "vencid"
sembrar_resoluciones

# Agotada se expresa por estado, no por secuencia: el CHECK de la tabla no
# admite secuencia_actual > secuencia_final, y NcfService marca AGOTADO al
# consumir el último número.
sql "UPDATE resolucion_ncf SET secuencia_actual = secuencia_final, estado = 'AGOTADO'
      WHERE tipo_ncf = 'B04'" >/dev/null
debe_fallar_con "una B04 agotada se rechaza" "B04"
sembrar_resoluciones

sql "DELETE FROM resolucion_ncf WHERE tipo_ncf = 'B02'" >/dev/null
debe_fallar_con "sin resolución B02 se rechaza" "B02"
sembrar_resoluciones

sql "UPDATE resolucion_ncf SET fecha_vencimiento = CURRENT_DATE - 1
      WHERE tipo_ncf = 'B02'" >/dev/null
debe_fallar_con "una B02 vencida se rechaza" "vencid"
sembrar_resoluciones

# ── Escenarios: backup local ──────────────────────────────────────────

paso "Backup local"

rm -f "$BACKUPS_LOCALES"/*
debe_fallar_con "sin ningún backup se rechaza" "backup"
sembrar_backups

# 30 h en un umbral de 24 h: el backup existe, pero un desastre costaría más
# operación de la que el RPO del runbook admite.
touch -t "$(date -u -v-30H +%Y%m%d%H%M 2>/dev/null || date -u -d '30 hours ago' +%Y%m%d%H%M)" \
      "$BACKUPS_LOCALES/$DUMP"
debe_fallar_con "un backup más viejo que el umbral se rechaza" "horas"
# Y con el umbral subido, el mismo archivo debe bastar.
debe_aprobar "el umbral de antigüedad es configurable" BACKUP_MAX_HORAS="72"
sembrar_backups

printf 'alterado tras calcular el checksum\n' >> "$BACKUPS_LOCALES/$DUMP"
debe_fallar_con "un backup con checksum inválido se rechaza" "checksum"
sembrar_backups

rm -f "$BACKUPS_LOCALES/$DUMP.sha256"
debe_fallar_con "un backup sin checksum se rechaza" "checksum"
sembrar_backups

# ── Escenarios: copia externa ─────────────────────────────────────────

paso "Copia externa"

rm -f "$BACKUPS_EXTERNOS"/*
debe_fallar_con "sin copia externa del último backup se rechaza" "externa"
sembrar_backups

printf 'corrupción en tránsito\n' >> "$BACKUPS_EXTERNOS/$DUMP"
debe_fallar_con "una copia externa corrupta se rechaza" "checksum"
sembrar_backups

debe_fallar_con "sin destino externo configurado se rechaza" "BACKUP_EXTERNO_DIR" \
    BACKUP_EXTERNO_DIR=""

# ── Escenario verde ───────────────────────────────────────────────────

paso "Entorno desechable completamente válido"

debe_aprobar "un entorno correcto abre el gate"

# ── Higiene: el gate no imprime secretos ──────────────────────────────

paso "Higiene de secretos"

salida_verde="$(ejecutar_gate)"
if [[ "$salida_verde" == *"$PASSWORD"* || "$salida_verde" == *"secreto-de-prueba-del-gate"* ]]; then
    rojo "el gate imprimió un secreto en su salida"
    fallidas=$((fallidas + 1))
else
    verde "el gate no imprime DB_PASSWORD ni JWT_SECRET"
    correctas=$((correctas + 1))
fi

# ── Resumen ───────────────────────────────────────────────────────────

paso "Resultado"
echo "  $correctas correctas, $fallidas fallidas"
echo "  base desechable usada: $BASE (se elimina a continuación)"
[[ $fallidas -eq 0 ]] || exit 1
