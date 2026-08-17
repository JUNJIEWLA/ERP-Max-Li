#!/usr/bin/env bash
#
# Gate de salida a piloto — MaxLi Manager.
#
# Un solo comando que responde a una sola pregunta: ¿este entorno puede recibir
# operación real? Termina con 0 únicamente cuando todo lo comprobable está en
# su sitio, y con 1 y un motivo accionable cuando no.
#
#   Uso:  ops/verificar-prepiloto.sh [opciones]
#
# NO MUTA NADA. Solo lee: ni ventas, ni devoluciones, ni secuencias de NCF, ni
# una fila de más en ninguna tabla. Se puede correr contra el piloto en marcha.
#
# Tampoco sustituye al checklist: hay verificaciones —el hardware, la red de la
# tienda, la identidad fiscal de la empresa— que ningún script puede hacer desde
# aquí. Se listan al final de la salida y viven en
# docs/CHECKLIST_SALIDA_PILOTO.md.
#
# Recorre todas las comprobaciones aunque una falle: el operador necesita la
# lista entera de lo que hay que arreglar, no la primera piedra del camino.

set -Eeuo pipefail
umask 077

readonly NOMBRE_SCRIPT="$(basename "$0")"
readonly DIRECTORIO_OPS="$(cd "$(dirname "$0")" && pwd)"
readonly RAIZ="$(cd "$DIRECTORIO_OPS/.." && pwd)"

# ── Presentación ──────────────────────────────────────────────────────

fallos=0
avisos=0
# Excepciones pedidas explícitamente que relajan una comprobación. No bloquean,
# pero salen en el veredicto: un «ENTORNO LISTO» que esconde una excepción es
# justo el verde silencioso que este gate existe para no dar.
excepciones=0

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
mal()  { printf '  \033[31mFALLA\033[0m %s\n' "$1"; fallos=$((fallos + 1)); }
nota() { printf '  \033[33maviso\033[0m %s\n' "$1"; avisos=$((avisos + 1)); }
sin()  { printf '  \033[33m—\033[0m     %s\n' "$1"; }

detalle() { printf '        %s\n' "$1"; }

seccion() { echo; echo "── $* ─────────────────────────────────────────"; }

abortar() {
    echo "[$NOMBRE_SCRIPT] ERROR: $*" >&2
    exit 2
}

uso() {
    cat >&2 <<AYUDA
Uso: $NOMBRE_SCRIPT [opciones]

  --url-base <url>      Dónde alcanzar la aplicación. Por omisión
                        \$MAXLI_URL_BASE o http://127.0.0.1:8080.
  --backup-dir <ruta>   Directorio de los backups locales (\$BACKUP_DIR,
                        por omisión ops/backups).
  --backup-externo <r>  Directorio de la copia fuera del servidor
                        (\$BACKUP_EXTERNO_DIR). Obligatorio.
  --max-horas <n>       Antigüedad máxima admitida del último backup.
                        Por omisión \$BACKUP_MAX_HORAS o 24.
  --migraciones <ruta>  Directorio de las migraciones Flyway del repositorio
                        (\$MIGRACIONES_DIR).

Variables del entorno de despliegue que se comprueban: SPRING_PROFILES_ACTIVE,
DB_URL, DB_USER, DB_PASSWORD, JWT_SECRET, CORS_ALLOWED_ORIGINS y los ajustes de
transporte y cookie (MAXLI_SECURITY_*).

Estados de salida: 0 listo, 1 no listo, 2 error de uso.
AYUDA
    exit 2
}

# ── Argumentos ────────────────────────────────────────────────────────

