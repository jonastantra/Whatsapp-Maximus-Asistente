#!/usr/bin/env bash
# scripts/respaldo.sh
# Copia la base a data/respaldos/ y conserva los ultimos 14 dias.
#
# Uso manual:   bash scripts/respaldo.sh
# Cron diario:  0 3 * * *  bash /app/scripts/respaldo.sh

set -euo pipefail

DB="${DB_PATH:-./data/messages.db}"
DESTINO="$(dirname "$DB")/respaldos"
FECHA="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$DESTINO"

if [ ! -f "$DB" ]; then
  echo "No encontre la base en $DB"
  exit 1
fi

# .backup de sqlite3 copia en caliente sin corromper el archivo aunque el bot
# este escribiendo. Copiar con cp mientras hay escrituras si puede corromperlo.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$DESTINO/messages-$FECHA.db'"
else
  echo "sqlite3 no esta instalado, uso cp (menos seguro con el bot corriendo)"
  cp "$DB" "$DESTINO/messages-$FECHA.db"
fi

gzip -f "$DESTINO/messages-$FECHA.db"

# Borrar respaldos de mas de 14 dias
find "$DESTINO" -name 'messages-*.db.gz' -mtime +14 -delete

echo "Respaldo listo: $DESTINO/messages-$FECHA.db.gz"
ls -1t "$DESTINO" | head -5
