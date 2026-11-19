#!/usr/bin/env bash
# Elekeza — PostgreSQL restore + verification drill.
#
# Usage:
#   scripts/db-restore-drill.sh <backup.dump> [--target DB] [--host H] \
#        [--port P] [--user U] [--pg-bin DIR | --docker CONTAINER] \
#        [--keep-target] [--allow-any-target]
#
# Restores a custom-format dump into a DISPOSABLE database (never the live
# one), then verifies the restore — schema shape, Flyway history, row counts,
# foreign keys and indexes — and drops the drill database unless --keep-target
# is given. Exits non-zero on any failure.
#
# Client selection matches scripts/db-backup.sh: native clients are chosen from
# the server's major version, and --docker runs them inside the database
# container where the match is guaranteed.
#
# Safety: the target name must start with "elekeza_restore" unless
# --allow-any-target is passed, so a typo cannot drop a real database.
#
# Exit codes:
#   0  restore verified
#   2  bad usage / backup file missing or unreadable / unsafe target name
#   3  no PostgreSQL client compatible with the server's major version
#   4  cannot reach the server (no password is ever printed)
#   5  pg_restore failed
#   6  post-restore verification failed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/pg-client.sh
. "$ROOT/scripts/lib/pg-client.sh"

PG_BIN="/c/Program Files/PostgreSQL/15/bin"
HOST="localhost"; PORT="5433"; USER="postgres"
BACKUP=""; TARGET="elekeza_restore_drill"; KEEP_TARGET=0; PG_BIN_OPT=""; DOCKER=""
TARGET_GUARD=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2;;
    --port)   PORT="$2"; shift 2;;
    --host)   HOST="$2"; shift 2;;
    --user)   USER="$2"; shift 2;;
    --pg-bin) PG_BIN_OPT="$2"; shift 2;;
    --docker) DOCKER="$2"; shift 2;;
    --allow-any-target) TARGET_GUARD=0; shift;;
    --keep-target) KEEP_TARGET=1; shift;;
    -*)       echo "unknown arg: $1" >&2; exit 2;;
    *)        BACKUP="$1"; shift;;
  esac
done

[[ -f "$BACKUP" ]] || { echo "FATAL: backup file not found: $BACKUP" >&2; exit 2; }

if [[ "$TARGET_GUARD" == "1" && "$TARGET" != elekeza_restore* ]]; then
  echo "FATAL: refusing to use target '$TARGET' — drill targets must start with 'elekeza_restore'." >&2
  echo "       Pass --allow-any-target only if you are certain the database is disposable." >&2
  exit 2
fi