URL_BASE="${MAXLI_URL_BASE:-http://127.0.0.1:8080}"
BACKUP_DIRECTORIO="${BACKUP_DIR:-$DIRECTORIO_OPS/backups}"
BACKUP_EXTERNO="${BACKUP_EXTERNO_DIR:-}"
MAX_HORAS="${BACKUP_MAX_HORAS:-24}"
DIRECTORIO_MIGRACIONES="${MIGRACIONES_DIR:-$RAIZ/backend/src/main/resources/db/migration}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --url-base)        [[ $# -ge 2 ]] || abortar "--url-base necesita un valor";        URL_BASE="$2"; shift 2 ;;
        --backup-dir)      [[ $# -ge 2 ]] || abortar "--backup-dir necesita un valor";      BACKUP_DIRECTORIO="$2"; shift 2 ;;
        --backup-externo)  [[ $# -ge 2 ]] || abortar "--backup-externo necesita un valor";  BACKUP_EXTERNO="$2"; shift 2 ;;
        --max-horas)       [[ $# -ge 2 ]] || abortar "--max-horas necesita un valor";       MAX_HORAS="$2"; shift 2 ;;
        --migraciones)     [[ $# -ge 2 ]] || abortar "--migraciones necesita un valor";     DIRECTORIO_MIGRACIONES="$2"; shift 2 ;;
        -h|--help)         uso ;;
        *)                 abortar "argumento no reconocido: $1" ;;
    esac
done

[[ "$MAX_HORAS" =~ ^[0-9]+$ && "$MAX_HORAS" -gt 0 ]] \
    || abortar "--max-horas debe ser un entero positivo (recibido: '$MAX_HORAS')."

for herramienta in psql pg_restore curl; do
    command -v "$herramienta" >/dev/null 2>&1 \
        || abortar "falta '$herramienta'. Instale los clientes de PostgreSQL y curl."
done
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 \
    || abortar "falta 'sha256sum' o 'shasum' para verificar los checksums."

echo "Gate de salida a piloto — MaxLi Manager"
echo "Aplicación: $URL_BASE"

# ── Utilidades ────────────────────────────────────────────────────────

hash_de() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | cut -d' ' -f1
    else
        shasum -a 256 "$1" | cut -d' ' -f1
    fi
}

# `stat` no es el mismo en GNU y en BSD, y el piloto se opera desde las dos.
epoch_de() {
    stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null
}

dispositivo_de() {
    stat -c %d "$1" 2>/dev/null || stat -f %d "$1" 2>/dev/null
}

# Número de objetos restaurables del dump. Un checksum válido solo dice que el
# archivo llegó entero; puede haber llegado entero y no ser un respaldo. Leer el
# índice obliga a recorrer la cabecera y la tabla de contenidos, que es donde se
# nota un archivo truncado o que nunca fue un dump.
objetos_restaurables_de() {
    pg_restore --list "$1" 2>/dev/null | grep -cvE '^;|^[[:space:]]*$' || true
}

# Verifica un dump y su sidecar: que el .sha256 exista, que su contenido cuadre
# con el archivo y que el archivo sea restaurable. Escribe el motivo en
# MOTIVO_DUMP y devuelve 1 si algo falla.
MOTIVO_DUMP=""
verificar_dump() {
    local archivo="$1" etiqueta="$2"
    MOTIVO_DUMP=""

    if [[ ! -f "${archivo}.sha256" ]]; then
        MOTIVO_DUMP="no tiene checksum: falta ${archivo}.sha256"
        return 1
    fi
    # El sidecar puede existir y no decir nada: vacío tras un disco lleno, o
    # truncado a mitad de copia. Se compara su contenido, no su presencia.
    local esperado
    esperado="$(cut -d' ' -f1 < "${archivo}.sha256" | head -1)"
    if [[ ! "$esperado" =~ ^[0-9a-fA-F]{64}$ ]]; then
        MOTIVO_DUMP="el checksum de $etiqueta está vacío o no es un sha256: ${archivo}.sha256"
        return 1
    fi
    if [[ "$(hash_de "$archivo")" != "$esperado" ]]; then
        MOTIVO_DUMP="el checksum de $etiqueta no coincide: el archivo está alterado o incompleto"
        return 1
    fi
    if [[ "$(objetos_restaurables_de "$archivo")" -le 0 ]]; then
        MOTIVO_DUMP="$etiqueta no es un dump restaurable: no supera 'pg_restore --list'"
        return 1
    fi
    return 0
}

# ── 1. Perfil y variables del entorno ─────────────────────────────────
#
# La aplicación valida casi todo esto al arrancar (GuardaPerfilObligatorio y
# GuardaSeguridadProduccion). Aquí se comprueba ANTES del reinicio y sobre el
# entorno que se le va a entregar: descubrir un JWT_SECRET corto cuando el
# servicio ya no levanta es descubrirlo con la tienda parada.

seccion "1. Perfil y variables del despliegue"

perfil="${SPRING_PROFILES_ACTIVE:-}"
if [[ -z "$perfil" ]]; then
    mal "SPRING_PROFILES_ACTIVE no está definido."
    detalle "El arranque aborta sin perfil explícito. Debe valer exactamente 'prod'."
elif [[ "$perfil" != "prod" ]]; then
    mal "SPRING_PROFILES_ACTIVE es '$perfil' y para el piloto debe ser 'prod'."
    detalle "El perfil dev trae CORS a localhost, cookie sin Secure y sin exigir HTTPS."
else
    ok "Perfil explícito: prod"
fi

for variable in DB_URL DB_USER DB_PASSWORD; do
    if [[ -z "${!variable:-}" ]]; then
        mal "$variable no está definida."
    else
        ok "$variable definida"
    fi
done

secreto="${JWT_SECRET:-}"
if [[ -z "$secreto" ]]; then
    mal "JWT_SECRET no está definido."
    detalle "En prod no hay valor por defecto: la aplicación no arrancará."
elif [[ "${#secreto}" -lt 32 ]]; then
    # No se imprime el valor, solo su longitud.
    mal "JWT_SECRET tiene ${#secreto} caracteres y el mínimo son 32 (256 bits)."
elif [[ "$(printf '%s' "$secreto" | fold -w1 | sort -u | wc -l | tr -d ' ')" -lt 12 ]]; then
    mal "JWT_SECRET usa menos de 12 caracteres distintos: es adivinable pese a su longitud."
else
    ok "JWT_SECRET presente y con longitud y variedad suficientes"
fi

origenes="${CORS_ALLOWED_ORIGINS:-}"
if [[ -z "$origenes" ]]; then
    mal "CORS_ALLOWED_ORIGINS no está definido."
    detalle "Declare el origen del frontend, por ejemplo https://erp.plazamax.do"
else
    problema_cors=""
    IFS=',' read -ra lista_origenes <<< "$origenes"
    for origen in "${lista_origenes[@]}"; do
        origen="${origen//[[:space:]]/}"
        [[ -z "$origen" ]] && continue
        if [[ "$origen" == *"*"* ]]; then
            problema_cors="el origen '$origen' lleva un comodín; la sesión viaja en cookie y cada origen debe declararse completo"
            break
        fi
        if [[ "${origen:0:8}" != "https://" ]]; then
            problema_cors="el origen '$origen' no usa HTTPS; expondría la cookie de sesión en la red"
            break
        fi
    done
    if [[ -n "$problema_cors" ]]; then
        mal "CORS_ALLOWED_ORIGINS: $problema_cors."
    else
        ok "CORS_ALLOWED_ORIGINS: solo orígenes HTTPS explícitos"
    fi
fi

# En prod estos vienen en true desde application.yml. Solo pueden estar mal si
# alguien los apagó a mano en el EnvironmentFile — que es exactamente el error
# que nadie recuerda haber cometido.
https_exigido="${MAXLI_SECURITY_REQUIRE_HTTPS:-${MAXLI_SECURITY_REQUIREHTTPS:-true}}"
if [[ "$https_exigido" != "true" ]]; then
    mal "maxli.security.require-https está en '$https_exigido'."
    detalle "En producción no se atiende nada en texto plano: credenciales y cookie de sesión."
else
    ok "HTTPS exigido (require-https)"
fi

cookie_segura="${MAXLI_SECURITY_COOKIE_SECURE:-true}"
if [[ "$cookie_segura" != "true" ]]; then
    mal "La cookie de sesión no lleva la marca Secure (cookie.secure='$cookie_segura')."
    detalle "Sin ella, una sola petición en claro basta para capturar la sesión."
else
    ok "Cookie de sesión con marca Secure"
fi

same_site="${MAXLI_SECURITY_COOKIE_SAME_SITE:-${MAXLI_SECURITY_COOKIE_SAMESITE:-Lax}}"
case "$(printf '%s' "$same_site" | tr '[:upper:]' '[:lower:]')" in
    lax|strict) ok "Cookie SameSite=$same_site" ;;
    none)
        if [[ "$cookie_segura" == "true" ]]; then
            ok "Cookie SameSite=None con Secure"
        else
            mal "SameSite=None exige la marca Secure; sin ella el navegador descarta la cookie."
        fi ;;
    *)  mal "SameSite de la cookie no es válido ('$same_site'). Use Lax, Strict o None." ;;
