#!/usr/bin/env bash
# ============================================================================
# Elekeza — one-command local staging gate (Windows Git Bash host)
#
# Deploys the REAL production artifact path end-to-end on this machine:
#   1. `next build` production frontend (NEXT_PUBLIC_API_URL baked in)
#   2. fresh, gate-owned PostgreSQL database (Flyway migrations + Hibernate
#      validate — prod profile)
#   3. backend boot JAR on the prod profile (fail-fast env contract)
#   4. version-aware Flyway/schema verification (no hard-coded migration count)
#   5. `next start` serving the production frontend
#   6. authenticated smoke: the app registers its own synthetic identity through
#      the public API, signs in, and reads protected endpoints through the
#      production origin. NO demo seed, NO committed credentials.
#   7. teardown: stop servers by the port they own, drop the gate database
#      (use --keep-db to inspect)
#
# Usage:  bash scripts/staging-gate.sh [--keep-db]
# Requires: PostgreSQL 15 running on :5433 (user postgres/postgres — local gate only)
#
# ─── Why this no longer seeds the demo dataset ──────────────────────────────
# The gate used to boot with DEMO_SEED_ENABLED=true so the smoke test had
# `student@elekeza.app` to log in with. Wave 0's DemoSeedGuard now (correctly)
# refuses demo seeding on any profile except dev/test, because the demo dataset
# contains an ADMIN and a SCHOOL_ADMIN whose passwords are committed to the
# repository. Rather than widening that allowlist — a security regression — the
# gate provisions its own throwaway identity through `POST /api/auth/register`,
# which always creates a STUDENT and never an administrator.
# See docs/audit/ELEKEZA_STAGING_GATE_REPAIR.md.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
MIGRATION_DIR="$BACKEND/src/main/resources/db/migration"

# Connection settings are overridable so the same gate can target another
# server (for example an isolated PostgreSQL 16 container on 127.0.0.1:5434)
# without forking the procedure. The defaults are the documented local target.
PSQL="${GATE_PSQL:-/c/Program Files/PostgreSQL/15/bin/psql.exe}"
PGHOST="${GATE_PGHOST:-localhost}"
PGPORT="${GATE_PGPORT:-5433}"
PGUSER="${GATE_PGUSER:-postgres}"
PGPASSWORD_VALUE="${GATE_PGPASSWORD:-postgres}"
GATE_DB="elekeza_staging_gate"
GATE_SCHEMA="gate_meta"          # ownership marker lives outside `public`
GATE_MARKER="$GATE_SCHEMA.ownership"
GATE_DB_CREATED=false

BE_PORT=8096
FE_PORT=3105
BE_LOG="$(mktemp -t elekeza-staging-be.XXXX.log)"
FE_LOG="$(mktemp -t elekeza-staging-fe.XXXX.log)"
KEEP_DB=false
[[ "${1:-}" == "--keep-db" ]] && KEEP_DB=true

export PGPASSWORD="$PGPASSWORD_VALUE"

