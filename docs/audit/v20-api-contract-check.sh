#!/usr/bin/env bash
# ============================================================================
# V20 — PostgreSQL-backed county-visibility contract check
# ----------------------------------------------------------------------------
# Runs against the staging backend booted on the migrated PostgreSQL database
# (elekeza_v20_upgrade, schema v20). Every assertion is about observable
# access, not about implementation details.
#
# Fixtures: docs/audit/v20-staging-fixtures.sql (synthetic only).
# ============================================================================
set -uo pipefail

BE="${CONTRACT_BE:-http://localhost:8096}"
PSQL="${PG_PSQL:-/c/Program Files/PostgreSQL/15/bin/psql.exe}"
export PGPASSWORD=postgres
# Overridable so the identical contract can run against another server, e.g.
# the isolated PostgreSQL 16 container on 127.0.0.1:5434.
DBARGS=(-h "${PG_HOST:-localhost}" -p "${PG_PORT:-5433}" -U postgres -d "${PG_DB:-elekeza_v20_upgrade}")
TS=$(date +%s)

PASS=0; FAIL=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
no(){ echo "FAIL: $1"; FAIL=$((FAIL+1)); }

login() { # $1 email -> "<jar> <code>"
  local jar csrf code
  jar=$(mktemp)
  csrf=$(curl -s -c "$jar" "$BE/api/auth/csrf" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
  code=$(curl -s -b "$jar" -c "$jar" -o /dev/null -w '%{http_code}' -X POST "$BE/api/auth/login" \
    -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: $csrf" \
    -d "{\"email\":\"$1\",\"password\":\"student123\"}")
  echo "$jar $code"
}

post_deadline() { # $1 jar, $2 body -> "<body>\n<code>"
  local jar=$1 csrf
  csrf=$(curl -s -b "$jar" -c "$jar" "$BE/api/auth/csrf" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
  curl -s -b "$jar" -c "$jar" -w '\n%{http_code}' -X POST "$BE/api/deadlines" \
    -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: $csrf" -d "$2"
}

expect_status() { # label actual expected
  [[ "$2" == "$3" ]] && ok "$1 (HTTP $2)" || no "$1 (expected $3, got $2)"
}

has() { # label haystack needle
  grep -qF -- "$3" <<< "$2" && ok "$1" || no "$1 — missing '$3'"
}
hasnt() { # label haystack needle
  grep -qF -- "$3" <<< "$2" && no "$1 — LEAKED '$3'" || ok "$1"
}

echo "=== 1. Fixture identity ==="
"$PSQL" "${DBARGS[@]}" -tAc "select 'schema_version='||version from flyway_schema_history where success order by installed_rank desc limit 1;"
NAIROBI_ID=$("$PSQL" "${DBARGS[@]}" -tAc "select id from institutions where name='V20 Nairobi Academy'")
KISUMU_ID=$("$PSQL" "${DBARGS[@]}" -tAc "select id from institutions where name='V20 Kisumu Academy'")
echo "nairobi_institution=$NAIROBI_ID kisumu_institution=$KISUMU_ID"

echo
echo "=== 2. Admin authentication and regional creation ==="
read -r ADMIN_JAR ADMIN_CODE <<< "$(login v20.admin@staging.local)"
expect_status "admin login" "$ADMIN_CODE" 200

DUE="2026-11-2${TS: -1}T09:00:00Z"
R_NBI="V20 reg nairobi $TS"
R_KSM="V20 reg kisumu $TS"
R_NONE="V20 reg uncoded $TS"
NAT="V20 national $TS"
INST="V20 institution kisumu $TS"

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"$R_NBI\",\"deadlineType\":\"SCHOOL_EVENT\",\"scope\":\"REGIONAL\",\"dueAt\":\"$DUE\",\"county\":\"  NAIROBI  County \"}")
body=$(sed '$d' <<< "$out"); code=$(tail -1 <<< "$out")
expect_status "create REGIONAL county='  NAIROBI  County '" "$code" 200
has "  county normalised to 'nairobi' on write" "$body" '"countyCode":"nairobi"'

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"$R_KSM\",\"deadlineType\":\"SCHOOL_EVENT\",\"scope\":\"REGIONAL\",\"dueAt\":\"$DUE\",\"county\":\"Kisumu\"}")
code=$(tail -1 <<< "$out"); body=$(sed '$d' <<< "$out")
expect_status "create REGIONAL county='Kisumu'" "$code" 200
has "  county normalised to 'kisumu'" "$body" '"countyCode":"kisumu"'

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"$R_NONE\",\"deadlineType\":\"SCHOOL_EVENT\",\"scope\":\"REGIONAL\",\"dueAt\":\"$DUE\"}")
code=$(tail -1 <<< "$out"); body=$(sed '$d' <<< "$out")
expect_status "create REGIONAL without county (accepted, stored unscoped)" "$code" 200
has "  stored with null county" "$body" '"countyCode":null'

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"$NAT\",\"deadlineType\":\"EXAM\",\"scope\":\"NATIONAL\",\"dueAt\":\"$DUE\"}")
code=$(tail -1 <<< "$out")
expect_status "create NATIONAL" "$code" 200

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"$INST\",\"deadlineType\":\"SCHOOL_EVENT\",\"scope\":\"INSTITUTION\",\"dueAt\":\"$DUE\",\"institutionId\":$KISUMU_ID}")
code=$(tail -1 <<< "$out")
expect_status "create INSTITUTION (Kisumu academy)" "$code" 200

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"V20 blank county $TS\",\"deadlineType\":\"SCHOOL_EVENT\",\"scope\":\"REGIONAL\",\"dueAt\":\"$DUE\",\"county\":\"   \"}")
code=$(tail -1 <<< "$out")
expect_status "blank county rejected" "$code" 400

