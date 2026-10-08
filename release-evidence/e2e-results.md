# E2E RESULTS — Integration, E2E Closure & Pilot-Readiness Audit (2026-10-02)

Environment: FE :3100 (dev) · BE :8097 (prod profile, rebuilt this audit with 2 bounded fixes) · AI :8001 (released r2 config) · PG :5433 (`elekeza_chain_scratch`).

## Pilot acceptance journey (TASK 18 — single end-to-end run)

Executed via the real API with CSRF + cookie sessions: `frontend/scripts/product-closure/pilot-acceptance.sh`
→ full transcript: [`pilot-acceptance.md`](pilot-acceptance.md). Final run verdict:

| Step | Result |
|---|---|
| 1. SCHOOL CREATED (`POST /api/institutions/register`) | ✅ 201 |
| 2. SCHOOL ADMIN LOGIN | ✅ 200 |
| 3. TEACHER CREATED (staff API) + **one-time password returned** (audit fix) + login 200 | ✅ |
| 4/5. LEARNER + GUARDIAN CREATED (CSV import, credentials returned — audit fix) | ✅ |
| 6. LEARNER LOGS IN | ✅ 200 |
| 7. TEACHER CREATES CONTENT (AI simplify adapted=True) + ASSIGNS | ✅ 200 |
| 8. LEARNER OPENS OWN LESSON (200) / seed-school lesson (403 — isolation) | ✅ |
| 9. QUIZ start→answer→complete → **score=20.0** | ✅ |
| 10. PROGRESS + GAMIFICATION | ✅ 200 |
| 11. AI TUTOR on own lesson (live Groq path) | ✅ 200 |
| 12. GUARDIAN sees ward + progress (own ward 200, seed ward 403) | ✅ |
| 13. ATTENDANCE | ⛔ BLOCKED — no class-creation endpoint (EL-F-007); cross-tenant attempt correctly 403 "Not authorized for this class" |
| 14. SAFIRI | ⛔ NOT IMPLEMENTED (module absent — see system map §9) |
| 15. NOTIFICATION GENERATED for new learner | ✅ (DB row; in-app channel) |
| 16. SCHOOL ADMIN sees students + analytics | ✅ 200 |
| 17. CROSS-TENANT PROBES (7/7 EXPECTED SECURITY DENIALS) | ✅ 403s |

## Role journeys (browser E2E, this engagement)

Learner 22/22 · Teacher 12/12 · Guardian 10/10 · School-admin 9/9 · AI-down/recovery 6/6 —
videos + screenshots in `recordings/` and `screenshots/`, full logs in `../e2e-evidence/`.

## 403 classification (every 403 observed)

| 403 observed on | Classification |
|---|---|
| learner→teacher/admin APIs, guardian→admin API, teacher/guardian→tutor | EXPECTED SECURITY DENIAL |
| new-school teacher → seed school institutions/{id}/students+staff | EXPECTED SECURITY DENIAL (object-level, live-verified) |
| new-school admin → seed school staff + class session | EXPECTED SECURITY DENIAL ("Not authorized for this class") |
| new guardian → another family's ward detail + progress | EXPECTED SECURITY DENIAL (object-level; also covered by Playwright IDOR negative test) |
| new learner → seed-school lesson content | EXPECTED SECURITY DENIAL (content isolation) |
| CSV import before CSRF fix in script | BROKEN USER JOURNEY (test-harness bug — script lacked header; real frontend sends it; fixed in harness) |

No authorization was weakened. Zero broken-journey 403s remain in the product.

## Failure hunt (browser journeys + probes)

- **HTTP status sweep**: zero 500s across all journeys/probes; 401/403/404/422/429 all exercised and correct; 409 verified (duplicate quiz complete).
- **CORS**: locked to FE origin (compose/prod yaml); same-origin proxy in dev.
- **CSRF**: enforced on every mutating route (verified +豁 exempt list intentional).
- **Stale state / failed refresh / broken redirects**: none observed; 401→refresh→login recovery verified on cold mounts.
- **Loading states**: only defect found was the /admin/staff flash (fixed previous audit; verified again this run).
- **Empty states**: guardian fees/notifications + admin "no classes" copy render honest empty states.

## Defects found this audit (new)

| ID | Sev | Problem | Status |
|---|---|---|---|
| PILOT-01 | **P0 (security)** | AI `INTERNAL_SECRET` defaults to `""` → fail-open (live-verified) | OPEN — needs AI r3 (frozen release) |
| PILOT-02 | **P1 (onboarding)** | CSV-import learner credentials computed but never returned (shadowed var + filtered list) → imported learners could not log in | **FIXED** (studentCredentials in response + FE panel; 278/278 tests green) |
| PILOT-03 | **P1 (onboarding)** | Staff-create temp password only sent to (mock) email → undeliverable | **FIXED** (tempPassword in create response + FE notice; tests green) |
| PILOT-04 | P1 (product gap) | No class-creation endpoint/UI → new schools cannot record attendance | OPEN (Harry decision) |
| PILOT-05 | P0 (scope) | Safiri module does not exist | OPEN (build-or-descope decision) |
| PILOT-06 | P2 | Backend `dev-secret` fallback for AI internal secret | OPEN (hardening) |