esac

if [[ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]]; then
    nota "BOOTSTRAP_ADMIN_PASSWORD sigue en el entorno."
    detalle "Solo hace falta en la primera instalación. Retírela del EnvironmentFile"
    detalle "una vez que el administrador haya cambiado su contraseña."
fi

# ── 2. PostgreSQL ─────────────────────────────────────────────────────

seccion "2. PostgreSQL"

base_alcanzable="no"
URL_PSQL=""

if [[ -n "${DB_URL:-}" && -n "${DB_USER:-}" && -n "${DB_PASSWORD:-}" ]]; then
    URL_PSQL="${DB_URL#jdbc:}"
    if [[ "$URL_PSQL" != postgresql://* && "$URL_PSQL" != postgres://* ]]; then
        mal "DB_URL no parece una URL de PostgreSQL (se esperaba jdbc:postgresql://…)."
        URL_PSQL=""
    else
        # La contraseña viaja por el entorno del proceso hijo, nunca como
        # argumento: los argumentos son visibles en 'ps'.
        export PGPASSWORD="$DB_PASSWORD"
        if psql --dbname="$URL_PSQL" --username="$DB_USER" --no-password \
                --quiet --tuples-only --no-align --command="SELECT 1" >/dev/null 2>&1; then
            base_alcanzable="si"
            nombre_base="${URL_PSQL##*/}"
            ok "Conexión con PostgreSQL: base '${nombre_base%%\?*}'"
        else
            mal "No se puede conectar con PostgreSQL usando DB_URL, DB_USER y DB_PASSWORD."
            detalle "Compruebe que el servidor está arriba, que la base existe y que las"
            detalle "credenciales del EnvironmentFile son las de esta instalación."
        fi
    fi
else
    sin "PostgreSQL: no comprobado (faltan DB_URL, DB_USER o DB_PASSWORD)."
fi

consultar() {
    psql --dbname="$URL_PSQL" --username="$DB_USER" --no-password \
         --quiet --tuples-only --no-align --command="$1" 2>/dev/null
}

# ── 3. Migraciones ────────────────────────────────────────────────────

seccion "3. Migraciones Flyway"

if [[ "$base_alcanzable" != "si" ]]; then
    sin "Migraciones: no comprobadas (sin conexión con PostgreSQL)."
elif [[ ! -d "$DIRECTORIO_MIGRACIONES" ]]; then
    mal "No existe el directorio de migraciones: $DIRECTORIO_MIGRACIONES"
    detalle "Use --migraciones <ruta> o defina MIGRACIONES_DIR apuntando al"
    detalle "backend/src/main/resources/db/migration del código desplegado."
else
    mayor_repositorio="$(ls -1 "$DIRECTORIO_MIGRACIONES" 2>/dev/null \
        | sed -n 's/^V\([0-9][0-9]*\)__.*\.sql$/\1/p' | sort -n | tail -1)"

    if [[ -z "$mayor_repositorio" ]]; then
        mal "El directorio de migraciones no contiene ninguna V<n>__*.sql: $DIRECTORIO_MIGRACIONES"
    elif [[ "$(consultar "SELECT to_regclass('public.flyway_schema_history') IS NOT NULL")" != "t" ]]; then
        mal "La base no tiene flyway_schema_history: nunca se migró."
        detalle "Arranque la aplicación una vez contra esta base; Flyway creará el esquema."
    else
        fallidas="$(consultar "SELECT count(*) FROM flyway_schema_history WHERE NOT success")"
        mayor_aplicada="$(consultar "SELECT coalesce(max(version::numeric), 0)
                                       FROM flyway_schema_history
                                      WHERE success AND version IS NOT NULL")"

        if [[ "${fallidas:-0}" != "0" ]]; then
            mal "Hay $fallidas migración(es) fallida(s) en flyway_schema_history."
            detalle "Una migración a medias deja el esquema sin describir y Flyway se negará"
            detalle "a arrancar. Restaure el backup previo (runbook §4) en lugar de editar"
            detalle "el historial a mano."
        elif [[ "${mayor_aplicada%%.*}" -lt "$mayor_repositorio" ]]; then
            mal "Hay migraciones pendientes: la base está en V${mayor_aplicada%%.*} y el repositorio trae hasta V${mayor_repositorio}."
            detalle "Arranque la aplicación para que Flyway las aplique, y vuelva a pasar"
            detalle "este gate. No se sale a piloto con el esquema a medio migrar."
        elif [[ "${mayor_aplicada%%.*}" -gt "$mayor_repositorio" ]]; then
            mal "La base está por delante del código: V${mayor_aplicada%%.*} aplicada, V${mayor_repositorio} en el repositorio."
            detalle "El artefacto desplegado es más viejo que la base. Arranque con"
            detalle "ddl-auto: validate fallará o, peor, correrá contra un esquema que"
            detalle "esa versión no conoce."
        else
            ok "Esquema al día: V${mayor_repositorio} aplicada y sin migraciones fallidas"
        fi
    fi
fi

# ── 4. La aplicación y sus sondas ─────────────────────────────────────
#
# En prod la aplicación no atiende nada en texto plano, ni siquiera las sondas:
# se reenvía X-Forwarded-Proto como hace el reverse proxy, o toda consulta por
# HTTP interno recibiría un 302 y parecería caída.

seccion "4. Aplicación y sondas de salud"

codigo_http() {
    curl -o /dev/null -s -w '%{http_code}' \
         -H 'X-Forwarded-Proto: https' \
         --connect-timeout 5 --max-time 20 \
         "$1" 2>/dev/null || echo "000"
}

codigo_salud="$(codigo_http "$URL_BASE/actuator/health")"
aplicacion_alcanzable="no"

if [[ "$codigo_salud" == "000" ]]; then
    mal "La aplicación no es alcanzable en $URL_BASE"
    detalle "Compruebe que el servicio está arriba y que --url-base apunta a él"
    detalle "(por ejemplo http://127.0.0.1:8080 desde el propio servidor)."
else
    aplicacion_alcanzable="si"
    ok "Aplicación alcanzable en $URL_BASE (HTTP $codigo_salud en /actuator/health)"
fi

if [[ "$aplicacion_alcanzable" != "si" ]]; then
    sin "Sondas: no comprobadas (la aplicación no responde)."
    sin "Ruta protegida: no comprobada (la aplicación no responde)."
else
    codigo_liveness="$(codigo_http "$URL_BASE/actuator/health/liveness")"
    if [[ "$codigo_liveness" == "200" ]]; then
        ok "liveness responde 200"
    else
        mal "liveness responde $codigo_liveness y debe responder 200."
        detalle "El proceso no está sano: reiniciar el servicio es la acción correcta."
    fi

    codigo_readiness="$(codigo_http "$URL_BASE/actuator/health/readiness")"
    if [[ "$codigo_readiness" == "200" ]]; then
        ok "readiness responde 200"
    else
        mal "readiness responde $codigo_readiness y debe responder 200."
        detalle "readiness incluye PostgreSQL: la aplicación no puede atender tráfico."
        detalle "Revise la base antes que el proceso; reiniciar no arreglaría esto."
    fi

    # Una ruta cualquiera de las que exigen autoridad. Si un anónimo la lee, la
    # cadena de seguridad no está donde se cree que está, y ese fallo no se nota
    # operando: se nota cuando alguien lo aprovecha.
    codigo_protegida="$(codigo_http "$URL_BASE/api/productos")"
    case "$codigo_protegida" in
        401|403) ok "La API rechaza al anónimo (/api/productos → $codigo_protegida)" ;;
        200)
            mal "/api/productos respondió 200 a una petición anónima."
            detalle "La API está abierta. No se sale a piloto con esto." ;;
        30*)
            mal "/api/productos respondió $codigo_protegida (redirección) a un anónimo."
            detalle "Probablemente la exigencia de HTTPS: consulte por https:// o reenvíe"
            detalle "X-Forwarded-Proto: https como hace el proxy. No se pudo comprobar"
            detalle "si la ruta rechaza al anónimo." ;;
        404)
            mal "/api/productos respondió 404: --url-base no apunta a la API de MaxLi."
            detalle "No se pudo comprobar que la API rechace al anónimo." ;;
        *)
            mal "/api/productos respondió $codigo_protegida a un anónimo; se esperaba 401 o 403." ;;
    esac
