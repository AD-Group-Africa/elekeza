# RELEASE CANDIDATE REPORT — Elekeza

**CURRENT STATUS: NOT READY FOR THE EXPANDED SCHOOL-PLATFORM RELEASE.** Earlier learner-learning release evidence remains useful, but it does not verify the added P0 ERP, attendance, fee, payment, or five-role requirements.

## 1. Implementation completed (this RC gate)

**Backend**
- `mastery/MasteryEngine.kt` — deterministic, explainable mastery V1: states `NOT_ASSESSED / DEVELOPING / APPROACHING / MASTERED / NEEDS_SUPPORT`, configurable thresholds, single-attempt caution (one attempt never confirms mastery), rationale on every evaluation, non-diagnostic language guard.
- `mastery/MasteryController.kt` — `/api/mastery/learner` (self), `/api/mastery/learner/{id}` (teacher, tenant-isolated, 404-not-403 for non-students), `/api/mastery/teacher/support` (class queue ranked by support needs, `@PreAuthorize`).
- Adaptive next-step recommendations per lesson (`start/practice/support/challenge`), always explainable, weak when evidence is insufficient.
- Dev seed fixes: learner is now assigned + has completed the demo lesson (learner home's primary action works from a clean DB); attempt score corrected to the real 0–100 scale; quiz ownership moved to the teacher.

**Frontend**
- `lib/masteryDisplay.ts` — presentation helpers; distinct icon per state (never colour-only meaning), respectful labels.
- `/progress` — new "What to do next" section fed by `/mastery/learner` (non-fatal fetch).
- Teacher students page — "Lesson mastery evidence" in the support panel.
- `Celebration` — **fixed a real trap**: the post-quiz overlay was undismissible; now a proper dialog with a required `Continue` affordance (unit-tested).
- `forgot-password` — **fixed broken flow**: double `/api` prefix 404'd silently; swept for other instances (none).
- Vitest + Testing Library infrastructure (`vitest.config.ts`, setup, first 17 tests); Playwright config + 12-test E2E suite + `global-setup.ts` (builds the boot JAR; boots backend JAR + Next dev reproducibly).

**Config**
- Dev CORS allow-list extended with the E2E frontend port (root-cause fix for browser 403 masquerading as bad credentials). Production config untouched.

## 2. Tests (exact)

| Suite | Command | Result |
| --- | --- | --- |
| Backend | `./gradlew test` (+ XML count) | **173 passed / 0 failed / 0 skipped** |
| Frontend unit | `npm run vitest run` | **17 passed / 0 failed** |
| E2E | `E2E_BACKEND_PORT=8091 npx playwright test` | **12 passed / 0 failed** (3.5 min) |
| Typecheck | `npx tsc --noEmit` | PASS (exit 0) |
| Lint | `npm run lint` | **0 errors** (26 pre-existing warnings) |
| Build | `NEXT_PUBLIC_API_URL=… npm run build` | PASS (all routes; SW regenerated) |

## 3. User journeys (browser-proven)

- Learner: **PASS** — login → home → lesson → section reading → practice gate → quiz → server score → review → celebration dismiss → progress ("What to do next" mastery visible).
- Teacher: **PASS** — login → students → support panel with mastery evidence → progress dashboard.
- Guardian: **PASS** — login → ward list → ward detail; cross-guardian access shows no foreign data.
- Admin: **PASS WITH LIMITATION** — admin surfaces exist and were verified in earlier live gates; not scripted in the current E2E spec.

## 4. Critical workflows

Quiz **PASS** (browser, server-scored, persisted) · Exam **PASS WITH LIMITATION** (backend-tested 18 tests; browser spec deferred) · Progress **PASS** · Mastery **PASS** (22 backend tests + UI) · Gamification **PASS WITH LIMITATION** (persisted-data driven; replay-abuse E2E deferred) · Personalization **PASS WITH LIMITATION** (precedence + safety tested; real-user validation is pilot work) · Offline **PASS WITH LIMITATION** (SW + idempotent queue verified in build/code; automated offline E2E deferred) · Sync **PASS WITH LIMITATION** (Idempotency-Key replay; failure-mode drill pending).

## 5. Browser / link audit

E2E exercises the core routes across all three roles incl. direct-URL access, unauthorized access and non-existent resources (999999 ward id). Console-error monitor over the core learner flow: **0 real errors** (only favicon/404 noise filtered). A full per-route crawl of all 54 routes is a deferred follow-up; the core journeys, their nav, shells, refreshes and empty states are covered by the suite above.

## 6. Accessibility

Verified: skip-to-content (keyboard, E2E), `aria-current` nav, focus-visible ring, reduced motion, `aria-live`/`role=alert|status` on async outcomes, accessible names on icon buttons, star ratings as `role=img` labels, distinct mastery icons (non-colour meaning), large learner targets, dismissible dialog with focus. Automated: unit + E2E assertions (17 + 12 tests). **Not yet done:** axe-core CI integration, full screen-reader sessions, 400% zoom audit — pilot-phase work.

## 7. Security

Tested in-suite: multi-tenant authorization (11), auth/input security (15), forgot-password enumeration safety (5), content authorization + upload safety (5), guardian relationship (3), support authorization (9), M-Pesa integrity (12), mastery authorization (5), exam integrity (18). Direct-API vs UI: all authorization server-side. Not yet automated: exhaustive IDOR sweep, dependency audit in CI, rate-limit coverage beyond login.

## 8. Known limitations (genuine, none hidden)

1. Exam runner + offline/sync + repeat-completion E2E specs deferred (backend coverage exists).
2. Mastery V1 is per-lesson (questions not yet skill-tagged).
3. A11y automation (axe) and real screen-reader/zoom/AT validation pending.
4. Route-crawl audit of all 54 routes beyond core journeys pending.
5. 26 pre-existing lint warnings.
6. No automated performance gate.

## 9. Expanded-release blockers (found 2026-09-16)

1. Attendance is not implemented as a backend domain/API/migration.
2. The M-Pesa implementation stores platform-wide transactions only. It has no school/tenant or learner ownership, no fee structure or invoice/charge, allocation, balance, receipt, or manual-payment model. Calling it a school finance module would be inaccurate.
3. The current test evidence is historical to the expanded brief; a clean-start rerun of backend, frontend, E2E, and role paths remains required.

## 10. External integrations (owner-side, all degrade gracefully today)

M-Pesa/Daraja credentials · SMS provider (Africa's Talking) · SMTP/email · Groq AI key (or keep `AI_CLIENT_TYPE=mock`) · Cloudflare R2 storage · production PostgreSQL (`DB_URL/DB_USER/DB_PASSWORD`) · `JWT_SECRET` (real value) · `NEXT_PUBLIC_API_URL` at build time · deployment host, DNS, HTTPS, monitoring, backups.

## 11. End-user testing instructions

See `docs/END_USER_TESTING.md` — accounts, 3 role scripts, feedback questions, privacy rules.

## 12. Deployment quick-start (owner)

```bash
# Backend: set DB_URL, DB_USER, DB_PASSWORD, JWT_SECRET (prod), then
./gradlew bootJar && java -jar build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
# Frontend: set NEXT_PUBLIC_API_URL=https://api.<your-domain>, then
npm run build && npm start
```

Mocks keep only the implemented integrations functional until real credentials are connected. The operational procedure is in `docs/DEPLOYMENT_RUNBOOK.md`.
