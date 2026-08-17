#!/usr/bin/env bash
#
# Aplica el fixture del E2E sobre la base exclusiva `maxli_e2e`.
#
# Debe ejecutarse DESPUÉS de que el backend haya corrido las migraciones
# Flyway sobre esa base. Es idempotente: puede repetirse antes de cada
# ejecución de `npm run test:e2e`.
#
#   npm run e2e:fixture
#
# Conexión: PGHOST/PGPORT/PGUSER/PGPASSWORD estándar de libpq. La base es
# siempre `maxli_e2e` y no se puede sobrescribir por variable: la guarda
# vive además dentro del propio SQL (RAISE EXCEPTION), de modo que una
# ejecución manual contra `maxli_db` también aborta sin tocar nada.
set -euo pipefail

BASE_E2E="maxli_e2e"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="${RAIZ}/e2e/fixture-e2e.sql"

if ! command -v psql > /dev/null 2>&1; then
    echo "ERROR: hace falta el cliente psql para aplicar el fixture." >&2
    exit 1
fi

if [ ! -f "${FIXTURE}" ]; then
    echo "ERROR: no se encontró ${FIXTURE}" >&2
    exit 1
fi

echo "Aplicando el fixture E2E sobre la base '${BASE_E2E}'…"
psql --dbname "${BASE_E2E}" --set ON_ERROR_STOP=1 --quiet --file "${FIXTURE}"
echo "Fixture E2E aplicado."
