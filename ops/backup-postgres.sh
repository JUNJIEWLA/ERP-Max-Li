#!/usr/bin/env bash
#
# ISSUE-015 — Copia de seguridad verificable de la base del piloto.
#
# Toma la conexión de las mismas variables que ya usa el backend (DB_URL,
# DB_USER, DB_PASSWORD), escribe un dump en formato custom y no lo da por bueno
# hasta haberlo leído de vuelta con pg_restore --list. Un backup que nunca se
# verificó no es un backup: es un archivo.
#
#   Uso:  DB_URL=... DB_USER=... DB_PASSWORD=... ops/backup-postgres.sh [destino]
#
# El destino por defecto es ops/backups/ (ignorado por Git). Ver
# docs/RUNBOOK_PILOTO.md para la programación diaria y la copia off-host.

set -Eeuo pipefail
# Los dumps llevan datos de clientes, ventas y hashes de contraseña: nacen
# legibles solo por su dueño, nunca con los permisos por omisión del sistema.
umask 077

readonly NOMBRE_SCRIPT="$(basename "$0")"

fallar() {
    echo "[$NOMBRE_SCRIPT] ERROR: $*" >&2
    exit 1
}

informar() {
    echo "[$NOMBRE_SCRIPT] $*"
}

# ── Contrato de entrada ───────────────────────────────────────────────

for herramienta in pg_dump pg_restore; do
    command -v "$herramienta" >/dev/null 2>&1 \
        || fallar "falta '$herramienta'. Instale los clientes de PostgreSQL (postgresql-client)."
done

command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 \
    || fallar "falta 'sha256sum' o 'shasum' para calcular el checksum."

: "${DB_URL:?falta DB_URL (p. ej. jdbc:postgresql://localhost:5432/maxli_db)}"
: "${DB_USER:?falta DB_USER}"
: "${DB_PASSWORD:?falta DB_PASSWORD}"

# ── Conexión ──────────────────────────────────────────────────────────

# El backend habla JDBC; las herramientas de PostgreSQL no entienden ese
# prefijo. Se retira solo 'jdbc:' y se deja intacto el resto de la URL —host,
# puerto, base y parámetros como ?sslmode=require— para no reinterpretar por
# nuestra cuenta una cadena que ya funciona en producción.
URL_CONEXION="${DB_URL#jdbc:}"
[[ "$URL_CONEXION" == postgresql://* || "$URL_CONEXION" == postgres://* ]] \
    || fallar "DB_URL no parece una URL de PostgreSQL: se esperaba jdbc:postgresql://... o postgresql://..."

# La contraseña viaja por el entorno del proceso hijo, nunca como argumento:
# los argumentos son visibles en 'ps' para cualquier usuario de la máquina.
export PGPASSWORD="$DB_PASSWORD"

# Nombre de la base solo para etiquetar el archivo: se recorta la ruta y se
# descartan los parámetros de la URL.
base_con_parametros="${URL_CONEXION##*/}"
readonly NOMBRE_BASE="${base_con_parametros%%\?*}"
[[ -n "$NOMBRE_BASE" ]] || fallar "DB_URL no incluye el nombre de la base de datos."

# ── Destino ───────────────────────────────────────────────────────────

readonly DIRECTORIO_DESTINO="${1:-${BACKUP_DIR:-$(cd "$(dirname "$0")" && pwd)/backups}}"
mkdir -p "$DIRECTORIO_DESTINO"
[[ -w "$DIRECTORIO_DESTINO" ]] || fallar "no se puede escribir en $DIRECTORIO_DESTINO"

# UTC y no la hora local: el piloto opera en República Dominicana pero un
# cambio de huso o un servidor en otra zona haría que los backups se ordenaran
# mal justo el día que hagan falta.
readonly SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
readonly ARCHIVO_FINAL="$DIRECTORIO_DESTINO/${NOMBRE_BASE}-${SELLO}.dump"
readonly ARCHIVO_TEMPORAL="${ARCHIVO_FINAL}.parcial"

# Un fallo a mitad de dump no puede dejar un archivo con pinta de backup bueno.
limpiar() {
    rm -f "$ARCHIVO_TEMPORAL"
}
trap limpiar EXIT

if [[ -e "$ARCHIVO_FINAL" ]]; then
    fallar "ya existe $ARCHIVO_FINAL; no se sobrescribe."
fi

# ── Volcado ───────────────────────────────────────────────────────────

informar "Respaldando '$NOMBRE_BASE' en $ARCHIVO_FINAL"

# --format=custom: comprimido y restaurable de forma selectiva con pg_restore.
# --no-owner / --no-acl: el dump no arrastra los roles de esta instalación, así
# que puede restaurarse en la máquina de pruebas sin recrear usuarios.
pg_dump \
    --dbname="$URL_CONEXION" \
    --username="$DB_USER" \
    --no-password \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    --file="$ARCHIVO_TEMPORAL" \
    || fallar "pg_dump falló; no se publica ningún backup."

[[ -s "$ARCHIVO_TEMPORAL" ]] || fallar "pg_dump produjo un archivo vacío."

# ── Verificación antes de publicar ────────────────────────────────────

# Leer el índice del dump obliga a recorrer su cabecera y su tabla de
# contenidos: un archivo truncado o corrupto falla aquí y no dentro de seis
# meses, en mitad de una restauración de emergencia.
pg_restore --list "$ARCHIVO_TEMPORAL" >/dev/null 2>&1 \
    || fallar "el dump no supera 'pg_restore --list': está corrupto o incompleto."

readonly OBJETOS="$(pg_restore --list "$ARCHIVO_TEMPORAL" | grep -cvE '^;|^[[:space:]]*$' || true)"
[[ "$OBJETOS" -gt 0 ]] || fallar "el dump no contiene ningún objeto restaurable."

# ── Publicación atómica ───────────────────────────────────────────────

# mv dentro del mismo sistema de archivos es atómico: quien mire el directorio
# ve el backup completo o no lo ve, nunca uno a medio escribir.
mv "$ARCHIVO_TEMPORAL" "$ARCHIVO_FINAL"
trap - EXIT

# ── Checksum ──────────────────────────────────────────────────────────

# El checksum acompaña al dump para que la restauración pueda comprobar que el
# archivo llegó entero desde donde se haya guardado la copia off-host.
if command -v sha256sum >/dev/null 2>&1; then
    (cd "$DIRECTORIO_DESTINO" && sha256sum "$(basename "$ARCHIVO_FINAL")" > "$(basename "$ARCHIVO_FINAL").sha256")
else
    (cd "$DIRECTORIO_DESTINO" && shasum -a 256 "$(basename "$ARCHIVO_FINAL")" > "$(basename "$ARCHIVO_FINAL").sha256")
fi

informar "Backup verificado: $ARCHIVO_FINAL"
informar "Objetos en el dump: $OBJETOS"
informar "Checksum: $ARCHIVO_FINAL.sha256"
informar "Tamaño: $(du -h "$ARCHIVO_FINAL" | cut -f1)"
informar "Recuerde copiarlo cifrado fuera de esta máquina (ver docs/RUNBOOK_PILOTO.md)."
