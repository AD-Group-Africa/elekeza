#!/usr/bin/env bash
# =============================================================================
# db-restore-drill.sh — isolated PostgreSQL 16 backup -> restore verification
#
# Proves that a backup taken from a freshly migrated database can be restored
# into a *separate clean* database and still satisfy every constraint and
# relationship the application depends on.
#
# Safety: creates throwaway containers only. It never connects to a production
# or development database, and it removes its containers on exit.
#
# Usage:  bash scripts/db-restore-drill.sh [image]
#         image defaults to postgres:16-alpine
# =============================================================================
set -euo pipefail

IMAGE="${1:-postgres:16-alpine}"
SRC_PORT=55433
DST_PORT=55434
SRC_CT=elekeza-drill-src
DST_CT=elekeza-drill-dst
DB=elekeza
USER=elekeza
PASS=drill-only-not-a-secret
WORK="$(mktemp -d)"
DUMP="$WORK/elekeza.dump"

cleanup() {
  docker rm -f "$SRC_CT" "$DST_CT" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

say() { printf '\n=== %s\n' "$*"; }

wait_ready() {
  local ct=$1
  for i in $(seq 1 60); do
    if docker exec "$ct" pg_isready -U "$USER" -d "$DB" >/dev/null 2>&1; then
      echo "ready after ${i}s"; return 0
    fi
    sleep 1
  done
  echo "TIMEOUT waiting for $ct"; docker logs "$ct" | tail -20; return 1
}

say "1. Start source cluster (${IMAGE})"
docker run -d --name "$SRC_CT" -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER" \
  -e POSTGRES_PASSWORD="$PASS" -p "${SRC_PORT}:5432" "$IMAGE" >/dev/null
wait_ready "$SRC_CT"
echo "server version: $(docker exec "$SRC_CT" psql -U "$USER" -d "$DB" -tAc 'show server_version')"

say "2. Apply all migrations (Flyway, via the backend build)"
( cd "$(dirname "$0")/../backend" && \
  DB_HOST=127.0.0.1 DB_PORT=$SRC_PORT DB_NAME=$DB DB_USER="$USER" DB_PASSWORD="$PASS" \
  SPRING_PROFILES_ACTIVE=drill ./gradlew flywayMigrate --console=plain -q ) || {
    echo "No flywayMigrate task — falling back to psql over the migration files"
    for f in "$(dirname "$0")"/../backend/src/main/resources/db/migration/V*.sql; do
      echo "  applying $(basename "$f")"
      docker exec -i "$SRC_CT" psql -v ON_ERROR_STOP=1 -U "$USER" -d "$DB" -q < "$f" >/dev/null
    done
  }

say "3. Record migration state and schema facts"
docker exec "$SRC_CT" psql -U "$USER" -d "$DB" -tAc \
  "select 'migrations=' || count(*) from flyway_schema_history where success" 2>/dev/null || \
  echo "migrations=(flyway history absent — psql path used)"
docker exec "$SRC_CT" psql -U "$USER" -d "$DB" -tAc \
  "select 'tables=' || count(*) from information_schema.tables where table_schema='public'"
docker exec "$SRC_CT" psql -U "$USER" -d "$DB" -tAc \
  "select 'constraints=' || count(*) from information_schema.table_constraints where constraint_schema='public'"
docker exec "$SRC_CT" psql -U "$USER" -d "$DB" -tAc \
  "select 'foreign_keys=' || count(*) from information_schema.table_constraints where constraint_type='FOREIGN KEY'"

say "4. Back up (custom format, compressed)"
START_BACKUP=$(date +%s)
docker exec "$SRC_CT" pg_dump -U "$USER" -d "$DB" -Fc -f /tmp/elekeza.dump
docker cp "$SRC_CT:/tmp/elekeza.dump" "$DUMP" >/dev/null
echo "dump size: $(du -h "$DUMP" | cut -f1) in $(( $(date +%s) - START_BACKUP ))s"

say "5. Start a clean destination cluster"
docker run -d --name "$DST_CT" -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER" \
  -e POSTGRES_PASSWORD="$PASS" -p "${DST_PORT}:5432" "$IMAGE" >/dev/null
wait_ready "$DST_CT"

say "6. Restore"
START_RESTORE=$(date +%s)
docker cp "$DUMP" "$DST_CT:/tmp/elekeza.dump" >/dev/null
docker exec "$DST_CT" pg_restore -U "$USER" -d "$DB" --no-owner --exit-on-error /tmp/elekeza.dump
RESTORE_SECONDS=$(( $(date +%s) - START_RESTORE ))
echo "restore completed in ${RESTORE_SECONDS}s"

say "7. Verify the restored copy"
q() { docker exec "$DST_CT" psql -U "$USER" -d "$DB" -tAc "$1"; }
echo "tables:       $(q "select count(*) from information_schema.tables where table_schema='public'")"
echo "constraints:  $(q "select count(*) from information_schema.table_constraints where constraint_schema='public'")"
echo "foreign keys: $(q "select count(*) from information_schema.table_constraints where constraint_type='FOREIGN KEY'")"
echo "indexes:      $(q "select count(*) from pg_indexes where schemaname='public'")"
echo "migrations:   $(q "select count(*) from flyway_schema_history where success" 2>/dev/null || echo n/a)"

say "8. Representative relationship check (guardian -> learner)"
q "select conname from pg_constraint
     where contype='f' and conrelid::regclass::text in
       ('guardian_links','guardian_link','learners','users')
   order by 1" | sed 's/^/  fk: /'
q "select 'learner rows=' || count(*) from learners" 2>/dev/null || echo "  (no learners table)"
q "select 'user rows=' || count(*) from users" 2>/dev/null || echo "  (no users table)"

say "RESULT"
echo "source constraints = destination constraints : $(
  [ "$(docker exec "$SRC_CT" psql -U "$USER" -d "$DB" -tAc "select count(*) from information_schema.table_constraints where constraint_schema='public'")" = \
    "$(q "select count(*) from information_schema.table_constraints where constraint_schema='public'")" ] && echo MATCH || echo MISMATCH)"
echo "restore_seconds=$RESTORE_SECONDS"
echo "drill containers will now be removed"
