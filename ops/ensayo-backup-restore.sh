#!/usr/bin/env bash
#
# ISSUE-015 — Ensayo real de backup → restauración.
#
# Prueba el ciclo completo contra PostgreSQL de verdad: crea dos bases
# desechables, migra una con Flyway, siembra un dato marcador, la respalda con
# ops/backup-postgres.sh, la restaura en la otra con ops/restore-postgres.sh y
# comprueba que el marcador y flyway_schema_history llegaron intactos.
#
# Vive fuera de `mvn test` a propósito: depende de pg_dump/pg_restore/psql
# instalados en la máquina, y no vale la pena volver la suite no portable por
# un ensayo que se corre a mano antes de cada despliegue (ver el runbook).
#
#   Uso:  ops/ensayo-backup-restore.sh
#
# Variables opcionales: PGHOST, PGPORT, PGUSER, PGPASSWORD para el servidor de
# ensayo. Por defecto usa la conexión local del operador.
#
# NUNCA toca la base del piloto: crea sus propias bases con nombre único y las
# borra al terminar, pase lo que pase.

set -Eeuo pipefail
umask 077

readonly NOMBRE_SCRIPT="$(basename "$0")"
readonly DIRECTORIO_OPS="$(cd "$(dirname "$0")" && pwd)"
readonly RAIZ="$(cd "$DIRECTORIO_OPS/.." && pwd)"

fallar() {
    echo "[$NOMBRE_SCRIPT] ERROR: $*" >&2
    exit 1
}

informar() {
    echo "[$NOMBRE_SCRIPT] $*"
}

paso() {
    echo
    echo "── $* ──────────────────────────────────────"
}

# ── Contrato ──────────────────────────────────────────────────────────

for herramienta in psql createdb dropdb pg_dump pg_restore mvn; do
    command -v "$herramienta" >/dev/null 2>&1 || fallar "falta '$herramienta'."
done

readonly HOST_ENSAYO="${PGHOST:-localhost}"
readonly PUERTO_ENSAYO="${PGPORT:-5432}"
readonly USUARIO_ENSAYO="${PGUSER:-$(whoami)}"
# Los scripts de operación exigen DB_PASSWORD no vacía —en el piloto siempre la
# hay— pero un PostgreSQL local suele estar en 'trust' y no pide ninguna. Se usa
# un relleno que libpq ignorará en ese caso, en lugar de relajar el contrato.
readonly PASSWORD_ENSAYO="${PGPASSWORD:-ensayo-local-sin-uso}"

psql --host="$HOST_ENSAYO" --port="$PUERTO_ENSAYO" --username="$USUARIO_ENSAYO" \
     --dbname=postgres --quiet --tuples-only --command="SELECT 1" >/dev/null 2>&1 \
    || fallar "no hay un PostgreSQL accesible en $HOST_ENSAYO:$PUERTO_ENSAYO como '$USUARIO_ENSAYO'."

# Nombres únicos por ejecución: dos ensayos simultáneos no se pisan, y ningún
# nombre puede colisionar por accidente con una base real.
readonly SUFIJO="$(date -u +%Y%m%d%H%M%S)_$$"
readonly BASE_ORIGEN="maxli_ensayo_origen_${SUFIJO}"
readonly BASE_DESTINO="maxli_ensayo_destino_${SUFIJO}"
readonly DIRECTORIO_BACKUPS="$(mktemp -d)"

# Guardia explícita: si alguien edita los nombres, el ensayo se niega a correr
# antes de crear o borrar nada.
for base in "$BASE_ORIGEN" "$BASE_DESTINO"; do
    [[ "$base" == maxli_ensayo_* ]] \
        || fallar "el ensayo solo opera sobre bases 'maxli_ensayo_*'; '$base' no lo es."
done

# ── Limpieza garantizada ──────────────────────────────────────────────

limpiar() {
    local estado=$?
    echo
    informar "Limpiando bases desechables…"
    for base in "$BASE_ORIGEN" "$BASE_DESTINO"; do
        # La guardia se repite aquí: este trap corre en cualquier salida,
        # incluida una interrupción a mitad del ensayo.
        if [[ "$base" == maxli_ensayo_* ]]; then
            dropdb --host="$HOST_ENSAYO" --port="$PUERTO_ENSAYO" --username="$USUARIO_ENSAYO" \
                   --if-exists --force "$base" 2>/dev/null \
                && informar "  eliminada: $base" \
                || informar "  no existía: $base"
        fi
    done
    rm -rf "$DIRECTORIO_BACKUPS"
    informar "  eliminado el directorio temporal de dumps"
    exit $estado
}
trap limpiar EXIT INT TERM

# ── Preparación ───────────────────────────────────────────────────────

paso "Creando bases desechables"
createdb --host="$HOST_ENSAYO" --port="$PUERTO_ENSAYO" --username="$USUARIO_ENSAYO" "$BASE_ORIGEN"
createdb --host="$HOST_ENSAYO" --port="$PUERTO_ENSAYO" --username="$USUARIO_ENSAYO" "$BASE_DESTINO"
informar "origen:  $BASE_ORIGEN"
informar "destino: $BASE_DESTINO"

url_de() {
    echo "jdbc:postgresql://${HOST_ENSAYO}:${PUERTO_ENSAYO}/$1"
}

export DB_USER="$USUARIO_ENSAYO"
export DB_PASSWORD="$PASSWORD_ENSAYO"

