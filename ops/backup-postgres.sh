#!/usr/bin/env bash
#
# ISSUE-015 — Copia de seguridad verificable de la base del piloto.
#
# Toma la conexión de las mismas variables que ya usa el backend (DB_URL,
# DB_USER, DB_PASSWORD), escribe un dump en formato custom y no lo da por bueno
# hasta haberlo leído de vuelta con pg_restore --list. Un backup que nunca se
# verificó no es un backup: es un archivo.
#
#   Uso:  DB_URL=... DB_USER=... DB_PASSWORD=... \
#         ops/backup-postgres.sh [destino] [--externo <ruta>] [--exigir-externo]
#
# El destino por defecto es ops/backups/ (ignorado por Git). Ver
# el runbook de operación para la programación diaria y la copia off-host.
#
# La copia externa es opcional en el comando y obligatoria en la práctica: un
# backup en el mismo disco que la base no protege del caso que importa, que es
# el servidor perdido entero. Ver §3 del runbook.
#
# Este script NUNCA borra backups. La retención es del `find` documentado en el
# runbook, que es quien conoce la política; un script que purga por su cuenta
# acaba borrando justo el archivo que hacía falta.

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

uso() {
    cat >&2 <<AYUDA
Uso: $NOMBRE_SCRIPT [destino] [--externo <ruta>] [--exigir-externo]

  destino            Directorio donde se publica el dump. Por defecto
                     \$BACKUP_DIR y, si tampoco está, ops/backups/.

  --externo <ruta>   Directorio, FUERA de este servidor, donde se copian el
                     dump y su .sha256 después de verificar el local. Debe
                     existir ya: el script no lo crea, para no escribir dentro
                     de un punto de montaje cuyo recurso remoto no está montado.
                     Equivale a \$BACKUP_EXTERNO_DIR.

  --exigir-externo   Sin copia externa, el backup falla. Equivale a
                     \$BACKUP_EXTERNO_OBLIGATORIO=si. Recomendado en el cron
                     diario del piloto.

  --permitir-mismo-filesystem
                     Acepta un destino externo que comparte sistema de archivos
                     con el dump local. SOLO para ensayos: en el piloto esa
                     situación significa casi siempre un punto de montaje cuyo
                     recurso remoto se cayó. Equivale a
                     \$BACKUP_EXTERNO_PERMITIR_MISMO_FILESYSTEM=si.

Variables: DB_URL, DB_USER, DB_PASSWORD (las mismas del backend).
AYUDA
    exit 2
}

# Número de dispositivo del sistema de archivos donde vive una ruta. GNU y BSD
# no comparten la sintaxis de stat, y el piloto se opera desde las dos.
dispositivo_de() {
    stat -c %d "$1" 2>/dev/null || stat -f %d "$1" 2>/dev/null
}

# Devuelve el sha256 a secas, sin el nombre de archivo que añaden las
# herramientas. Se usa para comparar el original con su copia externa, donde los
# nombres difieren mientras la copia está a medio publicar.
hash_de() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | cut -d' ' -f1
    else
        shasum -a 256 "$1" | cut -d' ' -f1
    fi
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

# ── Argumentos ────────────────────────────────────────────────────────

destino_local=""
destino_externo="${BACKUP_EXTERNO_DIR:-}"
exigir_externo="no"
[[ "${BACKUP_EXTERNO_OBLIGATORIO:-no}" == "si" ]] && exigir_externo="si"
permitir_mismo_fs="no"
[[ "${BACKUP_EXTERNO_PERMITIR_MISMO_FILESYSTEM:-no}" == "si" ]] && permitir_mismo_fs="si"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --externo)
            [[ $# -ge 2 ]] || fallar "--externo necesita un valor (la ruta del destino externo)."
            destino_externo="$2"; shift 2 ;;
        --exigir-externo)
            exigir_externo="si"; shift ;;
        --permitir-mismo-filesystem)
            permitir_mismo_fs="si"; shift ;;
        -h|--help)
            uso ;;
        -*)
            fallar "argumento no reconocido: $1" ;;
        *)
            [[ -z "$destino_local" ]] \
                || fallar "solo se admite un directorio de destino; sobra: $1"
            destino_local="$1"; shift ;;
    esac
done

# ── Destino local ─────────────────────────────────────────────────────

readonly DIRECTORIO_DESTINO="${destino_local:-${BACKUP_DIR:-$(cd "$(dirname "$0")" && pwd)/backups}}"
mkdir -p "$DIRECTORIO_DESTINO"
[[ -w "$DIRECTORIO_DESTINO" ]] || fallar "no se puede escribir en $DIRECTORIO_DESTINO"

