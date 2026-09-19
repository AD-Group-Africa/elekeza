# Demo Readiness Report

Date: 2026-09-06 · Verdict: **DEMO READY — GREEN** (external integrations pending activation, see § Integrations)

## 1. Baseline at sprint start

All Phase-2/3 gates were already green (128-test backend suite, clean typecheck/lint/build, 40-check live journey). This sprint's scope was verification, rehearsal, and defect fixes only.

## 2. Rehearsal results

| Journey | Method | Result |
| ------- | ------ | ------ |
| Act 1 — School registration & onboarding | **Real browser** (preview tab): 3-step wizard filled and submitted | PASS after fix D1/D2 (below) — redirected to login with welcome state |
| Act 1 — New SCHOOL_ADMIN login | API + browser | PASS (200; no 500 after fix D3) |
| Act 2 — Teacher dashboard | **Real browser**: login → dashboard → analytics/notifications data loaded | PASS |
| Act 3 — Learner journey | Live journey harness: login → assignment → lesson → adapted content → quiz → result → progress | PASS (within 40/40) |
| Act 4 — Guardian (caregiver) | **Real browser**: login → guardian dashboard with relationship chip "Caregiver", teacher note, plain-language explainer | PASS |
| Act 4b — Guardian matrix (parent/sibling/caregiver) | Live journey harness: all three relationships scoped, unlinked learner blocked | PASS (within 40/40) |
| Act 5 — Cross-tenant IDOR | Live journey harness: second institution, school B admin → school A resources | PASS (403 across roster/profile/adaptation/support) |
| Act 6 — ADMIN ≠ SCHOOL_ADMIN | Live journey harness + earlier role-matrix tests | PASS (registration never grants platform ADMIN) |
| M-Pesa callback chain | 6 e2e tests + live server-to-server probe | PASS (after fix D4) |
| Duplicate registration | API probe + 2 regression tests | PASS (after fix D3) |

## 3. Defects found and fixed this sprint

| # | Severity | Defect | Fix | Evidence |
| - | -------- | ------ | --- | -------- |
| D1 | Demo-fatal | Onboarding wizard sent `adminName`; backend DTO requires `adminFirstName`+`adminLastName` → wizard always failed | Frontend payload corrected | Browser rehearsal: wizard completes |
| D2 | P1 (production) | Browser-side `api.ts` used an absolute cross-origin base → CSRF cookie never reached the API origin → every write through that client 403'd in real browsers | Client switched to the same-origin `/api` proxy base (matches `axios.ts` and `next.config.ts` design) | Browser wizard + journey harness both green |
| D3 | P1 (production) | Registering a school with an already-registered admin email created a duplicate user row → `findByEmail` threw `NonUniqueResultException` → **login permanently 500'd for that account** | Service-level 409 conflict check + entity unique constraint + lowercase normalization + global exception mapping | Live: 201 → 409 → login 200; 2 regression tests |
| D4 | P1 (production) | `/api/payments/callback` not CSRF-exempt → every real Safaricom server-to-server callback would 403 | Endpoint added to CSRF ignore list + 6 end-to-end chain tests | Live callback probe 200; e2e suite green |

## 4. Security results

- 40/40 live journey security negatives (IDOR, role escalation, unlinked guardian, wrong-learner, malformed JSON, expired-token behavior, rate limiting).
- No TODO/stub markers in backend source; no secrets in repo; `permitAll` only on intended public endpoints.
- CSRF, CORS, rate limiting, RBAC, tenant isolation all live-verified this session.

## 5. Integration results

| Integration | Status |
| ----------- | ------ |
| M-Pesa | **Code path verified** (12 tests + live probe). Sandbox: PENDING EXTERNAL ACTIVATION — see `MPESA_SANDBOX_REPORT.md` |
| AI personalization | Mock adapter verified live; deterministic, safe fallback to original content; provider pluggable |
| Email / SMS / Storage | Internal boundaries + mock adapters complete; activation config-only |

## 6. Test results summary

- Backend: **128/128** (0 failed, 0 skipped)
- Frontend: typecheck clean · lint clean · production build PASS
- Live journey: **40/40**
- Browser rehearsal: Acts 1, 2, 4 executed in a real browser; Acts 3, 5, 6 via journey harness against the same running stack

## 7. Remaining risks

- **BLOCKERS:** none in code.
- **HIGH:** none open.
- **PENDING EXTERNAL ACTIVATION:** M-Pesa Daraja sandbox, AI provider key, SMTP, Africa's Talking, R2 storage, staging-host deploy, remote CI run.
- **Demo-day operational risks:** covered in `docs/demo/DEMO-TROUBLESHOOTING.md` (CSRF token refresh, dev-DB reseed reassignment, offline fallback).
