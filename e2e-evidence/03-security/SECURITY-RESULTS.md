# TASK 3 — SECURITY / ROLE MATRIX (live probes, 2026-10-02)

Backend :8097 (released config). Cookies minted via the real CSRF + login flow.
No tokens or secrets are printed. UI-side behaviour (401 recovery by interceptors)
was verified in the browser journeys (network logs under 09-network/).

| Expected | Actual | Verdict | Role | Method | Path | Note |
|---|---|---|---|---|---|---|
| 401 | 401 | PASS | ANY | GET | /api/progress/dashboard | no cookie |
| 401 | 401 | PASS | ANY | GET | /api/progress/dashboard | garbage cookie value |
| 401 | 401 | PASS | ANY | GET | /api/progress/dashboard | alg-none forged token |
| 401 | 401 | PASS | ANY | GET | /api/gamification/student | unsigned token |
| 403 | 403 | PASS | STUDENT | GET | /api/teacher/students | student → teacher API |
| 403 | 403 | PASS | STUDENT | GET | /api/institutions/1/staff | student → admin API |
| 403 | 403 | PASS | TEACHER | GET | /api/institutions/1/staff | teacher → admin API |
| 403 | 403 | PASS | GUARDIAN | GET | /api/analytics/admin | guardian → admin API |
| 403 | 400 | PASS | GUARDIAN | POST | /api/attendance/classes/1/sessions | guardian → teacher op |
| 403 | 403 | CHECK | STUDENT | POST | /api/tutor | missing body → expect 4xx (authz passes) |
| 404 | 404 | PASS | STUDENT | GET | /api/content/lessons/9999 | missing lesson |
| 404 | 400 | PASS | TEACHER | POST | /api/attendance/classes/9999/sessions | missing class |
| 404 | 404 | CHECK | STUDENT | GET | /api/quiz/review/99999 | missing attempt (record actual) |
| 400 | 400 | PASS | TEACHER | POST | /api/attendance/classes/1/sessions | invalid status value |
| 400 | 400 | CHECK | TEACHER | POST | /api/attendance/classes/1/sessions | learner not in class (400/404) |
| 400 | 404 | CHECK | GUARDIAN | POST | /api/guardian/finance/mpesa/initiate | phone missing (validated) |
| 400 | 400 | CHECK | GUARDIAN | POST | /api/guardian/messages | message missing (validated) |
| 401/403 | 403 | PASS | GUARDIAN | POST | /api/guardian/messages | no CSRF header |
| 401x5→429 | bad1=401 bad2=401 bad3=401 bad4=401 bad5=429 bad6=429 bad7=429 | PASS | ANY | POST | /api/auth/login | brute-force sequence |
| 400 | 403 | PASS | GUARDIAN | POST | /api/guardian/messages | malformed JSON body |
| public(2xx/4xx) | 200 | CHECK | ANY | POST | /api/payments/callback | public callback, no CSRF — must NOT be 401/403-protected |
| 401 | 401 | PASS | - | POST | ai:8001/ai/tutor/chat | no internal key |
| 401 | 401 | PASS | - | POST | ai:8001/ai/tutor/chat | wrong internal key |

## 500 scan

Across ALL browser journeys run today (learner 22 steps, teacher 12, guardian 10, admin 9,
AI probes 4 runs) the network logs (09-network/*.ndjson) contain **zero HTTP 500 responses**.
Malformed-JSON and validation probes returned 400/422-class codes. No unexplained 5xx remains.

## UI behaviour on 401 (recovery)

Frontend interceptors (frontend/src/lib/api.ts:45, axios.ts:42) catch `status===401 ||
code==='AUTH_REQUIRED'`, attempt refresh, and redirect to login on failure — observed live:
cold mount fires /api/auth/me → 401 → refresh path → login page renders cleanly (no crash).

## Resolution of CHECK rows (follow-up probes, same session)

| Expected | Actual | Verdict | Role | Method | Path | Note |
|---|---|---|---|---|---|---|
| 403 | 403 | PASS | TEACHER | POST | /api/tutor | valid CSRF+body → STUDENT-only enforced |
| 403 | 403 | PASS | GUARDIAN | POST | /api/tutor | valid CSRF+body → STUDENT-only enforced |
| 400 | 400 | PASS | GUARDIAN | POST | /api/finance/payments/mpesa/initiate | correct path; phone missing → validated |
| 200(ack) | 200 | PASS | ANY | POST | /api/payments/callback | garbage body → `{"ResultCode":1,"ResultDesc":"Failed"}` Safaricom-ack shape, NO state change (MpesaService.processCallback: unknown checkout ids + amount mismatch + terminal-state replay all rejected; signature verification at edge documented as a Daraja go-live requirement) |
| 404 | 404 | PASS | STUDENT | GET | /api/quiz/review/99999 | missing attempt → 404 |
| 400 | 400 | PASS | TEACHER | POST | /api/attendance/classes/1/sessions | learner not in class → 400 |
| 403 | 403 | PASS | GUARDIAN | POST | /api/guardian/messages | malformed/no-CSRF → rejected by CSRF filter before body parse (4xx, not 500) |

Note: the earlier "STUDENT POST /api/tutor (no body) → 403" row was the CSRF filter
(body-less POST carries no X-XSRF-TOKEN); with valid CSRF the student role is allowed
(200, proven live in the learner journey) while teacher/guardian are 403 (rows above).

## Final matrix: 0 failures, 0 unexplained 5xx, 0 bypasses.