fi

# ── 5. Configuración operativa mínima ─────────────────────────────────

seccion "5. Configuración operativa"

if [[ "$base_alcanzable" != "si" ]]; then
    sin "Configuración operativa: no comprobada (sin conexión con PostgreSQL)."
else
    almacenes="$(consultar "SELECT count(*) FROM almacen WHERE estado = 'ACTIVO'")"
    if [[ "${almacenes:-0}" -gt 0 ]]; then
        ok "Almacenes activos: $almacenes"
    else
        mal "No hay ningún almacén ACTIVO."
        detalle "Sin almacén no hay de dónde descontar existencia: la venta no puede cerrar."
    fi

    # La caja necesita almacén: V30 dejó la columna nullable a propósito y el
    # propio comentario de esa migración advierte que hay que asignarlo a mano
    # antes de poder vender. Una caja activa sin almacén abre turno y falla al
    # facturar, que es el peor momento para enterarse.
    cajas="$(consultar "SELECT count(*) FROM caja c
                          JOIN almacen a ON a.id_almacen = c.id_almacen
                         WHERE c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'")"
    cajas_sueltas="$(consultar "SELECT count(*) FROM caja
                                 WHERE estado = 'ACTIVO' AND id_almacen IS NULL")"
    if [[ "${cajas:-0}" -gt 0 ]]; then
        ok "Cajas activas con almacén activo asignado: $cajas"
    else
        mal "No hay ninguna caja ACTIVO asociada a un almacén ACTIVO."
        detalle "Asigne el almacén desde Administración > Cajas: una caja sin almacén"
        detalle "abre turno y falla al facturar."
    fi
    if [[ "${cajas_sueltas:-0}" -gt 0 ]]; then
        nota "Hay $cajas_sueltas caja(s) activa(s) sin almacén asignado."
    fi

    # El centinela 'LOCKED::' es el que deja V35 en el admin inicial: esa cuenta
    # existe pero no puede iniciar sesión, así que no cuenta como habilitada.
    usuarios="$(consultar "SELECT count(*) FROM usuario u
                            WHERE u.estado = 'ACTIVO'
                              AND u.password_hash NOT LIKE 'LOCKED::%'
                              AND EXISTS (SELECT 1 FROM usuario_rol ur
                                           WHERE ur.id_usuario = u.id_usuario)")"
    if [[ "${usuarios:-0}" -gt 0 ]]; then
        ok "Usuarios habilitados con rol asignado: $usuarios"
    else
        mal "No hay ningún usuario ACTIVO con credencial utilizable y rol asignado."
        detalle "El 'admin' que deja la migración V35 está bloqueado a propósito: arranque"
        detalle "una vez con BOOTSTRAP_ADMIN_PASSWORD y cree desde ahí las cuentas reales."
    fi

    # Un usuario activo con rol asignado no basta: cuatro cuentas de
    # AUXILIAR_INVENTARIO son cuatro cuentas que no pueden abrir caja, ni
    # cobrar, ni autorizar una devolución. Lo que decide si la tienda puede
    # operar es lo que la gente puede HACER.
    #
    # Los permisos efectivos son la unión de los heredados del rol y los
    # concedidos directamente (usuario_permiso), tal como los arma
    # AuthController al emitir la sesión. No hay revocación: son aditivos.
    contar_con_permiso() {
        consultar "SELECT count(DISTINCT u.id_usuario)
                     FROM usuario u
                    WHERE u.estado = 'ACTIVO'
                      AND u.password_hash NOT LIKE 'LOCKED::%'
                      AND EXISTS (
                          SELECT 1 FROM usuario_rol ur
                            JOIN rol_permiso rp ON rp.id_rol = ur.id_rol
                            JOIN permiso p ON p.id_permiso = rp.id_permiso
                           WHERE ur.id_usuario = u.id_usuario
                             AND p.nombre_clave = '$1'
                          UNION ALL
                          SELECT 1 FROM usuario_permiso up
                            JOIN permiso p ON p.id_permiso = up.id_permiso
                           WHERE up.id_usuario = u.id_usuario
                             AND p.nombre_clave = '$1')"
    }

    exigir_permiso() {
        local permiso="$1" para="$2" consecuencia="$3"
        local cuantos
        cuantos="$(contar_con_permiso "$permiso")"
        if [[ "${cuantos:-0}" -gt 0 ]]; then
            ok "$permiso: $cuantos usuario(s) habilitado(s) — $para"
        else
            mal "Ningún usuario habilitado tiene $permiso ($para)."
            detalle "$consecuencia"
            detalle "Asigne el permiso por rol o directamente al usuario; ambos valen."
        fi
    }

    exigir_permiso "CAJA_OPERAR" "abrir y cerrar turnos" \
        "Sin turno abierto no se puede vender: la tienda no llega ni a la primera venta."
    exigir_permiso "VENTA_CREAR" "cobrar en el POS" \
        "Nadie puede facturar. El piloto no tiene forma de operar."
    exigir_permiso "DEVOLUCION_CREAR" "emitir notas de crédito" \
        "La resolución B04 dada de alta no la podría usar nadie del turno."
    exigir_permiso "USUARIO_GESTIONAR" "administrar usuarios" \
        "No hay administrador operativo: nadie puede dar de alta ni bloquear cuentas."

    administradores="$(contar_con_permiso "NCF_GESTIONAR")"
    if [[ "${administradores:-0}" -eq 0 ]]; then
        mal "Ningún usuario habilitado tiene NCF_GESTIONAR (gestión fiscal)."
        detalle "Cuando la B02 se agote a mitad del piloto —y se agota— no habrá quien"
        detalle "registre y active la siguiente. Las ventas se detienen ahí."
    else
        ok "NCF_GESTIONAR: $administradores usuario(s) habilitado(s) — gestión fiscal"
    fi

    # Sin stock no hay nada que vender, por muy bien configurado que esté todo
    # lo demás. Es un no-go, no un detalle a recordar.
    con_stock="$(consultar "SELECT count(*) FROM existencia e
                              JOIN producto p ON p.id_producto = e.id_producto
                              JOIN almacen a ON a.id_almacen = e.id_almacen
                             WHERE e.cantidad_actual > 0
                               AND p.estado = 'ACTIVO' AND a.estado = 'ACTIVO'")"
    if [[ "${con_stock:-0}" -gt 0 ]]; then
        ok "Productos activos con stock en almacén activo: $con_stock"
    else
        mal "No hay ningún producto activo con stock en un almacén activo."
        detalle "No se puede vender nada. Cargue el catálogo y cuadre las existencias"
        detalle "contra un conteo físico antes de abrir."
    fi
