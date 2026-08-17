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
# El destino debe ser una base NUEVA Y VACÍA: `pg_restore --clean` solo borra
# los objetos que el dump contiene, así que restaurar sobre una base ya migrada
# dejaría en pie lo creado después del backup. Ver el runbook de operación §4.
#
# IMPORTANTE: la aplicación debe estar detenida —o al menos sin escrituras—
# durante la restauración. Ver el runbook de operación.

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
               Debe estar creada y VACÍA; restaurar sobre una base con datos
               dejaría en pie todo lo que el dump no conoce.
  --confirmar  Debe ser exactamente RESTAURAR:<base_destino>. Nombrar la base
               es lo que impide vaciar la equivocada por un error de copiar y pegar.

  --permitir-sin-checksum
               Restaura aunque no exista el .sha256 junto al dump. Solo para
               recuperación de emergencia: por defecto se falla cerrado.

Variables: DB_URL, DB_USER, DB_PASSWORD (las mismas del backend).
La conexión se rearma contra --base, así que DB_URL puede apuntar a otra base.
AYUDA
    exit 2
}

# ── Argumentos ────────────────────────────────────────────────────────

ARCHIVO_DUMP=""
BASE_DESTINO=""
CONFIRMACION=""
PERMITIR_SIN_CHECKSUM="no"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dump)      [[ $# -ge 2 ]] || fallar "--dump necesita un valor";      ARCHIVO_DUMP="$2"; shift 2 ;;
        --base)      [[ $# -ge 2 ]] || fallar "--base necesita un valor";      BASE_DESTINO="$2"; shift 2 ;;
        --confirmar) [[ $# -ge 2 ]] || fallar "--confirmar necesita un valor"; CONFIRMACION="$2"; shift 2 ;;
        --permitir-sin-checksum) PERMITIR_SIN_CHECKSUM="si"; shift ;;
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
elif [[ "$PERMITIR_SIN_CHECKSUM" == "si" ]]; then
    # Salida de emergencia consciente: un dump traído a mano desde la copia
    # off-host puede llegar sin su .sha256, y en mitad de un incidente
    # restaurar algo sin verificar es mejor que no restaurar nada. Pero hay que
    # pedirlo por su nombre.
    informar "AVISO: no hay $ARCHIVO_CHECKSUM y se pidió --permitir-sin-checksum."
    informar "AVISO: se restaura SIN verificar integridad."
else
    # Por defecto se falla cerrado: restaurar sin verificar es exactamente el
    # momento en que se descubren los archivos corruptos, y para entonces la
    # base destino ya está a medio escribir.
    fallar "no existe $ARCHIVO_CHECKSUM. Copie el .sha256 junto al dump, o pase
       --permitir-sin-checksum si asume el riesgo de restaurar sin verificar."
fi

pg_restore --list "$ARCHIVO_DUMP" >/dev/null 2>&1 \
    || fallar "el dump no supera 'pg_restore --list': está corrupto. No se toca la base."

informar "Dump legible: $(pg_restore --list "$ARCHIVO_DUMP" | grep -cvE '^;|^[[:space:]]*$' || true) objetos."

# ── Conectividad con el destino ───────────────────────────────────────

psql --dbname="$URL_DESTINO" --username="$DB_USER" --no-password \
     --quiet --tuples-only --command="SELECT 1" >/dev/null \
    || fallar "no se puede conectar a la base destino '$BASE_DESTINO'. Créela antes de restaurar."

# ── El destino tiene que estar vacío ──────────────────────────────────
#
# `pg_restore --clean` solo borra los objetos que el propio dump contiene: lo
# que se creó DESPUÉS del backup sobrevive. Restaurar un backup viejo sobre una
# base ya migrada dejaría las tablas de las migraciones posteriores en pie
# junto a un flyway_schema_history antiguo, y el arranque fallaría —o peor,
# arrancaría contra un esquema que nadie describe.
#
# Por eso no se restaura «encima» de nada: se restaura en una base nueva y
# después se decide qué hacer con ella (repuntar DB_URL o renombrar con la
# aplicación detenida). Es un paso más en el runbook y una clase entera de
# desastre menos.
OBJETOS_PREVIOS="$(psql --dbname="$URL_DESTINO" --username="$DB_USER" --no-password \
    --quiet --tuples-only --no-align --command="
        SELECT count(*) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_toast%'
           AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')")"

if [[ "$OBJETOS_PREVIOS" != "0" ]]; then
    fallar "la base destino '$BASE_DESTINO' ya contiene $OBJETOS_PREVIOS objetos y no se toca.

       Restaurar sobre una base con datos deja lo que el dump no conoce: las
       tablas de migraciones posteriores al backup sobrevivirían junto a un
       flyway_schema_history viejo.

       Restaure en una base nueva y vacía, propiedad de \$DB_USER —desde
       PostgreSQL 15 el esquema public no deja crear tablas a quien no sea
       dueño de la base:
           createdb --owner='$DB_USER' ${BASE_DESTINO}_restaurada
           $NOMBRE_SCRIPT --dump '$ARCHIVO_DUMP' --base ${BASE_DESTINO}_restaurada \\
                          --confirmar RESTAURAR:${BASE_DESTINO}_restaurada

       Y luego, con la aplicación detenida, apunte DB_URL a esa base o
       renómbrela. Ver el runbook de operación §4."
fi

informar "Destino: base '$BASE_DESTINO' en ${autoridad} (vacía, como debe ser)"
informar "La aplicación debe estar detenida o sin escrituras. Restaurando…"

# ── Restauración ──────────────────────────────────────────────────────

# --clean --if-exists: red de seguridad, no la defensa principal. Solo borra los
#   objetos que el dump contiene, por eso arriba se exige un destino vacío; aquí
#   cubre los restos de un intento anterior interrumpido.
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
