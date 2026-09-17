#!/usr/bin/env bash
# =============================================================================
# Elekeza — one-command local staging gate (Windows Git Bash host)
#
# Deploys the REAL production artifact path end-to-end on this machine:
#   1. `next build` production frontend (NEXT_PUBLIC_API_URL baked in)
#   2. fresh PostgreSQL database (Flyway migrations + Hibernate validate — prod profile)
#   3. backend boot JAR on the prod profile (fail-fast env contract)
#   4. `next start` serving the production frontend
#   5. smoke checks: backend health, frontend HTTP 200, login round-trip
#      through the production origin
#   6. teardown: stop servers, drop the gate database (use --keep-db to inspect)
#
# Usage:  bash scripts/staging-gate.sh [--keep-db]
# Requires: PostgreSQL 15 running on :5433 (user postgres/postgres — local gate only)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PSQL="/c/Program Files/PostgreSQL/15/bin/psql.exe"
GATE_DB="elekeza_staging_gate"
BE_PORT=8096
FE_PORT=3105
BE_LOG="$(mktemp -t elekeza-staging-be.XXXX.log)"
FE_LOG="$(mktemp -t elekeza-staging-fe.XXXX.log)"
KEEP_DB=false
[[ "${1:-}" == "--keep-db" ]] && KEEP_DB=true

log()  { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m== GATE FAILED: %s\033[0m\n' "$*"; exit 1; }

cleanup() {
  log "Teardown"
  for p in ${BE_PID:-} ${FE_PID:-}; do
    [[ -n "$p" ]] && taskkill.exe //PID "$p" //F //T >/dev/null 2>&1 || true
  done
  if [[ "$KEEP_DB" == false ]]; then
    PGPASSWORD=postgres "$PSQL" -h localhost -p 5433 -U postgres \
      -c "DROP DATABASE IF EXISTS $GATE_DB;" >/dev/null 2>&1 || true
    echo "gate database dropped (use --keep-db to keep it for inspection)"
  else
    echo "gate database $GATE_DB kept (--keep-db)"
  fi
}
trap cleanup EXIT

log "0. Preconditions"
[[ -f "$PSQL" ]] || fail "psql not found at $PSQL"
PGPASSWORD=postgres "$PSQL" -h localhost -p 5433 -U postgres -tc "SELECT 1;" >/dev/null 2>&1 \
  || fail "PostgreSQL not reachable on localhost:5433 (start the postgresql-x64-15 service)"
export GRADLE_USER_HOME="$BACKEND/.gradle-user"

log "1. Backend boot JAR (prod artifact)"
(cd "$BACKEND" && ./gradlew.bat bootJar --console=plain -q) || fail "bootJar"
JAR="$BACKEND/build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar"
[[ -f "$JAR" ]] || fail "JAR missing at $JAR"

log "2. Frontend production build (NEXT_PUBLIC_API_URL baked in)"
# Use the project's own build script (webpack) — plain `next build` forces
# Turbopack, which rejects the UTF-8 BOM in globals.css.
(cd "$FRONTEND" && NEXT_PUBLIC_API_URL="http://localhost:$BE_PORT" npm run build) \
  || fail "next build"

log "3. Fresh gate database"
PGPASSWORD=postgres "$PSQL" -h localhost -p 5433 -U postgres \
  -c "DROP DATABASE IF EXISTS $GATE_DB;" -c "CREATE DATABASE $GATE_DB;" >/dev/null \
  || fail "could not create $GATE_DB"

log "4. Backend on prod profile (Flyway + validate, fail-fast env)"
DB_URL="jdbc:postgresql://localhost:5433/$GATE_DB" \
DB_USER=postgres DB_PASSWORD=postgres \
JWT_SECRET="staging-gate-secret-0123456789abcdef0123456789abcdef" \
AI_INTERNAL_SECRET="staging-gate-internal" \
FRONTEND_URL="http://localhost:$FE_PORT" \
CORS_ALLOWED_ORIGINS="http://localhost:$FE_PORT" \
java.exe -jar "$JAR" --spring.profiles.active=prod --server.port=$BE_PORT \
  >"$BE_LOG" 2>&1 & BE_PID=$!

for i in $(seq 1 60); do
  if curl -sf "http://localhost:$BE_PORT/actuator/health" >/dev/null 2>&1; then break; fi
  kill -0 "$BE_PID" 2>/dev/null || { tail -20 "$BE_LOG"; fail "backend died during boot"; }
  sleep 2
done
curl -sf "http://localhost:$BE_PORT/actuator/health" >/dev/null || fail "backend health"
grep -q "Successfully applied 11 migrations" "$BE_LOG" \
  || fail "expected 'Successfully applied 11 migrations' in backend log"
echo "Flyway: 11/11 migrations applied; Hibernate validate OK; health 200"

log "5. Production frontend (`next start`)"
(cd "$FRONTEND" && npx next start -p $FE_PORT >"$FE_LOG" 2>&1) & FE_PID=$!
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://localhost:$FE_PORT/login"; then break; fi
  sleep 2
done
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FE_PORT/login")
[[ "$CODE" == "200" ]] || fail "frontend /login returned $CODE"
echo "frontend /login 200 from production build"

log "6. Smoke: login round-trip through the production origin"
COOKIE_JAR="$(mktemp)"
CSRF=$(curl -s -c "$COOKIE_JAR" "http://localhost:$FE_PORT/login" -o /dev/null \
  && grep XSRF "$COOKIE_JAR" | awk '{print $7}' | head -1)
LOGIN_CODE=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost:$FE_PORT/api/auth/login" \
  -H "Content-Type: application/json" ${CSRF:+-H "X-XSRF-TOKEN: $CSRF"} \
  -d '{"email":"student@elekeza.app","password":"student123"}' || echo 000)
[[ "$LOGIN_CODE" == "200" ]] \
  || fail "login through prod origin returned $LOGIN_CODE (seed accounts exist only with dev seed — Flyway V2 seed provides superadmin@elekeza.app on PG; see note below)"
echo "login round-trip: 200"

log "GATE PASSED — production artifact path verified end-to-end"
echo "  backend log: $BE_LOG"
echo "  frontend log: $FE_LOG"
echo "  NOTE: the Flyway V2 seed provisions the PostgreSQL demo accounts; if the"
echo "  login smoke is 401 against a fresh PG, verify the V2 seed ran (flyway_schema_history)."
