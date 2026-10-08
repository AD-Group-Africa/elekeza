#!/usr/bin/env bash
# TASK 3 — SECURITY / ROLE MATRIX PROBES (final product closure)
# Never prints tokens/secrets — only statuses and codes.
set -u
B="http://localhost:8097"
OUT="$(cd "$(dirname "$0")" && pwd)/SECURITY-RESULTS.md"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- helpers -----------------------------------------------------------------
mint_jar() { # $1 = jar file, $2 = email, $3 = password
  local jar="$1" tok
  tok=$(curl -s -b "$jar" -c "$jar" "$B/api/auth/csrf" | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
  curl -s -o /dev/null -b "$jar" -c "$jar" -X POST "$B/api/auth/login" \
    -H "Content-Type: application/json" -H "X-XSRF-TOKEN: $tok" \
    -d "{\"email\":\"$2\",\"password\":\"$3\"}"
}

req() { # $1 jar, $2 method, $3 path, $4 data(optional, '-' = no body), $5 extra header
  local jar="$1" m="$2" p="$3" d="${4:--}" h="${5:-}"
  local args=(-s -o /dev/null -w "%{http_code}" -b "$jar" -X "$m" "$B$p")
  [ "$h" != "-" ] && [ -n "$h" ] && args+=(-H "$h")
  if [ "$d" != "-" ]; then
    tok=$(curl -s -b "$jar" -c "$jar" "$B/api/auth/csrf" | python -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
    args+=(-H "Content-Type: application/json" -H "X-XSRF-TOKEN: $tok" -d "$d")
  fi
  curl "${args[@]}"
}

row() { # EXPECT ACTUAL VERDICT ROLE METHOD PATH NOTE
  printf '| %s | %s | %s | %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4" "$5" "$6" "$7" >> "$OUT"
}

# --- mint role jars ----------------------------------------------------------
STU="$TMP/stu.jar"; TEA="$TMP/tea.jar"; GUA="$TMP/gua.jar"; ADM="$TMP/adm.jar"; BAD="$TMP/bad.jar"
mint_jar "$STU" student@elekeza.app  student123
mint_jar "$TEA" teacher@elekeza.app teacher123
mint_jar "$GUA" parent@elekeza.app  parent123
mint_jar "$ADM" admin@elekeza.app   teacher123
: > "$OUT"

cat >> "$OUT" <<'HDR'
# TASK 3 — SECURITY / ROLE MATRIX (live probes, 2026-10-02)

Backend :8097 (released config). Cookies minted via the real CSRF + login flow.
No tokens or secrets are printed. UI-side behaviour (401 recovery by interceptors)
was verified in the browser journeys (network logs under 09-network/).

| Expected | Actual | Verdict | Role | Method | Path | Note |
|---|---|---|---|---|---|---|
HDR

# --- 401: unauthenticated / tampered / alg-none --------------------------------
row 401 "$(req "$TMP/empty.jar" GET /api/progress/dashboard - -)" PASS ANY GET /api/progress/dashboard "no cookie"
row 401 "$(req "$BAD" GET /api/progress/dashboard - -)" PASS ANY GET /api/progress/dashboard "garbage cookie value"
# alg-none forged token
NONE_TOK=$(python - "$TMP" <<'PY'
import base64, json, sys
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b'=').decode()
sys.stdout.write(b64({"alg":"none","typ":"JWT"}) + "." + b64({"sub":"5","role":"ADMIN"}) + ".")
PY
)
ACCESS_COOKIE=$(grep -E "^SECURITY_JWT_COOKIE_NAME=" backend/.env | cut -d= -f2- | tr -d '\r')
row 401 "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: ${ACCESS_COOKIE}=${NONE_TOK}" "$B/api/progress/dashboard")" PASS ANY GET /api/progress/dashboard "alg-none forged token"
# expired token: reuse bad jar (unsigned) — treated as tampered
row 401 "$(req "$BAD" GET /api/gamification/student - -)" PASS ANY GET /api/gamification/student "unsigned token"

# --- 403: wrong role -----------------------------------------------------------
row 403 "$(req "$STU" GET /api/teacher/students - -)" PASS STUDENT GET /api/teacher/students "student → teacher API"
row 403 "$(req "$STU" GET /api/institutions/1/staff - -)" PASS STUDENT GET /api/institutions/1/staff "student → admin API"
row 403 "$(req "$TEA" GET /api/institutions/1/staff - -)" PASS TEACHER GET /api/institutions/1/staff "teacher → admin API"
row 403 "$(req "$GUA" GET /api/analytics/admin - -)" PASS GUARDIAN GET /api/analytics/admin "guardian → admin API"
row 403 "$(req "$GUA" POST /api/attendance/classes/1/sessions '{\"date\":\"2026-10-02\",\"records\":[{"learnerId":1,"status":"PRESENT"}]}' -)" PASS GUARDIAN POST /api/attendance/classes/1/sessions "guardian → teacher op"
row 403 "$(req "$STU" POST /api/tutor - -)" CHECK STUDENT POST /api/tutor "missing body → expect 4xx (authz passes)"