paso "Aplicando las migraciones reales con Flyway"
# Es la misma configuración del proyecto: el ensayo no vale nada si el esquema
# que respalda no es el que corre en el piloto.
(cd "$RAIZ/backend" && mvn --quiet flyway:migrate \
    -Dflyway.url="jdbc:postgresql://${HOST_ENSAYO}:${PUERTO_ENSAYO}/${BASE_ORIGEN}" \
    -Dflyway.user="$USUARIO_ENSAYO" \
    -Dflyway.password="$PASSWORD_ENSAYO" \
    -Dflyway.locations="filesystem:src/main/resources/db/migration") \
    || fallar "Flyway no pudo migrar la base de ensayo."

consultar_origen() {
    psql --host="$HOST_ENSAYO" --port="$PUERTO_ENSAYO" --username="$USUARIO_ENSAYO" \
         --dbname="$BASE_ORIGEN" --quiet --tuples-only --no-align --command="$1"
}

consultar_destino() {
    psql --host="$HOST_ENSAYO" --port="$PUERTO_ENSAYO" --username="$USUARIO_ENSAYO" \
         --dbname="$BASE_DESTINO" --quiet --tuples-only --no-align --command="$1"
}

migraciones_origen="$(consultar_origen "SELECT count(*) FROM flyway_schema_history WHERE success")"
informar "Migraciones aplicadas: $migraciones_origen"
[[ "$migraciones_origen" -gt 0 ]] || fallar "Flyway no dejó historial en la base de origen."

paso "Sembrando un dato marcador"
# Una categoría con nombre único: es un maestro sin dependencias, así que el
# ensayo no arrastra medio modelo de datos para probar el ciclo de respaldo.
readonly MARCADOR="ENSAYO-BACKUP-${SUFIJO}"
consultar_origen "INSERT INTO categoria (nombre, descripcion, estado)
                  VALUES ('${MARCADOR}', 'Marcador del ensayo ISSUE-015', 'ACTIVO')" >/dev/null
informar "Marcador insertado: $MARCADOR"

# ── Backup ────────────────────────────────────────────────────────────

paso "Backup con ops/backup-postgres.sh"
DB_URL="$(url_de "$BASE_ORIGEN")" "$DIRECTORIO_OPS/backup-postgres.sh" "$DIRECTORIO_BACKUPS" \
    || fallar "el backup falló."

archivo_dump="$(ls -1 "$DIRECTORIO_BACKUPS"/*.dump 2>/dev/null | head -1)"
[[ -n "$archivo_dump" ]] || fallar "el backup no dejó ningún .dump en $DIRECTORIO_BACKUPS"
[[ -f "${archivo_dump}.sha256" ]] || fallar "el backup no dejó checksum junto al dump."

paso "Comprobando que el checksum detecta alteraciones"
# Un backup verificado tiene que notar un archivo tocado: se prueba sobre una
# copia, para no estropear el dump que se va a restaurar de verdad.
copia_alterada="${DIRECTORIO_BACKUPS}/alterado.dump"
cp "$archivo_dump" "$copia_alterada"
printf '%s  %s\n' \
    "0000000000000000000000000000000000000000000000000000000000000000" \
    "$(basename "$copia_alterada")" > "${copia_alterada}.sha256"
if DB_URL="$(url_de "$BASE_DESTINO")" "$DIRECTORIO_OPS/restore-postgres.sh" \
        --dump "$copia_alterada" --base "$BASE_DESTINO" \
        --confirmar "RESTAURAR:${BASE_DESTINO}" >/dev/null 2>&1; then
    fallar "la restauración aceptó un dump cuyo checksum no coincide."
fi
informar "Rechazado, como debe ser."
rm -f "$copia_alterada" "${copia_alterada}.sha256"

# ── Restauración ──────────────────────────────────────────────────────

paso "Restaurando en la base destino"
DB_URL="$(url_de "$BASE_DESTINO")" "$DIRECTORIO_OPS/restore-postgres.sh" \
    --dump "$archivo_dump" \
    --base "$BASE_DESTINO" \
    --confirmar "RESTAURAR:${BASE_DESTINO}" \
    || fallar "la restauración falló."

# ── Verificación ──────────────────────────────────────────────────────

paso "Verificando la base restaurada"

marcador_restaurado="$(consultar_destino \
    "SELECT count(*) FROM categoria WHERE nombre = '${MARCADOR}'")"
[[ "$marcador_restaurado" == "1" ]] \
    || fallar "el marcador no sobrevivió al ciclo (encontrados: $marcador_restaurado)."
informar "Marcador presente en el destino: $MARCADOR"

migraciones_destino="$(consultar_destino "SELECT count(*) FROM flyway_schema_history WHERE success")"
[[ "$migraciones_destino" == "$migraciones_origen" ]] \
    || fallar "flyway_schema_history no coincide: origen $migraciones_origen, destino $migraciones_destino."
informar "flyway_schema_history íntegro: $migraciones_destino migraciones"

version_origen="$(consultar_origen \
    "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1")"
version_destino="$(consultar_destino \
    "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1")"
[[ "$version_origen" == "$version_destino" ]] \
    || fallar "la última migración no coincide: origen $version_origen, destino $version_destino."
informar "Última migración en ambas: V$version_destino"

tablas_origen="$(consultar_origen \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
tablas_destino="$(consultar_destino \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
[[ "$tablas_origen" == "$tablas_destino" ]] \
    || fallar "el número de tablas no coincide: origen $tablas_origen, destino $tablas_destino."
informar "Tablas en public: $tablas_destino en ambas"

paso "Ensayo completo"
informar "Bases desechables usadas: $BASE_ORIGEN y $BASE_DESTINO (se eliminan a continuación)."
