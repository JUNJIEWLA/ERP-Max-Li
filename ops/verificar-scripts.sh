#!/usr/bin/env bash
#
# ISSUE-015 — Pruebas de los scripts de operación.
#
# Comprueba sintaxis y validación de entrada: que fallen cuando les falta una
# variable, un argumento o la confirmación, y que lo hagan *antes* de conectarse
# a ninguna base. No toca PostgreSQL; el ensayo real de backup→restore está en
# ops/ensayo-backup-restore.sh.
#
# Sin Bats ni dependencias: el piloto no tiene CI todavía (ISSUE-012) y no vale
# la pena instalar un framework para una decena de aserciones.
#
#   Uso:  ops/verificar-scripts.sh

set -Eeuo pipefail

readonly DIRECTORIO="$(cd "$(dirname "$0")" && pwd)"
readonly BACKUP="$DIRECTORIO/backup-postgres.sh"
readonly RESTORE="$DIRECTORIO/restore-postgres.sh"

correctas=0
fallidas=0

verde()  { printf '  \033[32mok\033[0m   %s\n' "$1"; }
rojo()   { printf '  \033[31mFALLA\033[0m %s\n' "$1"; }

# Ejecuta un caso que DEBE fallar, y comprueba que el motivo aparece en stderr.
debe_fallar_con() {
    local descripcion="$1" mensaje_esperado="$2"
    shift 2

    local salida estado=0
    salida="$("$@" 2>&1)" || estado=$?

    if [[ $estado -eq 0 ]]; then
        rojo "$descripcion — terminó con éxito y debía fallar"
        fallidas=$((fallidas + 1))
        return
    fi
    if [[ "$salida" != *"$mensaje_esperado"* ]]; then
        # Llaves obligatorias: pegado a «»  —multibyte— bash se come el cierre
        # dentro del nombre de la variable y aborta con «unbound variable».
        rojo "$descripcion — falló, pero sin explicar «${mensaje_esperado}»"
        printf '        salida: %s\n' "$salida"
        fallidas=$((fallidas + 1))
        return
    fi
    verde "$descripcion"
    correctas=$((correctas + 1))
}

comprobar() {
    local descripcion="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        verde "$descripcion"
        correctas=$((correctas + 1))
    else
        rojo "$descripcion"
        fallidas=$((fallidas + 1))
    fi
}

# ── Sintaxis ──────────────────────────────────────────────────────────