fi

# ── 6. Resoluciones NCF ───────────────────────────────────────────────
#
# B02 factura al consumidor final y B04 emite la nota de crédito de una
# devolución. Sin B04 vigente, DevolucionService revierte la operación completa:
# el cliente se queda sin devolución y la tienda sin explicación.

seccion "6. Resoluciones NCF"

# Deja libres, no un booleano: el gate rechaza cuando no quedan números, y avisa
# cuando quedan tan pocos que se agotarán dentro del piloto.
readonly UMBRAL_AVISO_NCF="${NCF_MINIMO_DISPONIBLE:-100}"
readonly UMBRAL_AVISO_DIAS="${NCF_MINIMO_DIAS:-30}"

verificar_resolucion() {
    local tipo="$1" para="$2"

    local fila
    fila="$(consultar "SELECT (secuencia_final - secuencia_actual + 1)
                            || '|' || (fecha_vencimiento - CURRENT_DATE)
                              FROM resolucion_ncf
                             WHERE tipo_ncf = '$tipo' AND estado = 'ACTIVO'
                             LIMIT 1")"

    if [[ -z "$fila" ]]; then
        local total agotadas vencidas
        total="$(consultar "SELECT count(*) FROM resolucion_ncf WHERE tipo_ncf = '$tipo'")"
        agotadas="$(consultar "SELECT count(*) FROM resolucion_ncf
                                WHERE tipo_ncf = '$tipo' AND estado = 'AGOTADO'")"
        vencidas="$(consultar "SELECT count(*) FROM resolucion_ncf
                                WHERE tipo_ncf = '$tipo'
                                  AND fecha_vencimiento < CURRENT_DATE")"

        if [[ "${total:-0}" -eq 0 ]]; then
            mal "No hay ninguna resolución $tipo registrada ($para)."
            detalle "Registre en Fiscal > NCF la resolución que autorizó la DGII, con su"
            detalle "número, rango y fecha de vencimiento, y actívela."
        elif [[ "${agotadas:-0}" -gt 0 ]]; then
            mal "La resolución $tipo está AGOTADO: se consumieron todos sus números ($para)."
            detalle "Una resolución agotada no se reactiva. Registre y active la siguiente."
        elif [[ "${vencidas:-0}" -gt 0 ]]; then
            mal "La resolución $tipo está vencida y no hay ninguna ACTIVO ($para)."
            detalle "Registre y active la resolución vigente que autorizó la DGII."
        else
            mal "No hay ninguna resolución $tipo en estado ACTIVO ($para)."
            detalle "Existe registrada pero inactiva: actívela en Fiscal > NCF."
        fi
        return
    fi

    local disponibles="${fila%%|*}" dias="${fila##*|}"

    if [[ "$dias" -lt 0 ]]; then
        mal "La resolución $tipo activa está vencida (hace $(( -dias )) días) ($para)."
        detalle "NcfService rechaza emitir con una resolución vencida: la venta o la"
        detalle "devolución fallará en el mostrador."
        return
    fi
    if [[ "$disponibles" -le 0 ]]; then
        mal "La resolución $tipo activa no tiene números disponibles ($para)."
        return
    fi

    ok "$tipo vigente y con números: $disponibles disponibles, vence en $dias días"

    if [[ "$disponibles" -lt "$UMBRAL_AVISO_NCF" ]]; then
        nota "A la resolución $tipo le quedan solo $disponibles números."
    fi
    if [[ "$dias" -lt "$UMBRAL_AVISO_DIAS" ]]; then
        nota "La resolución $tipo vence en $dias días."
    fi
}