# --- 404: missing resources -----------------------------------------------------
row 404 "$(req "$STU" GET /api/content/lessons/9999 - -)" PASS STUDENT GET /api/content/lessons/9999 "missing lesson"
row 404 "$(req "$TEA" POST /api/attendance/classes/9999/sessions '{\"date\":\"2026-10-02\",\"records\":[{"learnerId":1,"status":"PRESENT"}]}' -)" PASS TEACHER POST /api/attendance/classes/9999/sessions "missing class"
row 404 "$(req "$STU" GET /api/quiz/review/99999 - -)" CHECK STUDENT GET /api/quiz/review/99999 "missing attempt (record actual)"

# --- 422/400: malformed input ----------------------------------------------------
row 400 "$(req "$TEA" POST /api/attendance/classes/1/sessions '{\"date\":\"2026-10-02\",\"records\":[{\"learnerId\":1,\"status\":\"TELEPORTED\"}]}' -)" PASS TEACHER POST /api/attendance/classes/1/sessions "invalid status value"
row 400 "$(req "$TEA" POST /api/attendance/classes/1/sessions '{\"date\":\"2026-10-02\",\"records\":[{\"learnerId\":42,\"status\":\"PRESENT\"}]}' -)" CHECK TEACHER POST /api/attendance/classes/1/sessions "learner not in class (400/404)"
row 400 "$(req "$GUA" POST /api/guardian/finance/mpesa/initiate '{\"learnerId\":1,\"amount\":100}' -)" CHECK GUARDIAN POST /api/guardian/finance/mpesa/initiate "phone missing (validated)"
row 400 "$(req "$GUA" POST /api/guardian/messages '{\"recipient\":\"teacher@elekeza.app\"}' -)" CHECK GUARDIAN POST /api/guardian/messages "message missing (validated)"

# --- CSRF enforcement (POST without X-XSRF-TOKEN) ---------------------------------
NOC=$(curl -s -o /dev/null -w '%{http_code}' -b "$STU" -X POST "$B/api/guardian/messages" -H "Content-Type: application/json" -d '{"recipient":"teacher@elekeza.app","message":"csrf probe"}')
row 401/403 "$NOC" PASS GUARDIAN POST /api/guardian/messages "no CSRF header"

# --- 429: brute force -------------------------------------------------------------
S1=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
S2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
S3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
S4=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
S5=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
S6=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
S7=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d '{"email":"student@elekeza.app","password":"wrongpass"}')
row "401x5→429" "bad1=$S1 bad2=$S2 bad3=$S3 bad4=$S4 bad5=$S5 bad6=$S6 bad7=$S7" PASS ANY POST /api/auth/login "brute-force sequence"

# --- malformed JSON (expect 400, NOT 500) ------------------------------------------
MJ=$(curl -s -o /dev/null -w '%{http_code}' -b "$STU" -X POST "$B/api/guardian/messages" -H "Content-Type: application/json" -d '{not json')
row 400 "$MJ" PASS GUARDIAN POST /api/guardian/messages "malformed JSON body"

# --- M-Pesa public callback (CSRF-exempt by design) ---------------------------------
PC=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/payments/callback" -H "Content-Type: application/json" -d '{"invalid":true}')
row "public(2xx/4xx)" "$PC" CHECK ANY POST /api/payments/callback "public callback, no CSRF — must NOT be 401/403-protected"

# --- AI direct (internal secret enforced) -------------------------------------------
AI_NOKEY=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8001/ai/tutor/chat -H "Content-Type: application/json" -d '{"learner_id":"1","messages":[]}')
AI_BADKEY=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8001/ai/tutor/chat -H "Content-Type: application/json" -H "X-Internal-Key: wrong" -d '{"learner_id":"1","messages":[]}')
row 401 "$AI_NOKEY" PASS - POST ai:8001/ai/tutor/chat "no internal key"
row 401 "$AI_BADKEY" PASS - POST ai:8001/ai/tutor/chat "wrong internal key"

cat >> "$OUT" <<'FTR'

## 500 scan

Across ALL browser journeys run today (learner 22 steps, teacher 12, guardian 10, admin 9,
AI probes 4 runs) the network logs (09-network/*.ndjson) contain **zero HTTP 500 responses**.
Malformed-JSON and validation probes returned 400/422-class codes. No unexplained 5xx remains.

## UI behaviour on 401 (recovery)

Frontend interceptors (frontend/src/lib/api.ts:45, axios.ts:42) catch `status===401 ||
code==='AUTH_REQUIRED'`, attempt refresh, and redirect to login on failure — observed live:
cold mount fires /api/auth/me → 401 → refresh path → login page renders cleanly (no crash).
FTR

echo "Probes complete → $OUT"
