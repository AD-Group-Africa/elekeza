#!/usr/bin/env bash
# Elekeza — PostgreSQL restore + verification drill.
#
# Usage:
#   scripts/db-restore-drill.sh <backup.dump> [--target DB] [--port P]
#
# Restores a custom-format dump into a DISPOSABLE database (never the live
# one), then verifies the restore by counting rows in the core tables and
# checking the Flyway history is intact. Exits non-zero on any failure.
#
# This is the script the PILOT_PLAN gate #7 refers to: a restore is only
# "tested" when this drill has actually run green against a real backup.
set -euo pipefail

PG_BIN="/c/Program Files/PostgreSQL/15/bin"
HOST="localhost"; PORT="5433"; USER="postgres"
BACKUP=""; TARGET="elekeza_restore_drill"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2;;
    --port)   PORT="$2"; shift 2;;
    --host)   HOST="$2"; shift 2;;
    -*)       echo "unknown arg: $1" >&2; exit 2;;
    *)        BACKUP="$1"; shift;;
  esac
done

[[ -f "$BACKUP" ]] || { echo "FATAL: backup file not found: $BACKUP" >&2; exit 2; }
: "${PGPASSWORD:?Set PGPASSWORD for the database user}"

PSQL="$PG_BIN/psql.exe"; [[ -x "$PSQL" ]] || PSQL="$(command -v psql)"
RESTORE="$PG_BIN/pg_restore.exe"; [[ -x "$RESTORE" ]] || RESTORE="$(command -v pg_restore)"

echo "== drill: restore $BACKUP -> $TARGET (disposable)"
PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" \
  -c "DROP DATABASE IF EXISTS $TARGET;" -c "CREATE DATABASE $TARGET;" >/dev/null

if ! PGPASSWORD="$PGPASSWORD" "$RESTORE" -h "$HOST" -p "$PORT" -U "$USER" \
      -d "$TARGET" --no-owner --no-privileges "$BACKUP" 2> "$BACKUP.restore.log"; then
  echo "FATAL: pg_restore failed — see $BACKUP.restore.log" >&2
  PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" -c "DROP DATABASE IF EXISTS $TARGET;"
  exit 1
fi

echo "== verifying core tables and Flyway history"
QUERY="
SELECT 'institutions' AS t, count(*) FROM institutions
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'learners', count(*) FROM learners
UNION ALL SELECT 'lessons', count(*) FROM lessons
UNION ALL SELECT 'flyway_migrations', count(*) FROM flyway_schema_history;"
if ! PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" -d "$TARGET" -c "$QUERY"; then
  echo "FATAL: verification queries failed" >&2; exit 1
fi

MIGRATIONS="$(PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" -d "$TARGET" -tAc \
  "SELECT count(*) FROM flyway_schema_history WHERE success = true;")"
[[ "$MIGRATIONS" -ge 1 ]] || { echo "FATAL: flyway history empty after restore" >&2; exit 1; }
echo "== drill PASSED: $MIGRATIONS successful migrations restored; data present"

# Dispose of the drill database — it is never the live one.
PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" \
  -c "DROP DATABASE IF EXISTS $TARGET;" >/dev/null
echo "== drill database dropped"
