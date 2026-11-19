#!/usr/bin/env bash
# Elekeza — PostgreSQL backup wrapper.
#
# Usage:
#   scripts/db-backup.sh [--host H] [--port P] [--user U] [--db D] \
#                        [--out FILE] [--keep N] [--pg-bin DIR | --docker CONTAINER]
#
# Produces a custom-format dump (-Fc) suitable for pg_restore, verifies the
# dump is readable via `pg_restore --list`, and prunes old backups beyond
# --keep (retention default: 7). Fails loudly on any error — a backup script
# that "succeeds" silently is worse than no backup.
#
# Client selection: PostgreSQL's pg_dump refuses a server with a newer major
# version, so the client is discovered from the SERVER's major version rather
# than hard-coded (see scripts/lib/pg-client.sh). Two modes:
#
#   native (default)  Discover pg_dump/pg_restore on this host whose major
#                     version is >= the server's. Fail with exit 3 if none.
#   --docker NAME     Run psql/pg_dump/pg_restore inside the database container
#                     with `docker exec`, so the client always matches the
#                     server by construction. This is the correct mode for the
#                     docker-compose deployment (postgres:16-alpine) and for any
#                     host without a matching client installed.
#
# The deployment target is PostgreSQL 16 (docker-compose.yml) while local
# development runs 15; both work without editing this script.
#
# Exit codes:
#   0  backup created and verified
#   2  bad usage
#   3  no PostgreSQL client compatible with the server's major version
#   4  cannot reach the server / authenticate (no password is ever printed)
#   5  pg_dump failed or produced an empty file
#   6  the dump could not be read back by pg_restore (not a usable backup)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/pg-client.sh
. "$ROOT/scripts/lib/pg-client.sh"

# Preserved default; used only when it satisfies the server's major version.
PG_BIN="/c/Program Files/PostgreSQL/15/bin"

HOST="localhost"; PORT="5433"; USER="postgres"; DB="elekeza_prod"
OUT_DIR="$ROOT/backups"; OUT_FILE=""; KEEP=7; PG_BIN_OPT=""; DOCKER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --user) USER="$2"; shift 2;;
    --db)   DB="$2"; shift 2;;
    --out)  OUT_FILE="$2"; shift 2;;
    --keep) KEEP="$2"; shift 2;;
    --pg-bin) PG_BIN_OPT="$2"; shift 2;;
    --docker) DOCKER="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

if [[ -n "$DOCKER" ]]; then
  # Inside the container the client is the server's own binary: no discovery,
  # no password (docker exec connects over the container's local socket).
  command -v docker >/dev/null 2>&1 || { echo "FATAL: --docker requires the docker CLI" >&2; exit 3; }
  docker inspect "$DOCKER" >/dev/null 2>&1 || { echo "FATAL: container '$DOCKER' not found" >&2; exit 3; }

  dexec() { docker exec -u "$USER" "$DOCKER" "$@"; }
  echo "== backup: container=$DOCKER db=$DB user=$USER"

  SERVER_NUM="$(dexec psql -U "$USER" -d "$DB" -tAc "select current_setting('server_version_num')" 2>/dev/null | tr -d ' \r\n' || true)"
  if [[ -z "$SERVER_NUM" ]] || [[ -n "$(printf '%s' "$SERVER_NUM" | tr -d 0-9)" ]]; then
    echo "FATAL: cannot query container '$DOCKER' (db=$DB user=$USER)." >&2
    exit 4
  fi
  SERVER_MAJOR="$((SERVER_NUM / 10000))"
  echo "== server: PostgreSQL major $SERVER_MAJOR (server_version_num=$SERVER_NUM)"
  echo "== client: $(dexec pg_dump --version)"
  DUMP_TO() { dexec pg_dump -U "$USER" -d "$DB" -F c -b "$@"; }
  VERIFY_DUMP() { docker exec -i -u "$USER" "$DOCKER" pg_restore --list; }