if [[ -n "$DOCKER" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "FATAL: --docker requires the docker CLI" >&2; exit 3; }
  docker inspect "$DOCKER" >/dev/null 2>&1 || { echo "FATAL: container '$DOCKER' not found" >&2; exit 3; }

  dexec() { docker exec -u "$USER" "$DOCKER" "$@"; }
  SERVER_NUM="$(dexec psql -U "$USER" -d postgres -tAc "select current_setting('server_version_num')" 2>/dev/null | tr -d ' \r\n' || true)"
  if [[ -z "$SERVER_NUM" ]] || [[ -n "$(printf '%s' "$SERVER_NUM" | tr -d 0-9)" ]]; then
    echo "FATAL: cannot query container '$DOCKER'." >&2
    exit 4
  fi
  SERVER_MAJOR="$((SERVER_NUM / 10000))"
  echo "== drill: $(basename "$BACKUP") -> $TARGET (container $DOCKER, PostgreSQL $SERVER_MAJOR)"
  echo "== client: $(dexec pg_restore --version)"

  restore_ok() {
    docker exec -i -u "$USER" "$DOCKER" pg_restore -U "$USER" -d "$TARGET" \
      --no-owner --no-privileges 2> "$BACKUP.restore.log"
  }
  q() { dexec psql -U "$USER" -d "$1" -tAc "$2"; }
  admin_sql() { dexec psql -U "$USER" -d postgres -c "$1"; }
  read_archive() { docker exec -i -u "$USER" "$DOCKER" pg_restore --list; }
else
  : "${PGPASSWORD:?Set PGPASSWORD for the database user}"

  if [[ -n "$PG_BIN_OPT" ]]; then PGC_EXPLICIT_DIR="$PG_BIN_OPT"; export PGC_EXPLICIT_DIR
  elif [[ -x "$PG_BIN/psql.exe" || -x "$PG_BIN/psql" ]]; then
    PGC_EXPLICIT_DIR="$PG_BIN"; export PGC_EXPLICIT_DIR
  fi

  # The maintenance connection goes to the "postgres" database so the target
  # can be created/dropped even when it does not exist yet.
  SERVER_NUM="$(pgc_server_version_num "$HOST" "$PORT" "$USER" postgres)"
  if [[ -z "$SERVER_NUM" ]]; then
    echo "FATAL: cannot connect to $HOST:$PORT (user=$USER)." >&2
    echo "       Check the server is running, the parameters are right and PGPASSWORD is set." >&2
    exit 4
  fi
  SERVER_MAJOR="$((SERVER_NUM / 10000))"

  PSQL="$(pgc_require_client psql "$SERVER_MAJOR" "$PG_BIN_OPT")" || exit 3
  RESTORE_BIN="$(pgc_require_client pg_restore "$SERVER_MAJOR" "$PG_BIN_OPT")" || exit 3
  echo "== drill: $(basename "$BACKUP") -> $TARGET on $HOST:$PORT (PostgreSQL $SERVER_MAJOR)"
  echo "== client: $("$RESTORE_BIN" --version)"

  restore_ok() {
    PGPASSWORD="$PGPASSWORD" "$RESTORE_BIN" -h "$HOST" -p "$PORT" -U "$USER" \
      -d "$TARGET" --no-owner --no-privileges 2> "$BACKUP.restore.log"
  }
  q() { PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" -d "$1" -tAc "$2"; }
  admin_sql() { PGPASSWORD="$PGPASSWORD" "$PSQL" -h "$HOST" -p "$PORT" -U "$USER" -d postgres -c "$1"; }
  read_archive() { PGPASSWORD="$PGPASSWORD" "$RESTORE_BIN" --list; }
fi

# The archive must be readable before we drop/create anything.
if ! read_archive < "$BACKUP" > /dev/null 2>&1; then
  echo "FATAL: '$BACKUP' is not a readable custom-format archive (try: pg_restore --list)" >&2
  exit 2
fi

echo "== creating disposable target"
admin_sql "DROP DATABASE IF EXISTS \"$TARGET\";" >/dev/null
admin_sql "CREATE DATABASE \"$TARGET\";" >/dev/null

restore_failed() {
  echo "FATAL: pg_restore failed — see $BACKUP.restore.log" >&2
  admin_sql "DROP DATABASE IF EXISTS \"$TARGET\";" >/dev/null 2>&1 || true
  exit 5
}

if ! restore_ok < "$BACKUP"; then
  restore_failed
fi
# pg_restore can exit 0 while reporting errors (e.g. a missing role).
if grep -qE "^(pg_restore: )?error:" "$BACKUP.restore.log" 2>/dev/null; then
  restore_failed
fi

echo "== verifying restored schema and data"
TABLES="$(q "$TARGET" "select count(*) from information_schema.tables where table_schema='public';")"
COLS="$(q "$TARGET" "select count(*) from information_schema.columns where table_schema='public';")"
INDEXES="$(q "$TARGET" "select count(*) from pg_indexes where schemaname='public';")"
FKS="$(q "$TARGET" "select count(*) from pg_constraint where contype='f';")"

MIGRATIONS="$(q "$TARGET" "select count(*) from flyway_schema_history where success=true;")"
FAILED_MIGRATIONS="$(q "$TARGET" "select count(*) from flyway_schema_history where success=false;")"
MAX_VERSION="$(q "$TARGET" "select coalesce(max(version::int),0) from flyway_schema_history where version is not null;")"

[[ "${TABLES:-0}" -ge 1 ]]             || { echo "FATAL: no tables restored" >&2; exit 6; }
[[ "${MIGRATIONS:-0}" -ge 1 ]]         || { echo "FATAL: flyway history empty after restore" >&2; exit 6; }
[[ "${FAILED_MIGRATIONS:-1}" -eq 0 ]]  || { echo "FATAL: restored history contains failed migrations" >&2; exit 6; }

echo "   tables=$TABLES columns=$COLS indexes=$INDEXES foreign_keys=$FKS"
echo "   flyway: $MIGRATIONS successful migrations, max version v$MAX_VERSION, $FAILED_MIGRATIONS failed"

# Row counts for the core tables, when present.
for t in institutions users learners lessons deadlines; do
  exists="$(q "$TARGET" "select count(*) from information_schema.tables where table_schema='public' and table_name='$t';")"
  if [[ "$exists" == "1" ]]; then
    printf '   %-14s rows=%s\n' "$t" "$(q "$TARGET" "select count(*) from $t;")"
  fi
done

if [[ "$KEEP_TARGET" == "1" ]]; then
  echo "== drill PASSED: $TARGET kept for inspection"
else
  admin_sql "DROP DATABASE IF EXISTS \"$TARGET\";" >/dev/null
  echo "== drill PASSED: restored database verified and dropped"
fi
