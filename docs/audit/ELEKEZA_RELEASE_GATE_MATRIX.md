# ELEKEZA Release Gate Matrix — Phase 6

**Branch:** `sprint-3-safe-config` @ `c56df6b` · **Date:** 5 Nov 2026 · **Re-verified:** 8 Nov 2026  
**JAR rebuilt:** Yes (`gradlew bootJar`, 101 MB)  
**E2E result (8 Nov 2026, authoritative):** **38/38 passed**, 0 failed, 0 flaky, 19.4m, `FINAL E2E EXIT: 0`  
**E2E result (5 Nov 2026, superseded history):** 37/38 — superseded; its seed-gap diagnosis is retracted (see `ELEKEZA_FRONTEND_E2E_REPORT.md` §2)

| Gate | Status | Evidence / Notes |
|---|---|---|
| Core learning workflows | PASS | Backend 357 + E2E journeys/exams; exam spec passes |
| Role-based security | PASS | Cross-tenant matrices + E2E; 357-test suite green |
| Accessibility (WCAG automated) | PASS on tested surfaces; manual/device NOT TESTED | 7 surfaces all passing in E2E run |
| AI tutor reliability | PASS (mock + live smoke); usage quotas ABSENT | Live Groq smoke passed after venv SDK pin 1.4.0 |
| Mobile responsiveness | NOT TESTED on device (emulation only) | No Redmi 14C device access |
| PWA installation | NOT TESTED (device) | IndexedDB + service worker present |
| Offline/reconnect | PASS (E2E desktop) | Offline spec passes |
| School onboarding | PASS (E2E) | SCHOOL_ADMIN creation + finance dashboard |
| Data protection (DPA 2019) | FAIL / BLOCKED | No privacy policy, DPIA or consent artefacts in repo |
| Integration readiness | BLOCKED on credentials (M-Pesa prod, SMS, SMTP, R2 keys) | Harrison must provide accounts/credentials |
| Staging readiness | BLOCKED on host/TLS/domain decision | VPS recommendation pending |
| **Messaging** | **PASS** (verified 8 Nov 2026) | Guardian→teacher round trip proven at API level (`GET /api/guardian/teachers` 200, `POST /api/guardian/messages` 200 `{"status":"sent"}`, row persisted, teacher `GET /api/teacher/messages` returns same body) and in E2E (`messaging round-trip`, 37.1s). Prior diagnosis retracted: the ward link exists (`DataInitializer: Linked guardian parent@elekeza.app to learner student@elekeza.app`); `ShowcaseDataInitializer` never runs because the suite does not set `SHOWCASE_SEED`. The real defect was the icon-only send button having no accessible name (fixed with `aria-label`) plus swallowed `.catch()`s in the spec (removed). Isolation checks: learner POST → 403; non-teacher recipient → 400 `Recipient is not a teacher`; anonymous → 401. |

## Top Product Defects / Gaps (priority)

1. **P1** — Data protection artefacts absent (privacy policy, DPIA, consent flows) before any school data is collected.
2. **P1** — AI usage limits/quotas per learner & per tenant not enforced.
3. **P2** — Class-management API only on unmerged branch (`origin/frontend/complete-system`).
4. **P2** — Kiswahili UI switch absent.
5. **P2** — SMS/email providers mocked (Africa's Talking, JavaMail).
6. **P3** — Legacy purple classes on secondary pages (cosmetic).
7. ~~**P3** — Messaging round-trip: seed data gap.~~ **CLOSED 8 Nov 2026** — not a seed gap; it was a test/a11y defect (icon-only send button without an accessible name). Fixed and verified 38/38.

## Release Decision

| Condition | Action |
|---|---|
| Fresh E2E run confirms **38/38** | **Achieved 8 Nov 2026** — messaging gate closed; release-ready pending other P1/P2 items |
| Fresh E2E run still shows **37/38** | Not applicable — 38/38 reached |
| No fresh E2E run | Not applicable |

**Caveat on the 38/38:** the suite is sensitive to host RAM. On the 8 GB host, a resident Gradle daemon (started by `globalSetup`) inflated the run to 1.2h and produced 3 timeout failures that passed in isolation. With the daemon reclaimed the same code passed 38/38 in 19.4m. Timeouts were not raised.

## Notes

- The 5 Nov messaging failure was **not** a seed data gap and **not** a CSRF/auth regression. It was a test defect: the send button was icon-only with no accessible name, so the role/name query never matched and the resulting timeout was swallowed by `.catch(() => {})`.
- The `ShowcaseDataInitializer.kt` patch remains in the working tree but is **not exercised by E2E** (the suite does not set `SHOWCASE_SEED`). It is not the reason messaging now passes.
- Backend JAR `build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar` was rebuilt with `gradlew bootJar` and is what the E2E run booted.
- Next step: Harrison decision on merge/commit (no staging, commit, push or deploy performed). Branch integration remains separately gated.