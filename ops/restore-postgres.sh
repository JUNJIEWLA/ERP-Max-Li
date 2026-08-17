#!/usr/bin/env bash
#
# ISSUE-015 — Restauración de un dump del piloto sobre una base concreta.
#
# Restaurar destruye datos: este script no adivina el destino, no trae ninguna
# base por defecto y no se ejecuta sin una confirmación que nombre la base que
# se va a sobrescribir. Verifica el archivo *antes* de tocar nada, para no
# dejar la base a medio vaciar con un dump que resultó estar corrupto.
#
#   Uso:
#     DB_URL=... DB_USER=... DB_PASSWORD=... \
#     ops/restore-postgres.sh --dump <archivo.dump> --base <nombre_destino> \
#                             --confirmar RESTAURAR:<nombre_destino>
#
# IMPORTANTE: la aplicación debe estar detenida —o al menos sin escrituras—
# durante la restauración. Ver docs/RUNBOOK_PILOTO.md.

set -Eeuo pipefail
umask 077

readonly NOMBRE_SCRIPT="$(basename "$0")"

fallar() {
    echo "[$NOMBRE_SCRIPT] ERROR: $*" >&2
    exit 1
}

informar() {
    echo "[$NOMBRE_SCRIPT] $*"
}

uso() {
    cat >&2 <<AYUDA
Uso: $NOMBRE_SCRIPT --dump <archivo.dump> --base <base_destino> --confirmar RESTAURAR:<base_destino>

  --dump       Archivo producido por ops/backup-postgres.sh (formato custom).
  --base       Base de datos destino. Obligatoria: no hay valor por defecto.
  --confirmar  Debe ser exactamente RESTAURAR:<base_destino>. Nombrar la base
               es lo que impide vaciar la equivocada por un error de copiar y pegar.

Variables: DB_URL, DB_USER, DB_PASSWORD (las mismas del backend).
La conexión se rearma contra --base, así que DB_URL puede apuntar a otra base.
AYUDA
    exit 2
}

# ── Argumentos ────────────────────────────────────────────────────────

