# TASK 9 — FINAL DEFECT MATRIX (2026-10-02, full E2E closure audit)

Severity scale: BLOCKER / HIGH / MEDIUM / LOW / COSMETIC.
Owner A = Agent (bounded, auto-fixable in closure fix loop) · H = Harry (product/external).

| ID | Severity | Role | Page | Journey | Expected | Actual | HTTP | Endpoint | Root cause | Evidence | Fix required | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EL-NEW-01 | MEDIUM | Learner | /learner/preferences → /lesson/[id] | 2A accessibility | read-aloud pref ON ⇒ Listen button on lessons | pref persists server-side but lesson page never shows Listen button from it | 200 | PUT/GET /api/learner/preferences | Two disconnected preference systems: server prefs (learner_profiles API) vs localStorage `elekeza-settings` (useAccessibilitySettings); lesson page gates ListenButton only on the localStorage system | Run-2 step-10 FAIL capture; 04-persistence/learner-db-verification.md; DB row ttsEnabled=true while pref-driven buttons absent | Gate ListenButton additionally on server pref readAloud | A | **FIXED + VERIFIED** (fresh-profile probe: server pref alone → 4 Listen buttons; learner journey 22/22 re-run) |
| EL-NEW-02 | MEDIUM | Guardian + Teacher | /guardian/communication, /teacher/communication | 2C | message delivered to counterpart, two-sided thread | both directions store the notification against the SENDER only; recipient field ignored | 200 | POST /api/guardian/messages; POST /api/notifications/send | MessageController saves Notification(userId = sender) and never resolves `recipient` | DB notifications id=16 user_id=3; MessageController.kt:47-53; teacher page posts to /notifications/send | Delivery routing + per-user thread reads (design change, not a bounded patch) | H | OPEN — classified |
| EL-F-014 | MEDIUM | Teacher | /attendance | 2B a11y | axe: no serious contrast violations | 4 serious contrast violations (select, date input, learner name, save button inherit dark-theme text on light UI; emerald-600 button 3.76:1) | — | — | light page relied on inherited body colour + too-light button | axe-teacher-attendance.json; after: axe-attendance-after-fix.json | Explicit text-gray-900 on form controls + emerald-700 button | A | **FIXED + VERIFIED** (axe re-scan: 0 violations of any impact; teacher journey 12/12 re-run) |
| EL-F-007 | MEDIUM | Admin | classes management | — | admin can create classes in product | no class-creation endpoint or UI anywhere | — | — | Product gap (architecture decision) | earlier audit + endpoint inventory | New endpoint + UI = design work | H | OPEN — classified |
| EL-NEW-03 | LOW | Teacher | /teacher/content | 2B / AI probes | honest degradation without internal topology | error text exposes internal AI host:port and provider error JSON | 200 | POST /api/content/upload/text | adapted=false payload embeds raw exception message | 05-ai/A03-upload-badkey.png (badkey run) | Sanitize message for non-dev builds | A | OPEN |
| EL-NEW-04 | LOW | Admin | /admin/staff | 2D | settled staff page on cold load | transient "account is not linked" flash while /api/auth/me resolves | 200 | GET /api/auth/me | early-return renders from user=null before session fetch resolves | run-1 vs probe-staff.mjs + admin-staff-recheck.png | Show loading state until user resolves | A | **FIXED + VERIFIED** (authLoading gate added; admin journey 9/9 re-run) |
| EL-F-010 | LOW | Teacher | /teacher/assignments | 2B | human-readable targets | raw learner/class IDs in form | 200 | /api/assignments | form binds IDs directly, no label lookup | earlier audit + today's render | labelled dropdowns | A | **FIXED + VERIFIED** (lesson/student selects populated from /content/list + /teacher/students; teacher journey 12/12 re-run) |
| EL-F-011 | LOW | Teacher | /teacher/assignments | 2B | visible confirmation on save | silent list refresh, no feedback | 200 | /api/assignments | no toast/notice on success | earlier audit | add success toast | A | **FIXED + VERIFIED** (Toast on create; tsc clean; teacher journey 12/12 re-run) |
| EL-F-AIport | LOW | (tests) | ai-elewa/tests | CI | target from environment | BASE_URL hardcodes http://localhost:8000 | — | — | hardcode at test_edge_cases.py:21 | 30 env-failures in AI suite run | read env with default | A | **FIXED + VERIFIED** (AI_TEST_BASE_URL env; pytest subset against :8001 → 1 passed) |
| EL-F-005r | LOW | Learner | /quiz/[lessonId] | 2A | encouraging, actionable quiz error copy | terse red "Quiz not found." | — | /api/quiz/* | static copy | earlier audit | copy polish | A | **FIXED + VERIFIED** (friendly copy + link home; answer-failure learnerMessage; tsc clean; learner journey 22/22 re-run) |
| EL-NEW-05 | COSMETIC | Learner | /student-home | 2A | unambiguous XP display | "N points to Level X" shows remaining points, not total (derivation verified correct) | 200 | /api/gamification/student | label wording | 04-persistence/learner-db-verification.md derivation check | wording tweak (optional) | A | OPEN |
| EL-NEW-06 | COSMETIC | Any | config | — | no dead config | GOOGLE_CLIENT_ID etc. present but no OAuth flow exists | — | — | template/env leftovers | 06-integrations/INTEGRATION-STATUS.md #8 | remove or implement | H | OPEN |
| EL-F-013r | LOW | Learner | /quiz | — | one attempt per open | dev-only StrictMode paired attempt starts | — | /api/quiz/{id}/start | React StrictMode double-invoke in dev only | earlier audit | none (dev-only, server dedups by attempt) | A | ACCEPTED |
| EL-F-016 | LOW | Ops | scripts/db-backup.sh | — | one-command backup | requires manual PGPASSWORD export | — | — | script does not source backend/.env | backup drill PASS with env set | document (done) | A | DOCUMENTED |

## Totals (pre-fix-loop)

BLOCKER 0 · HIGH 0 · MEDIUM 4 (EL-NEW-01, EL-NEW-02, EL-F-014, EL-F-007) · LOW 7 · COSMETIC 2

## Totals (post-fix-loop)

BLOCKER 0 · HIGH 0 · MEDIUM 2 OPEN (EL-NEW-02 message delivery — product decision; EL-F-007 class creation — product gap) · LOW 4 OPEN (EL-NEW-03, EL-NEW-05, EL-NEW-06, EL-F-013r-accepted, EL-F-016-documented) · COSMETIC 2

**FIXED + VERIFIED: 7 defects** (EL-NEW-01, EL-F-014, EL-NEW-04, EL-F-010, EL-F-011, EL-F-AIport, EL-F-005r) — each verified by: `tsc --noEmit` clean, targeted probes (fresh-profile Listen probe; axe re-scan 0 violations; pytest env-target subset), and full re-runs of the affected journeys (learner 22/22, teacher 12/12, admin 9/9). Guardian journey untouched (no changed files) — regression-free.

Verification evidence: `frontend/scripts/product-closure/verify-fixes.mjs`, `03-security/axe-attendance-after-fix.json`, `02-user-journeys/learner/V-server-pref-listen.png`.

## Zero-failure evidence

- Journeys: learner 22/22, teacher 12/12, guardian 10/10, admin 9/9 steps OK (all with persistence loops where applicable)
- Security matrix: 0 failures, 0 unexplained 401/403/404/422/500 on core journeys, 0 role bypasses (03-security/SECURITY-RESULTS.md)
- Network logs across all journeys: zero HTTP 500 responses
- AI degradation: no crashes, no secret exposure in any scenario (05-ai/)