out=$(post_deadline "$ADMIN_JAR" "{\"title\":\"V20 wrong scope county $TS\",\"deadlineType\":\"EXAM\",\"scope\":\"NATIONAL\",\"dueAt\":\"$DUE\",\"county\":\"Nairobi\"}")
code=$(tail -1 <<< "$out")
expect_status "county on NATIONAL rejected" "$code" 400

echo
echo "=== 3. Persisted county codes (PostgreSQL read-back) ==="
"$PSQL" "${DBARGS[@]}" -tAc "select id||' | '||scope||' | '||coalesce(county_code,'<NULL>')||' | '||title from deadlines where title like 'V20 %$TS%' or title like 'V20 %' order by id;"

echo
echo "=== 4. Nairobi guardian (actively linked ward at Nairobi academy) ==="
read -r G1_JAR G1_CODE <<< "$(login v20.nairobi.guardian@staging.local)"
expect_status "guardian login" "$G1_CODE" 200
SCHED=$(curl -s -b "$G1_JAR" "$BE/api/guardian/schedule")
DEAD=$(curl -s -b "$G1_JAR" "$BE/api/deadlines")
has  "schedule: national visible" "$SCHED" "$NAT"
has  "schedule: own-county regional visible" "$SCHED" "$R_NBI"
hasnt "schedule: other-county regional hidden" "$SCHED" "$R_KSM"
hasnt "schedule: uncoded regional hidden" "$SCHED" "$R_NONE"
hasnt "schedule: legacy uncoded regional A hidden" "$SCHED" "V20 legacy regional uncoded A"
hasnt "schedule: legacy uncoded regional B hidden" "$SCHED" "V20 legacy regional uncoded B"
hasnt "schedule: other-institution date hidden" "$SCHED" "$INST"
has  "/api/deadlines: national visible" "$DEAD" "$NAT"
has  "/api/deadlines: own-county regional visible" "$DEAD" "$R_NBI"
hasnt "/api/deadlines: other-county regional hidden" "$DEAD" "$R_KSM"
hasnt "/api/deadlines: uncoded regional hidden" "$DEAD" "$R_NONE"

echo
echo "=== 5. Two-county guardian ==="
read -r G2_JAR G2_CODE <<< "$(login v20.twocounty.guardian@staging.local)"
SCHED2=$(curl -s -b "$G2_JAR" "$BE/api/guardian/schedule")
expect_status "guardian login" "$G2_CODE" 200
has  "schedule: sees Nairobi county date" "$SCHED2" "$R_NBI"
has  "schedule: sees Kisumu county date" "$SCHED2" "$R_KSM"
has  "schedule: sees Kisumu institution date" "$SCHED2" "$INST"
hasnt "schedule: uncoded regional still hidden" "$SCHED2" "$R_NONE"

echo
echo "=== 6. Lifecycle: revoked and expired links ==="
read -r GR_JAR GR_CODE <<< "$(login v20.revoked.guardian@staging.local)"
REVOKED=$(curl -s -b "$GR_JAR" "$BE/api/guardian/schedule")
expect_status "revoked guardian login" "$GR_CODE" 200
hasnt "revoked: no ward county regional" "$REVOKED" "$R_NBI"
hasnt "revoked: no ward institution date" "$REVOKED" "V20 legacy institution Nairobi"

read -r GE_JAR GE_CODE <<< "$(login v20.expired.guardian@staging.local)"
EXPIRED=$(curl -s -b "$GE_JAR" "$BE/api/guardian/schedule")
expect_status "expired guardian login" "$GE_CODE" 200
hasnt "expired: no ward county regional" "$EXPIRED" "$R_NBI"
hasnt "expired: no ward institution date" "$EXPIRED" "V20 legacy institution Nairobi"

echo
echo "=== 7. Authorization ==="
ANON=$(curl -s -o /dev/null -w '%{http_code}' "$BE/api/guardian/schedule")
expect_status "anonymous schedule access denied" "$ANON" 401
read -r STU_JAR STU_CODE <<< "$(login v20.ward.nairobi@staging.local)"
STU=$(curl -s -o /dev/null -w '%{http_code}' -b "$STU_JAR" "$BE/api/guardian/schedule")
expect_status "non-guardian schedule access denied" "$STU" 403

echo
echo "=== 8. No-county institution fails closed ==="
"$PSQL" "${DBARGS[@]}" -tAc "insert into guardian_links (guardian_id, learner_id, relationship, is_active, created_at) values (1003, 1008, 'PARENT', true, now());" >/dev/null
SCHED3=$(curl -s -b "$G2_JAR" "$BE/api/guardian/schedule")
hasnt "guardian with a county-less ward: no regional from that institution" "$SCHED3" "V20 legacy regional uncoded A"

echo
echo "=== SUMMARY: pass=$PASS fail=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
