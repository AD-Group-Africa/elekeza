#!/usr/bin/env bash
# Elekeza — PostgreSQL backup wrapper.
#
# Usage:
#   scripts/db-backup.sh [--host H] [--port P] [--user U] [--db D] \
#                        [--out FILE] [--keep N]
#
# Produces a custom-format dump (-Fc) suitable for pg_restore, verifies the
# dump is readable via `pg_restore --list`, and prunes old backups beyond
# --keep (retention default: 7). Fails loudly on any error — a backup script
# that "succeeds" silently is worse than no backup.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="/c/Program Files/PostgreSQL/15/bin"

HOST="localhost"; PORT="5433"; USER="postgres"; DB="elekeza_prod"
OUT_DIR="$ROOT/backups"; OUT_FILE=""; KEEP=7

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --user) USER="$2"; shift 2;;
    --db)   DB="$2"; shift 2;;
    --out)  OUT_FILE="$2"; shift 2;;
    --keep) KEEP="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

: "${PGPASSWORD:?Set PGPASSWORD for the database user (e.g. PGPASSWORD=...)}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_FILE:-$OUT_DIR/${DB}-${STAMP}.dump}"
mkdir -p "$(dirname "$OUT_FILE")"

DUMP="$PG_BIN/pg_dump.exe"; RESTORE="$PG_BIN/pg_restore.exe"
[[ -x "$DUMP" ]] || DUMP="$(command -v pg_dump)"
[[ -x "$RESTORE" ]] || RESTORE="$(command -v pg_restore)"

echo "== backup: host=$HOST port=$PORT db=$DB -> $OUT_FILE"
PGPASSWORD="$PGPASSWORD" "$DUMP" \
  -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  -F c -b -v -f "$OUT_FILE" 2> "$OUT_FILE.pg_dump.log"

# A dump file that pg_restore cannot read is not a backup.
PGPASSWORD="$PGPASSWORD" "$RESTORE" --list "$OUT_FILE" > "$OUT_FILE.list" \
  || { echo "FATAL: pg_restore --list failed for $OUT_FILE" >&2; exit 1; }

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
TABLES="$(grep -c ' TABLE ' "$OUT_FILE.list" || true)"
echo "== verified: $OUT_FILE ($SIZE, $TABLES table definitions listed)"

# Retention: keep the newest N dumps, delete older ones.
if [[ "$KEEP" -gt 0 ]]; then
  ls -1t "$OUT_DIR"/"${DB}"-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old" "$old.list" "$old.pg_dump.log"
    echo "== pruned old backup: $old"
  done
fi