log()  { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
fail() {
  printf '\n\033[1;31m== GATE FAILED: %s\033[0m\n' "$*"
  if grep -qaE "ERROR|Caused by|APPLICATION FAILED" "$BE_LOG" 2>/dev/null; then
    echo "── first error from the backend log ──"
    grep -aE -m1 -A 6 "Caused by|APPLICATION FAILED|ERROR" "$BE_LOG" || true
  fi
  echo "── backend log: $BE_LOG"
  echo "── frontend log: $FE_LOG"
  exit 1
}
# Strip only line endings: values such as `character varying` contain
# meaningful spaces that a blanket `tr -d ' '` would silently mangle.
psql_admin() { "$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "$1" | tr -d '\r\n'; }
psql_gate()  { "$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$GATE_DB" -tAc "$1" | tr -d '\r\n'; }

port_free() { ! netstat -ano | grep -qE "TCP +[^ ]*:$1 +[^ ]* +LISTENING"; }
# Kill whatever owns the port. Only ever called for ports verified free before
# startup, so the listener is necessarily the process this run created.
kill_port() {
  local port=$1 pid
  pid=$(netstat -ano | grep -E "TCP +[^ ]*:$port +[^ ]* +LISTENING" | awk '{print $NF}' | head -1)
  if [[ -n "${pid:-}" ]]; then
    taskkill.exe //PID "$pid" //F //T >/dev/null 2>&1 || true
    for _ in $(seq 1 15); do port_free "$port" && return 0; sleep 1; done
    echo "warning: port $port still listening after kill attempt (pid $pid)" >&2
  fi
}

cleanup() {
  # A trap must always run to completion: without this, `set -e` aborts the
  # handler at the first failing command and leaves servers or a database
  # behind with no diagnostic (observed once before this line existed).
  set +e
  log "Teardown"
  kill_port "$BE_PORT"
  kill_port "$FE_PORT"
  if [[ "$GATE_DB_CREATED" == true && "$KEEP_DB" == false ]]; then
    # The gate owns this database (marker verified before creation) and the
    # servers above are stopped, so plain DROP should succeed. FORCE is the
    # fallback for a connection that has not finished closing.
    local out
    sleep 2
    if out=$(psql_admin "DROP DATABASE IF EXISTS $GATE_DB" 2>&1); then
      echo "gate database dropped"
    elif out=$(psql_admin "DROP DATABASE IF EXISTS $GATE_DB WITH (FORCE)" 2>&1); then
      echo "gate database dropped (FORCE: a stale connection was terminated)"
    else
      echo "warning: could not drop $GATE_DB: $out" >&2
    fi
  elif [[ "$KEEP_DB" == true && "$GATE_DB_CREATED" == true ]]; then
    echo "gate database $GATE_DB kept (--keep-db)"
  else
    echo "gate database was never created by this run; nothing dropped"
  fi
}
trap cleanup EXIT

# ── 0. Preconditions ────────────────────────────────────────────────────────
log "0. Preconditions"
[[ -f "$PSQL" ]] || fail "psql not found at $PSQL"
"$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tc "SELECT 1;" >/dev/null 2>&1 \
  || fail "PostgreSQL not reachable on $PGHOST:$PGPORT (start the postgresql-x64-15 service)"
port_free "$BE_PORT" || fail "port $BE_PORT is already in use — stop that process first (the gate never kills a process it did not start)"
port_free "$FE_PORT" || fail "port $FE_PORT is already in use — stop that process first"
echo "PostgreSQL $("$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "show server_version" | tr -d ' \r\n') reachable; ports $BE_PORT/$FE_PORT free"
export GRADLE_USER_HOME="$BACKEND/.gradle-user"

# ── 1. Backend boot JAR (prod artifact) ─────────────────────────────────────
log "1. Backend boot JAR (prod artifact)"
(cd "$BACKEND" && ./gradlew.bat bootJar --console=plain -q) || fail "bootJar"
JAR="$BACKEND/build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar"
[[ -f "$JAR" ]] || fail "JAR missing at $JAR"

# ── 2. Frontend production build ────────────────────────────────────────────
log "2. Frontend production build (NEXT_PUBLIC_API_URL baked in)"
# Use the project's own build script (webpack) — plain `next build` forces
# Turbopack, which rejects the UTF-8 BOM in globals.css.
(cd "$FRONTEND" && NEXT_PUBLIC_API_URL="http://localhost:$BE_PORT" npm run build) \
  || fail "next build"

# ── 3. Gate database (ownership-checked; never drops a foreign database) ────
log "3. Fresh gate database"
if [[ "$(psql_admin "SELECT count(*) FROM pg_database WHERE datname='$GATE_DB'")" == "1" ]]; then
  # Positively establish ownership before destroying anything: the marker
  # schema/table is created the moment this gate first provisions the database.
  if [[ "$(psql_gate "SELECT count(*) FROM information_schema.tables WHERE table_schema='$GATE_SCHEMA' AND table_name='ownership'")" != "1" ]]; then
    fail "database $GATE_DB exists but carries no '$GATE_MARKER' marker — refusing to drop a database this gate cannot prove it owns. Inspect it, or drop it yourself if it is disposable."
  fi
  echo "existing gate database verified by marker; recreating"
  psql_admin "DROP DATABASE IF EXISTS $GATE_DB" >/dev/null \
    || psql_admin "DROP DATABASE IF EXISTS $GATE_DB WITH (FORCE)" >/dev/null \
    || fail "could not drop existing gate database $GATE_DB"
fi
psql_admin "CREATE DATABASE $GATE_DB" >/dev/null || fail "could not create $GATE_DB"
GATE_DB_CREATED=true
# The marker lives in its own schema so `public` stays empty for Flyway —
# baseline-on-migrate would otherwise treat a non-empty schema as pre-existing
# and skip V1.
"$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$GATE_DB" -q -c \
  "CREATE SCHEMA $GATE_SCHEMA; CREATE TABLE $GATE_MARKER (provisioned_at timestamptz NOT NULL DEFAULT now(), provisioned_by text NOT NULL);" >/dev/null 2>&1 \
  || fail "could not create the gate ownership marker"
"$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$GATE_DB" -q -c \
  "INSERT INTO $GATE_MARKER (provisioned_by) VALUES ('scripts/staging-gate.sh');" >/dev/null 2>&1 \
  || fail "could not record the gate ownership marker"
echo "database $GATE_DB created and marked as gate-owned"

# ── 4. Backend on prod profile (Flyway + validate, fail-fast env) ───────────
log "4. Backend on prod profile (Flyway + validate, fail-fast env)"
# DEMO_SEED_ENABLED is deliberately FALSE: no demo ADMIN/SCHOOL_ADMIN with
# committed passwords is ever created here (see the header and DemoSeedGuard).
# SECURE_COOKIES=false is for this plaintext-http local gate only — a TLS
# staging host must run with the production default (true).
DB_URL="jdbc:postgresql://$PGHOST:$PGPORT/$GATE_DB" \
DB_USER="$PGUSER" DB_PASSWORD="$PGPASSWORD_VALUE" \
JWT_SECRET="staging-gate-secret-0123456789abcdef0123456789abcdef" \
AI_INTERNAL_SECRET="staging-gate-internal" \
FRONTEND_URL="http://localhost:$FE_PORT" \
CORS_ALLOWED_ORIGINS="http://localhost:$FE_PORT" \
DEMO_SEED_ENABLED=FALSE \
SECURE_COOKIES=false \
java.exe -jar "$JAR" --spring.profiles.active=prod --server.port=$BE_PORT \
  >"$BE_LOG" 2>&1 &
BE_PID=$!

for i in $(seq 1 60); do
  curl -sf "http://localhost:$BE_PORT/actuator/health" >/dev/null 2>&1 && break
  kill -0 "$BE_PID" 2>/dev/null || { echo "── backend log tail ──"; tail -40 "$BE_LOG"; fail "backend died during boot"; }
  sleep 2
done
curl -sf "http://localhost:$BE_PORT/actuator/health" >/dev/null || fail "backend health"
echo "backend started; health 200"

# ── 5. Version-aware Flyway + schema verification ───────────────────────────
log "5. Flyway and schema verification"
# Derived from the migration directory, so adding a migration never breaks the
# gate for the wrong reason (the old assertion was a hard-coded 15).
EXPECTED_COUNT=$(find "$MIGRATION_DIR" -maxdepth 1 -name 'V*__*.sql' | wc -l | tr -d ' ')
EXPECTED_VERSION=$(find "$MIGRATION_DIR" -maxdepth 1 -name 'V*__*.sql' -printf '%f\n' \
  | sed -E 's/^V([0-9]+)__.*/\1/' | sort -n | tail -1)
[[ "$EXPECTED_COUNT" -gt 0 ]] || fail "no migrations found in $MIGRATION_DIR"

grep -qE "Successfully applied $EXPECTED_COUNT migrations .*now at version v$EXPECTED_VERSION" "$BE_LOG" \
  || fail "expected Flyway to apply $EXPECTED_COUNT migrations and reach v$EXPECTED_VERSION"

ACTUAL_VERSION=$(psql_gate "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1")
[[ "$ACTUAL_VERSION" == "$EXPECTED_VERSION" ]] || fail "flyway_schema_history says v$ACTUAL_VERSION, expected v$EXPECTED_VERSION"
FAILED_MIGRATIONS=$(psql_gate "SELECT count(*) FROM flyway_schema_history WHERE success = false")
[[ "$FAILED_MIGRATIONS" == "0" ]] || fail "$FAILED_MIGRATIONS failed migration(s) in flyway_schema_history"
echo "Flyway: $EXPECTED_COUNT/$EXPECTED_COUNT migrations applied, now at v$ACTUAL_VERSION, 0 failed"

# V20 contract at the schema level (county scoping for REGIONAL school dates).
if [[ "$EXPECTED_VERSION" -ge 20 ]]; then
  COLUMN="$(psql_gate "SELECT data_type || '|' || is_nullable || '|' || coalesce(character_maximum_length::text,'-') FROM information_schema.columns WHERE table_name='deadlines' AND column_name='county_code'")"
  [[ "$COLUMN" == "character varying|YES|64" ]] \
    || fail "deadlines.county_code schema mismatch (got '$COLUMN', expected 'character varying|YES|64')"
  INDEX_COUNT=$(psql_gate "SELECT count(*) FROM pg_indexes WHERE tablename='deadlines' AND indexname='idx_deadline_county'")
  [[ "$INDEX_COUNT" == "1" ]] || fail "idx_deadline_county missing"
  CODED=$(psql_gate "SELECT count(*) FROM deadlines WHERE scope='REGIONAL' AND county_code IS NOT NULL")
  [[ "$CODED" == "0" ]] || fail "a fresh gate database must contain no county-scoped REGIONAL rows, found $CODED"
  echo "V20 schema: deadlines.county_code varchar(64) NULL + idx_deadline_county verified"
fi

# ── 6. Production frontend (`next start`) ───────────────────────────────────
log "6. Production frontend (next start)"
(cd "$FRONTEND" && npm run start -- -p $FE_PORT >"$FE_LOG" 2>&1) & FE_PID=$!
for i in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$FE_PORT/login" && break
  sleep 2
done
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FE_PORT/login")
[[ "$CODE" == "200" ]] || fail "frontend /login returned $CODE"
echo "frontend /login 200 from production build"

# ── 7. Authenticated smoke through the production origin ────────────────────
log "7. Authenticated smoke (app-provisioned synthetic identity)"
# Unique per run, so the gate is repeatable and leaves no reusable credential.
SMOKE_EMAIL="gate-smoke-$(date +%s)-$RANDOM@staging-gate.invalid"
SMOKE_PASS="GateSmoke12345"
API="http://localhost:$FE_PORT/api"
JAR_COOKIES="$(mktemp)"
BODY="$(mktemp)"

REG_CODE=$(curl -s -b "$JAR_COOKIES" -c "$JAR_COOKIES" -o "$BODY" -w "%{http_code}" \
  -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASS\",\"name\":\"Gate Smoke User\",\"termsAccepted\":true}" || echo 000)
[[ "$REG_CODE" == "201" ]] || { cat "$BODY" 2>/dev/null; fail "registration returned $REG_CODE (expected 201)"; }
echo "registration through prod origin: 201 ($SMOKE_EMAIL)"

LOGIN_CODE=$(curl -s -b "$JAR_COOKIES" -c "$JAR_COOKIES" -o "$BODY" -w "%{http_code}" \
  -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASS\"}" || echo 000)
[[ "$LOGIN_CODE" == "200" ]] || { cat "$BODY" 2>/dev/null; fail "login returned $LOGIN_CODE (expected 200)"; }
echo "login round-trip through prod origin: 200"

ME_BODY=$(curl -s -b "$JAR_COOKIES" "$API/auth/me")
ME_CODE=$(curl -s -b "$JAR_COOKIES" -o /dev/null -w "%{http_code}" "$API/auth/me")
[[ "$ME_CODE" == "200" ]] || fail "/api/auth/me returned $ME_CODE"
grep -q "$SMOKE_EMAIL" <<< "$ME_BODY" || fail "/api/auth/me did not return the smoke identity"
grep -q "STUDENT" <<< "$ME_BODY" || fail "smoke identity is not a STUDENT (registration must never mint an admin)"
echo "session established: /api/auth/me 200, role STUDENT"

DEADLINES_CODE=$(curl -s -b "$JAR_COOKIES" -o /dev/null -w "%{http_code}" "$API/deadlines")
[[ "$DEADLINES_CODE" == "200" ]] || fail "/api/deadlines returned $DEADLINES_CODE for an authenticated user"
echo "/api/deadlines 200 for an authenticated student"

ANON_SCHEDULE=$(curl -s -o /dev/null -w "%{http_code}" "$API/guardian/schedule")
[[ "$ANON_SCHEDULE" == "401" ]] || fail "anonymous /api/guardian/schedule returned $ANON_SCHEDULE (expected 401)"
echo "authorization wiring: anonymous /api/guardian/schedule 401"

# No administrator account may exist in a gate database (defence in depth for
# the decision to stop seeding demo administrators).
ADMIN_ROWS=$(psql_gate "SELECT count(*) FROM users WHERE role IN ('ADMIN','SCHOOL_ADMIN')")
[[ "$ADMIN_ROWS" == "0" ]] || fail "gate database contains $ADMIN_ROWS administrator account(s); it must contain none"
echo "no administrator accounts present in the gate database"

rm -f "$JAR_COOKIES" "$BODY"

log "GATE PASSED — production artifact path verified end-to-end"
echo "  migrations: $EXPECTED_COUNT applied, v$ACTUAL_VERSION, 0 failed"
echo "  backend log: $BE_LOG"
echo "  frontend log: $FE_LOG"