# ── Destino externo: se valida ANTES de volcar ────────────────────────
#
# Un pg_dump del piloto tarda minutos. Descubrir después de esos minutos que la
# ruta externa no existe deja al operador con un backup que creía replicado y
# sin tiempo para rehacerlo dentro de la ventana.

readonly DESTINO_EXTERNO="$destino_externo"
readonly EXIGIR_EXTERNO="$exigir_externo"
readonly PERMITIR_MISMO_FS="$permitir_mismo_fs"

if [[ -z "$DESTINO_EXTERNO" && "$EXIGIR_EXTERNO" == "si" ]]; then
    fallar "se exige copia externa pero no hay destino: pase --externo <ruta> o
       defina BACKUP_EXTERNO_DIR. La ruta debe estar FUERA de este servidor
       (otra máquina, un disco que no vive conectado o un bucket montado)."
fi

if [[ -n "$DESTINO_EXTERNO" ]]; then
    # No se hace mkdir -p a propósito: si el recurso remoto no está montado, el
    # punto de montaje es un directorio local vacío, y crearlo y escribir dentro
    # produciría una «copia externa» que en realidad vive en el mismo disco que
    # la base. Es justo el fallo que la copia externa existe para evitar.
    [[ -d "$DESTINO_EXTERNO" ]] \
        || fallar "el destino externo no existe o no es un directorio: $DESTINO_EXTERNO
       Compruebe que el recurso remoto está montado. Este script no lo crea:
       escribir dentro de un punto de montaje vacío dejaría la copia en el
       mismo disco que la base."
    [[ -w "$DESTINO_EXTERNO" ]] \
        || fallar "no se puede escribir en el destino externo: $DESTINO_EXTERNO"

    # Que el directorio exista no dice nada. El caso real es este: el recurso
    # remoto se desmontó y /mnt/respaldo-maxli volvió a ser lo que era debajo,
    # un directorio local vacío y escribible. La copia se hace, el script dice
    # que todo fue bien, y las dos copias viven en el disco que se va a perder.
    #
    # Compartir número de dispositivo con el dump local es la señal observable
    # de esa situación, y no requiere ninguna herramienta que no esté ya aquí.
    dispositivo_local="$(dispositivo_de "$DIRECTORIO_DESTINO")"
    dispositivo_externo="$(dispositivo_de "$DESTINO_EXTERNO")"

    if [[ -z "$dispositivo_local" || -z "$dispositivo_externo" ]]; then
        # Sin stat utilizable no se puede afirmar nada, y afirmar de más en la
        # dirección insegura es lo único que no vale: se avisa y se sigue.
        informar "AVISO: no se pudo determinar el sistema de archivos del destino externo."
        informar "AVISO: compruebe a mano que $DESTINO_EXTERNO está fuera de este servidor."
    elif [[ "$dispositivo_local" == "$dispositivo_externo" ]]; then
        if [[ "$PERMITIR_MISMO_FS" == "si" ]]; then
            informar "AVISO GRAVE: el destino externo comparte sistema de archivos con el dump local."
            informar "AVISO GRAVE: se continúa solo porque se pidió --permitir-mismo-filesystem."
            informar "AVISO GRAVE: esta copia NO protege del servidor perdido entero."
        else
            fallar "el destino externo está en el mismo sistema de archivos que el dump local:
         local:   $DIRECTORIO_DESTINO
         externo: $DESTINO_EXTERNO

       Casi siempre significa que el punto de montaje existe pero el recurso
       remoto no está montado. Compruébelo con 'mount | grep $DESTINO_EXTERNO'
       y vuelva a montarlo. Una copia en el mismo disco que la base no protege
       del caso que importa, que es el servidor perdido entero.

       Para un ensayo sobre un solo disco, pida la excepción por su nombre:
       --permitir-mismo-filesystem."
        fi
    fi
fi

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

# ── Copia externa ─────────────────────────────────────────────────────
#
# Solo después de que el dump local esté verificado y publicado: copiar un
# archivo que todavía no se sabe si sirve solo multiplica el archivo inútil.