if [[ "$base_alcanzable" != "si" ]]; then
    sin "Resoluciones NCF: no comprobadas (sin conexión con PostgreSQL)."
else
    verificar_resolucion "B02" "factura de consumidor final"
    verificar_resolucion "B04" "nota de crédito de devoluciones"
fi

# ── 7. Backups ────────────────────────────────────────────────────────

seccion "7. Backups"

ultimo_dump=""

if [[ ! -d "$BACKUP_DIRECTORIO" ]]; then
    mal "No existe el directorio de backups: $BACKUP_DIRECTORIO"
    detalle "Use --backup-dir <ruta> o defina BACKUP_DIR. Sin backup no hay piloto:"
    detalle "un error de operación sin respaldo es pérdida de datos, no un susto."
else
    # El más reciente por fecha de modificación, no por nombre: un archivo
    # copiado a mano puede llevar el sello de otro día.
    reciente_epoch=0
    for candidato in "$BACKUP_DIRECTORIO"/*.dump; do
        [[ -f "$candidato" ]] || continue
        candidato_epoch="$(epoch_de "$candidato")"
        if [[ -n "$candidato_epoch" && "$candidato_epoch" -gt "$reciente_epoch" ]]; then
            reciente_epoch="$candidato_epoch"
            ultimo_dump="$candidato"
        fi
    done

    if [[ -z "$ultimo_dump" ]]; then
        mal "No hay ningún backup (*.dump) en $BACKUP_DIRECTORIO"
        detalle "Ejecute ops/backup-postgres.sh antes de abrir la tienda."
    else
        edad_horas=$(( ( $(date -u +%s) - reciente_epoch ) / 3600 ))
        if [[ "$edad_horas" -gt "$MAX_HORAS" ]]; then
            mal "El último backup tiene $edad_horas horas y el máximo admitido son $MAX_HORAS horas."
            detalle "Archivo: $(basename "$ultimo_dump")"
            detalle "Revise el cron diario y su log: un cron que falla en silencio es peor"
            detalle "que no tener backup, porque genera confianza sin respaldo detrás."
        else
            ok "Último backup: $(basename "$ultimo_dump") ($edad_horas h, máximo $MAX_HORAS h)"
        fi

        if verificar_dump "$ultimo_dump" "el backup local"; then
            ok "Backup local íntegro y restaurable ($(objetos_restaurables_de "$ultimo_dump") objetos)"
        else
            mal "El último backup $MOTIVO_DUMP."
            detalle "Archivo: $ultimo_dump"
            detalle "Un checksum válido solo dice que el archivo llegó entero: puede haber"
            detalle "llegado entero y no ser un respaldo. Ejecute ops/backup-postgres.sh de"
            detalle "nuevo y no abra la tienda hasta tener un dump que se deje leer."
        fi
    fi
fi

# ── 8. Copia externa ──────────────────────────────────────────────────

seccion "8. Copia fuera del servidor"

if [[ -z "$BACKUP_EXTERNO" ]]; then
    mal "No hay destino de copia externa: defina BACKUP_EXTERNO_DIR o pase --backup-externo."
    detalle "Un backup en el mismo disco que la base no protege del caso que importa,"
    detalle "que es el servidor perdido entero. La ruta debe residir FUERA de este"
    detalle "servidor: otra máquina, un disco que no vive conectado o un recurso montado."
elif [[ ! -d "$BACKUP_EXTERNO" ]]; then
    mal "El destino de la copia externa no existe o no es un directorio: $BACKUP_EXTERNO"
    detalle "Compruebe que el recurso remoto está montado."
else
    # Que el directorio exista no dice nada: un punto de montaje cuyo recurso
    # remoto se cayó sigue siendo un directorio escribible y vacío, y la copia
    # acaba en el mismo disco que la base. Se pierde el servidor y se pierden
    # las dos copias a la vez.
    referencia_local="${ultimo_dump:+$(dirname "$ultimo_dump")}"
    referencia_local="${referencia_local:-$BACKUP_DIRECTORIO}"
    dispositivo_local="$(dispositivo_de "$referencia_local")"
    dispositivo_externo="$(dispositivo_de "$BACKUP_EXTERNO")"

    if [[ -z "$dispositivo_local" || -z "$dispositivo_externo" ]]; then
        nota "No se pudo determinar el sistema de archivos del destino externo."
        detalle "Compruebe a mano que $BACKUP_EXTERNO está fuera de este servidor."
    elif [[ "$dispositivo_local" == "$dispositivo_externo" ]]; then
        if [[ "${BACKUP_EXTERNO_PERMITIR_MISMO_FILESYSTEM:-no}" == "si" ]]; then
            nota "El destino externo comparte sistema de archivos con los backups locales."
            detalle "Se acepta solo porque BACKUP_EXTERNO_PERMITIR_MISMO_FILESYSTEM=si."
            detalle "Esta copia NO protege del servidor perdido entero."
            excepciones=$((excepciones + 1))
        else
            mal "El destino externo está en el mismo sistema de archivos que los backups locales."
            detalle "  local:   $referencia_local"
            detalle "  externo: $BACKUP_EXTERNO"
            detalle "Casi siempre significa que el punto de montaje existe pero el recurso"
            detalle "remoto no está montado. Compruébelo con 'mount | grep $BACKUP_EXTERNO'."
        fi
    else
        ok "El destino externo está en otro sistema de archivos"
    fi

    if [[ -z "$ultimo_dump" ]]; then
        sin "Copia externa: no comprobada (no hay backup local que buscar allí)."
    else
        copia="$BACKUP_EXTERNO/$(basename "$ultimo_dump")"
        if [[ ! -f "$copia" ]]; then
            mal "El último backup no tiene copia externa: falta $(basename "$ultimo_dump") en $BACKUP_EXTERNO"
            detalle "Ejecute ops/backup-postgres.sh --externo '$BACKUP_EXTERNO' --exigir-externo"
        elif ! verificar_dump "$copia" "la copia externa"; then
            # Se verifica la copia por su cuenta —sidecar propio incluido—
            # porque es la que se restaurará el día que el servidor no esté, y
            # restore-postgres.sh comprobará ese mismo sidecar, no el local.
            mal "La copia externa $MOTIVO_DUMP."
            detalle "Archivo: $copia"
        elif [[ "$(hash_de "$copia")" != "$(hash_de "$ultimo_dump")" ]]; then
            mal "La copia externa es un archivo distinto del backup local que dice acompañar."
            detalle "  local:   $ultimo_dump"
            detalle "  externo: $copia"
            detalle "Ambos son dumps válidos, pero no el mismo: uno de los dos no es el que"
            detalle "cree tener. Vuelva a publicar la copia con ops/backup-postgres.sh."
        else
            ok "Copia externa presente, íntegra y restaurable: $copia"
        fi
    fi
fi

# ── Lo que este script no puede comprobar ─────────────────────────────

seccion "Fuera del alcance de este script"

cat <<'MANUAL'
  Estas verificaciones no se pueden hacer desde aquí y siguen siendo
  obligatorias. Van en docs/CHECKLIST_SALIDA_PILOTO.md:

  · Identidad fiscal de la empresa (RNC, razón social, dirección). El sistema
    no la almacena: hoy vive en la plantilla del comprobante y en la
    configuración del proveedor de impresión. Confírmela contra el registro
    de la DGII antes de emitir el primer NCF.
  · Ensayo de restauración en base desechable (ops/ensayo-backup-restore.sh).
  · Ensayo manual del ALTER DATABASE RENAME con la aplicación detenida.
  · Prueba con el navegador, la impresora, el lector de códigos y la red de la
    tienda: nada de eso responde a un curl desde el servidor.
  · Quality y E2E como required checks de la rama main en GitHub.
MANUAL

# ── Veredicto ─────────────────────────────────────────────────────────

seccion "Veredicto"

if [[ "$fallos" -eq 0 && "$excepciones" -gt 0 ]]; then
    # No es «listo» a secas: alguien pidió relajar una comprobación y el
    # veredicto tiene que decirlo con todas las letras, o la excepción se
    # convierte en el estado normal sin que nadie lo haya decidido.
    echo "  ENTORNO LISTO CON EXCEPCIONES — $excepciones excepción(es) y $avisos aviso(s)."
    echo
    echo "  Se relajó una comprobación a petición explícita. Esto NO vale como gate"
    echo "  de un piloto real: revise las excepciones antes de abrir la tienda."
    exit 0
fi

if [[ "$fallos" -eq 0 ]]; then
    echo "  ENTORNO LISTO — $avisos aviso(s)."
    echo
    echo "  Esto no autoriza el piloto por sí solo: acredita lo comprobable desde"
    echo "  este servidor. Complete docs/CHECKLIST_SALIDA_PILOTO.md antes de abrir."
    exit 0
fi

echo "  ENTORNO NO LISTO — $fallos fallo(s), $avisos aviso(s) y $excepciones excepción(es)."
echo
echo "  Corrija cada FALLA y vuelva a ejecutar este comando."
exit 1