else
  : "${PGPASSWORD:?Set PGPASSWORD for the database user (e.g. PGPASSWORD=...)}"

  # Explicit client directory wins, but is still version-checked below.
  if [[ -n "$PG_BIN_OPT" ]]; then PGC_EXPLICIT_DIR="$PG_BIN_OPT"; export PGC_EXPLICIT_DIR
  elif [[ -x "$PG_BIN/pg_dump.exe" || -x "$PG_BIN/pg_dump" ]]; then
    PGC_EXPLICIT_DIR="$PG_BIN"; export PGC_EXPLICIT_DIR
  fi

  echo "== backup: host=$HOST port=$PORT db=$DB"

  SERVER_NUM="$(pgc_server_version_num "$HOST" "$PORT" "$USER" "$DB")"
  if [[ -z "$SERVER_NUM" ]]; then
    echo "FATAL: cannot connect to $HOST:$PORT (db=$DB user=$USER)." >&2
    echo "       Check the server is running, the parameters are right and PGPASSWORD is set." >&2
    exit 4
  fi
  SERVER_MAJOR="$((SERVER_NUM / 10000))"
  echo "== server: PostgreSQL major $SERVER_MAJOR (server_version_num=$SERVER_NUM)"

  DUMP_BIN="$(pgc_require_client pg_dump "$SERVER_MAJOR" "$PG_BIN_OPT")" || exit 3
  RESTORE_BIN="$(pgc_require_client pg_restore "$SERVER_MAJOR" "$PG_BIN_OPT")" || exit 3
  echo "== client: $("$DUMP_BIN" --version)"

  DUMP_TO() { PGPASSWORD="$PGPASSWORD" "$DUMP_BIN" -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -F c -b "$@"; }
  # pg_restore reads stdin when given no file argument; "-" is treated as a
  # literal filename by these Windows builds.
  VERIFY_DUMP() { PGPASSWORD="$PGPASSWORD" "$RESTORE_BIN" --list; }
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_FILE:-$OUT_DIR/${DB}-${STAMP}.dump}"
mkdir -p "$(dirname "$OUT_FILE")"
PARTIAL="$OUT_FILE.partial"

# An interrupted run must not leave something that looks like a backup.
cleanup_partial() {
  local rc=$?
  if [[ -f "$PARTIAL" ]]; then rm -f "$PARTIAL"; echo "== discarded partial dump (exit $rc)" >&2; fi
  exit "$rc"
}
trap cleanup_partial EXIT INT TERM

echo "== writing: $OUT_FILE"
if ! DUMP_TO -v 2> "$OUT_FILE.pg_dump.log" > "$PARTIAL"; then
  echo "FATAL: pg_dump failed — see $OUT_FILE.pg_dump.log" >&2
  exit 5
fi

if [[ ! -s "$PARTIAL" ]]; then
  echo "FATAL: pg_dump produced an empty file ($PARTIAL)" >&2
  exit 5
fi

# A dump file that pg_restore cannot read is not a backup.
if ! VERIFY_DUMP < "$PARTIAL" > "$OUT_FILE.list" 2> "$OUT_FILE.pg_restore.log"; then
  echo "FATAL: pg_restore --list rejected the dump (see $OUT_FILE.pg_restore.log)" >&2
  exit 6
fi

TABLES="$(grep -c ' TABLE ' "$OUT_FILE.list" || true)"
if [[ "${TABLES:-0}" -lt 1 ]]; then
  echo "FATAL: dump lists no tables — refusing to call this a backup" >&2
  exit 6
fi

mv "$PARTIAL" "$OUT_FILE"
SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "== verified: $OUT_FILE ($SIZE, $TABLES table definitions listed)"

# Retention: keep the newest N dumps of this database, delete older ones.
if [[ "$KEEP" -gt 0 ]]; then
  RET_DIR="$(cd "$(dirname "$OUT_FILE")" && pwd)"
  # `|| true` keeps pipefail from turning "no matching files" into a failure
  # after the backup itself succeeded.
  { ls -1t "$RET_DIR"/"${DB}"-*.dump 2>/dev/null || true; } | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old" "$old.list" "$old.pg_dump.log" "$old.pg_restore.log"
    echo "== pruned old backup: $old"
  done
fi

trap - EXIT INT TERM