if [[ -n "$DESTINO_EXTERNO" ]]; then
    readonly NOMBRE_DUMP="$(basename "$ARCHIVO_FINAL")"
    readonly EXTERNO_FINAL="$DESTINO_EXTERNO/$NOMBRE_DUMP"
    readonly EXTERNO_PARCIAL="${EXTERNO_FINAL}.parcial"

    [[ -e "$EXTERNO_FINAL" ]] \
        && fallar "ya existe $EXTERNO_FINAL; no se sobrescribe la copia externa."

    # Restos de una publicación anterior interrumpida. Como el dump es el último
    # archivo que se publica, encontrar un sidecar sin su dump significa que
    # aquella ejecución no llegó al final: se limpian y se sigue, sin obligar a
    # nadie a entrar a mano en el destino externo el día que el cron falle.
    #
    # Solo archivos regulares, y con rm -f, nunca rm -rf: lo que este script
    # deja a medias son archivos, así que cualquier otra cosa en esos nombres no
    # la puso él. Borrar un directorio a ciegas en un recurso externo compartido
    # es como se destruye algo que nadie había pedido destruir.
    for resto in "$EXTERNO_PARCIAL" "${EXTERNO_FINAL}.sha256"; do
        [[ -e "$resto" ]] || continue
        [[ -f "$resto" ]] \
            || fallar "en el destino externo hay algo que no es un archivo y ocupa un nombre
       que este backup necesita: $resto

       Este script solo deja archivos a medias, así que eso no lo puso él y no
       se toca. Revíselo y retírelo a mano antes de volver a respaldar.
       No se publica nada: un dump sin su checksum no se puede verificar."
        informar "Limpiando resto de una publicación interrumpida: $resto"
        rm -f "$resto"
    done

    # Igual que en el destino local: un fallo a mitad de copia no puede dejar
    # nada con pinta de backup bueno. El sidecar entra aquí porque se publica
    # antes que el dump, así que un fallo posterior debe llevárselo.
    limpiar_externo() {
        rm -f "$EXTERNO_PARCIAL" "${EXTERNO_FINAL}.sha256"
    }
    trap limpiar_externo EXIT

    informar "Copiando fuera del servidor: $EXTERNO_FINAL"
    cp "$ARCHIVO_FINAL" "$EXTERNO_PARCIAL" \
        || fallar "no se pudo copiar el dump a $DESTINO_EXTERNO. La copia externa es
       parte del respaldo, no un extra: se falla en lugar de dar por bueno un
       backup que solo existe en el disco que puede perderse."

    # Se relee el archivo YA ESCRITO en el destino. Comparar el checksum local
    # consigo mismo no probaría nada: lo que puede fallar es el trayecto —una
    # red que corta, un disco lleno, un montaje que se cae a mitad—.
    HASH_ORIGEN="$(hash_de "$ARCHIVO_FINAL")"
    HASH_DESTINO="$(hash_de "$EXTERNO_PARCIAL")"
    [[ "$HASH_ORIGEN" == "$HASH_DESTINO" ]] \
        || fallar "el checksum de la copia externa no coincide con el del dump local:
       llegó alterada o incompleta. No se publica en $DESTINO_EXTERNO."

    # Orden deliberado: primero el checksum, y el dump al final. Publicar el
    # dump primero abría una ventana en la que un fallo dejaba un .dump con
    # aspecto de respaldo bueno y sin forma de verificarlo — quien lo encontrara
    # meses después no tendría manera de saber que estaba a medias. Así el dump
    # es el marcador de «operación completa»: si está, su sidecar está.
    cp "${ARCHIVO_FINAL}.sha256" "${EXTERNO_FINAL}.sha256" \
        || fallar "no se pudo copiar el checksum a $DESTINO_EXTERNO. Un dump sin su
       .sha256 no se puede verificar el día que haya que restaurarlo, así que no
       se publica el dump."

    # Publicación atómica dentro del propio destino: el mv ocurre en el mismo
    # sistema de archivos que el .parcial, así que quien mire el directorio
    # externo ve el backup entero o no lo ve.
    mv "$EXTERNO_PARCIAL" "$EXTERNO_FINAL" \
        || fallar "no se pudo publicar el dump en $DESTINO_EXTERNO."
    trap - EXIT

    informar "Copia externa verificada: $EXTERNO_FINAL"
elif [[ "$EXIGIR_EXTERNO" == "si" ]]; then
    # Inalcanzable: la ausencia de destino con --exigir-externo se rechaza antes
    # de volcar. Se deja por si alguien reordena las secciones.
    fallar "se exige copia externa y no hay destino configurado."
else
    informar "AVISO: sin copia externa. Un backup en el mismo disco que la base no"
    informar "AVISO: protege del servidor perdido entero. Use --externo <ruta> o"
    informar "AVISO: copie el dump cifrado a mano (ver el runbook de operación §3)."
fi
