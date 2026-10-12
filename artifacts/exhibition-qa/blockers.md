# Blockers & Limitations — Exhibition QA (2026-10-12)

## 1. SCHOOL_ADMIN demo account password unknown
- `admin@elekeza.app` returns 401 for every documented candidate password (admin123 / schooladmin123 / superadmin123 / demo123).
- `docs/archive/demo/DEMO-ACCOUNTS.md` expects `schooladmin@elekeza.app`, which is not in Flyway V2 seed (only `admin@` and `superadmin@`).
- Impact: `/admin` (School Administration dashboard) could NOT be captured. This is the only journey in the requested list that remains unverified visually.
- Suggested fix (owner: user/or operator): try the actual password used at v0.1.0-pilot tagging time, or register a fresh school live via `/school/onboarding`, or reset the demo admin password in the scratch DB by re-running the school wizard.

## 2. Backend has lingering uncommitted state not caused by me
- Session started with a clean tree at commit `bab0ba2`; my changes are limited to:
  - `frontend/src/app/teacher/support/page.tsx`
  - `frontend/src/app/teacher/quiz-results/page.tsx`
  - `frontend/src/app/teacher/exams/page.tsx`
  - `frontend/e2e/exhibition-capture.spec.ts` (new, unused after pivot to standalone script)
  - `frontend/scripts/capture-exhibition.mts` (new, capture driver)
  - `artifacts/exhibition-qa/*` (new, reports/screenshots)
- No other files touched.

## 3. Test-runner E2E (`npx playwright test`) too slow on this machine
- The full Playwright suite boots its own separate dev-profile backend + separate Next dev server; first-test cold compile exceeded 10 minutes and was abandoned. Not a code defect — an infrastructure/time issue on this Windows machine.
- Workaround used: standalone `playwright-core` script against the real, healthy stack on :3100/:8097. If the full `journey.spec.ts` suite run is required as evidence, allocate 30+ min and a warm `.next-e2e` cache.

## 4. Playwright `preview_screenshot` (Codebuff preview webview) not compositing
- Could not use the built-in preview to inspect generated PNGs in a webview; substituted: (a) pixel-diversity sanity check on all PNGs (all well above blank-page threshold), and (b) live-browser route inspection at :3100 for the sidebar fix verification. Screenshots themselves are genuine Playwright/Chromium captures of the real app.

## 5. Journeys not implemented / not verifiable in this build
- Orange UI variant: no orange theme variant exists in code. Purple-primary theme confirmed; green remaps apply by role (guardian).
- Live M-Pesa: intentionally out of scope (per instructions).
- Offline sync/queue journey: IndexedDB helper exists (`offlineQueueCount`) but offline functionality itself was not exercised in this online run. Not labeled offline-capable.

## 6. Consistent 2×401 console noise pre-auth
- Every journey logs exactly two `401 (Unauthorized)` XHRs before login completes. This is the auth probe before cookie issuance, not a defect, but if the exhibition will be projected on a large screen, a devtools-free demo (F12 closed) will not show it.