echo "Sintaxis"
for script in "$DIRECTORIO"/*.sh; do
    comprobar "bash -n $(basename "$script")" bash -n "$script"
done

# ── Contrato de entorno del backup ────────────────────────────────────
#
# Se invocan con `env -u` para quitar las variables reales del operador: lo que
# se prueba es que el script las exija, no que la máquina las tenga.

echo
echo "backup-postgres.sh — variables y contrato"

debe_fallar_con "sin DB_URL avisa qué falta" "DB_URL" \
    env -u DB_URL -u DB_USER -u DB_PASSWORD bash "$BACKUP"

debe_fallar_con "sin DB_USER avisa qué falta" "DB_USER" \
    env -u DB_USER -u DB_PASSWORD DB_URL="jdbc:postgresql://localhost:5432/x" bash "$BACKUP"

debe_fallar_con "sin DB_PASSWORD avisa qué falta" "DB_PASSWORD" \
    env -u DB_PASSWORD DB_URL="jdbc:postgresql://localhost:5432/x" DB_USER="u" bash "$BACKUP"

debe_fallar_con "rechaza una DB_URL que no es de PostgreSQL" "no parece una URL de PostgreSQL" \
    env DB_URL="jdbc:mysql://localhost:3306/x" DB_USER="u" DB_PASSWORD="p" bash "$BACKUP"

debe_fallar_con "rechaza una DB_URL sin nombre de base" "no incluye el nombre de la base" \
    env DB_URL="jdbc:postgresql://localhost:5432/" DB_USER="u" DB_PASSWORD="p" bash "$BACKUP"

# ── Contrato de argumentos del restore ────────────────────────────────

echo
echo "restore-postgres.sh — argumentos y confirmación"

readonly ENTORNO_VALIDO=(DB_URL="jdbc:postgresql://localhost:5432/inexistente"
                         DB_USER="u" DB_PASSWORD="p")

debe_fallar_con "sin argumentos muestra el uso" "Uso:" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE"

debe_fallar_con "exige --base explícita" "Uso:" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" --dump /tmp/x.dump

debe_fallar_con "exige confirmación" "Uso:" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" --dump /tmp/x.dump --base ensayo

debe_fallar_con "rechaza una confirmación que nombra otra base" "confirmación incorrecta" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump /tmp/x.dump --base ensayo --confirmar "RESTAURAR:produccion"

debe_fallar_con "rechaza una confirmación genérica" "confirmación incorrecta" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump /tmp/x.dump --base ensayo --confirmar "si"

debe_fallar_con "rechaza un nombre de base con caracteres peligrosos" "no válido" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump /tmp/x.dump --base 'ensayo"; DROP DATABASE maxli_db; --' \
        --confirmar 'RESTAURAR:ensayo"; DROP DATABASE maxli_db; --'

debe_fallar_con "rechaza un dump inexistente" "no existe el dump" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump /tmp/no-existe-este-dump.dump --base ensayo --confirmar "RESTAURAR:ensayo"

debe_fallar_con "rechaza un argumento desconocido" "no reconocido" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" --borrar-todo

# Un archivo que existe pero no es un dump: debe caer en la verificación y
# decirlo, sin haber abierto conexión con ninguna base. Lleva su .sha256 válido
# para que la prueba llegue hasta la comprobación de legibilidad y no se quede
# en la del checksum.
archivo_falso="$(mktemp)"
trap 'rm -f "$archivo_falso" "$archivo_falso.sha256"' EXIT
echo "esto no es un dump de PostgreSQL" > "$archivo_falso"
if command -v sha256sum >/dev/null 2>&1; then
    (cd "$(dirname "$archivo_falso")" && sha256sum "$(basename "$archivo_falso")" \
        > "$(basename "$archivo_falso").sha256")
else
    (cd "$(dirname "$archivo_falso")" && shasum -a 256 "$(basename "$archivo_falso")" \
        > "$(basename "$archivo_falso").sha256")
fi

debe_fallar_con "detecta un dump ilegible antes de tocar la base" "No se toca la base" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump "$archivo_falso" --base ensayo --confirmar "RESTAURAR:ensayo"

# ── Checksum: se falla cerrado ────────────────────────────────────────

echo
echo "restore-postgres.sh — integridad del dump"

archivo_sin_checksum="$(mktemp)"
trap 'rm -f "$archivo_falso" "$archivo_falso.sha256" "$archivo_sin_checksum"' EXIT
echo "tampoco es un dump, y encima sin checksum" > "$archivo_sin_checksum"

debe_fallar_con "sin .sha256 se niega a restaurar" "permitir-sin-checksum" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump "$archivo_sin_checksum" --base ensayo --confirmar "RESTAURAR:ensayo"

# Con el flag explícito ya no se queja del checksum: sigue adelante y cae en la
# comprobación siguiente, que es la que detecta que el archivo no es un dump.
debe_fallar_con "con --permitir-sin-checksum avanza y falla por otra razón" "No se toca la base" \
    env "${ENTORNO_VALIDO[@]}" bash "$RESTORE" \
        --dump "$archivo_sin_checksum" --base ensayo --confirmar "RESTAURAR:ensayo" \
        --permitir-sin-checksum

# ── Higiene: ningún script imprime la contraseña ──────────────────────

echo
echo "Higiene de secretos"

comprobar "backup no pasa la contraseña por argumentos" \
    bash -c "! grep -nE -- '--password[= ]|PGPASSWORD=\\\$' '$BACKUP'"
comprobar "restore no pasa la contraseña por argumentos" \
    bash -c "! grep -nE -- '--password[= ]|PGPASSWORD=\\\$' '$RESTORE'"
comprobar "backup no imprime DB_PASSWORD" \
    bash -c "! grep -nE 'echo.*DB_PASSWORD|informar.*DB_PASSWORD' '$BACKUP'"
comprobar "restore no imprime DB_PASSWORD" \
    bash -c "! grep -nE 'echo.*DB_PASSWORD|informar.*DB_PASSWORD' '$RESTORE'"

# ── Resumen ───────────────────────────────────────────────────────────

echo
echo "Resultado: $correctas correctas, $fallidas fallidas"
[[ $fallidas -eq 0 ]] || exit 1