ARCHIVO_DUMP=""
BASE_DESTINO=""
CONFIRMACION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dump)      [[ $# -ge 2 ]] || fallar "--dump necesita un valor";      ARCHIVO_DUMP="$2"; shift 2 ;;
        --base)      [[ $# -ge 2 ]] || fallar "--base necesita un valor";      BASE_DESTINO="$2"; shift 2 ;;
        --confirmar) [[ $# -ge 2 ]] || fallar "--confirmar necesita un valor"; CONFIRMACION="$2"; shift 2 ;;
        -h|--help)   uso ;;
        *)           fallar "argumento no reconocido: $1" ;;
    esac
done

[[ -n "$ARCHIVO_DUMP" ]] || uso
[[ -n "$BASE_DESTINO" ]] || uso
[[ -n "$CONFIRMACION" ]] || uso

# Confirmación explícita y no interactiva: sirve igual desde una terminal que
# desde el runbook copiado a un ticket, y obliga a escribir el nombre real de
# la base que se va a sobrescribir.
readonly CONFIRMACION_ESPERADA="RESTAURAR:${BASE_DESTINO}"
[[ "$CONFIRMACION" == "$CONFIRMACION_ESPERADA" ]] \
    || fallar "confirmación incorrecta. Se esperaba exactamente: $CONFIRMACION_ESPERADA"

# Un nombre de base con comillas o espacios acabaría interpolado en SQL: se
# restringe al alfabeto que PostgreSQL admite sin comillas.
[[ "$BASE_DESTINO" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] \
    || fallar "nombre de base no válido: '$BASE_DESTINO' (use letras, dígitos y _)"

[[ -f "$ARCHIVO_DUMP" ]] || fallar "no existe el dump: $ARCHIVO_DUMP"
[[ -s "$ARCHIVO_DUMP" ]] || fallar "el dump está vacío: $ARCHIVO_DUMP"

# ── Contrato de entorno ───────────────────────────────────────────────

for herramienta in pg_restore psql; do
    command -v "$herramienta" >/dev/null 2>&1 \
        || fallar "falta '$herramienta'. Instale los clientes de PostgreSQL (postgresql-client)."
done

: "${DB_URL:?falta DB_URL}"
: "${DB_USER:?falta DB_USER}"
: "${DB_PASSWORD:?falta DB_PASSWORD}"

URL_BASE="${DB_URL#jdbc:}"
[[ "$URL_BASE" == postgresql://* || "$URL_BASE" == postgres://* ]] \
    || fallar "DB_URL no parece una URL de PostgreSQL."

export PGPASSWORD="$DB_PASSWORD"

# Se reconstruye la URL apuntando a la base destino: DB_URL aporta host, puerto
# y parámetros, pero la base la manda --base y nunca la variable de entorno.
# Así el mismo entorno del backend sirve para restaurar en una base de ensayo
# sin riesgo de que la de producción se cuele por omisión.
sin_esquema="${URL_BASE#*://}"
autoridad="${sin_esquema%%/*}"
resto="${sin_esquema#"$autoridad"}"
parametros=""
if [[ "$resto" == *\?* ]]; then
    parametros="?${resto#*\?}"
fi
readonly URL_DESTINO="postgresql://${autoridad}/${BASE_DESTINO}${parametros}"

# ── Verificación del archivo, antes de tocar la base ──────────────────

readonly ARCHIVO_CHECKSUM="${ARCHIVO_DUMP}.sha256"
if [[ -f "$ARCHIVO_CHECKSUM" ]]; then
    directorio_dump="$(cd "$(dirname "$ARCHIVO_DUMP")" && pwd)"
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "$directorio_dump" && sha256sum --check --status "$(basename "$ARCHIVO_CHECKSUM")") \
            || fallar "el checksum no coincide: el dump llegó alterado o incompleto."
    else
        (cd "$directorio_dump" && shasum -a 256 --check --status "$(basename "$ARCHIVO_CHECKSUM")") \
            || fallar "el checksum no coincide: el dump llegó alterado o incompleto."
    fi
    informar "Checksum verificado."
else
    # No se aborta: un dump traído a mano desde la copia off-host puede llegar
    # sin su .sha256. Pero queda dicho, porque restaurar sin verificar es
    # exactamente el momento en que se descubren los archivos corruptos.
    informar "AVISO: no hay $ARCHIVO_CHECKSUM; se restaura sin verificar integridad."
fi

pg_restore --list "$ARCHIVO_DUMP" >/dev/null 2>&1 \
    || fallar "el dump no supera 'pg_restore --list': está corrupto. No se toca la base."

informar "Dump legible: $(pg_restore --list "$ARCHIVO_DUMP" | grep -cvE '^;|^[[:space:]]*$' || true) objetos."

# ── Conectividad con el destino ───────────────────────────────────────

psql --dbname="$URL_DESTINO" --username="$DB_USER" --no-password \
     --quiet --tuples-only --command="SELECT 1" >/dev/null \
    || fallar "no se puede conectar a la base destino '$BASE_DESTINO'. Créela antes de restaurar."

informar "Destino: base '$BASE_DESTINO' en ${autoridad}"
informar "La aplicación debe estar detenida o sin escrituras. Restaurando…"

# ── Restauración ──────────────────────────────────────────────────────

# --clean --if-exists: el dump borra cada objeto antes de recrearlo, así que la
#   base destino no necesita estar vacía y no quedan restos del esquema viejo.
# --no-owner / --no-acl: los roles son de la instalación, no del respaldo.
# --exit-on-error: sin esto pg_restore continúa tras un fallo y termina con
#   código 0, dejando una base a medio restaurar que parece buena.
# --single-transaction: todo o nada. Si algo falla, la base queda como estaba
#   en lugar de a medio camino. Implica --exit-on-error, que se deja explícito
#   por claridad del contrato.
if ! pg_restore \
        --dbname="$URL_DESTINO" \
        --username="$DB_USER" \
        --no-password \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        --exit-on-error \
        --single-transaction \
        "$ARCHIVO_DUMP"; then
    fallar "la restauración falló. Con --single-transaction la base quedó como estaba antes."
fi

# ── Verificación posterior ────────────────────────────────────────────

consultar() {
    psql --dbname="$URL_DESTINO" --username="$DB_USER" --no-password \
         --quiet --tuples-only --no-align --command="$1"
}

# Asignaciones sin `readonly` a propósito: `readonly VAR=$(cmd)` devuelve el
# estado del builtin, no el del comando, y un psql caído pasaría inadvertido
# bajo `set -e`.
HISTORIAL="$(consultar "SELECT to_regclass('public.flyway_schema_history') IS NOT NULL")"
[[ "$HISTORIAL" == "t" ]] \
    || fallar "la base restaurada no tiene flyway_schema_history: el dump no corresponde a este sistema."

VERSION_ESQUEMA="$(consultar \
    "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1")"
TABLAS="$(consultar \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"

informar "Restauración completada."
informar "  Base:              $BASE_DESTINO"
informar "  Tablas en public:  $TABLAS"
informar "  Última migración:  ${VERSION_ESQUEMA:-ninguna registrada}"
informar ""
informar "Arranque la aplicación con SPRING_PROFILES_ACTIVE y DB_URL apuntando a esta base."
informar "Flyway validará el historial al arrancar; no se revierten migraciones a mano."
