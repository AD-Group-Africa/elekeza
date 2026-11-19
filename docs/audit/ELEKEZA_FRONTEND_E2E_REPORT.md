# ELEKEZA Frontend E2E Report — Phase 6

**Latest verification:** 8 Nov 2026 · Branch `sprint-3-safe-config` @ `c56df6b`
**Test command:** `npx playwright test` (real services: backend JAR on :8090, Next dev on :3100, H2 dev profile — no mocks)
**Total specs:** 38

---

## 1. Result — 8 Nov 2026 (current, authoritative)

| Metric | Count |
|---|---|
| Passed | 38 |
| Failed | 0 |
| Flaky | 0 |
| Skipped | 0 |
| Retries used | 0 |
| Duration | 19.4m |
| Exit code | 0 |

`38 passed (19.4m)` · `FINAL E2E EXIT: 0`
Log: `frontend/e2e-full-2-2026-11-08.log`

### Messaging round-trip — PASS (37.1s)

`ok 19 · exhibition-capture.spec.ts:92:7 · exhibition capture › messaging round-trip`

The spec now asserts a real round trip end to end:

1. Guardian `parent@elekeza.app` logs in; `/guardian/communication` teacher select is **enabled** with exactly **1** option (`Alice Mwalimu`).
2. A unique body (timestamped) is typed and submitted via `getByRole('button', { name: 'Send message' })`.
3. The body is asserted **visible on the guardian thread** (persistence through the API/DB).
4. The teacher logs in, opens `/teacher/communication`, and the same body is asserted **visible as received**.

All prior `.catch(() => {})` swallows and the no-op Enter press were removed, so a regression in any step fails the test.

---

## 2. Correction — the 5 Nov diagnosis was wrong (retracted)

The 5 Nov entry in this file claimed the messaging failure was a **seed-data gap**: "`parent@elekeza.app` had no guardian link … `ShowcaseDataInitializer` gave indices 0,1,2 zero ward links". **That claim is retracted.** Verified on 8 Nov 2026:

| Claim | Status | Evidence |
|---|---|---|
| `ShowcaseDataInitializer` caused the failure | **WRONG** | The E2E suite never sets `SHOWCASE_SEED`, so `ShowcaseDataInitializer` — and its ward-link patch — never executes during E2E. |
| `parent@elekeza.app` has no guardian link | **WRONG** | Backend startup log: `DataInitializer: Linked guardian parent@elekeza.app to learner student@elekeza.app`. The link exists and is created by `DataInitializer`, not by the showcase seeder. |
| Guardian cannot reach teachers | **WRONG** | `GET /api/guardian/teachers` → `200 [{"id":1,"name":"Alice Mwalimu","email":"teacher@elekeza.app"}]`. |
| Message POST fails | **WRONG** | `POST /api/guardian/messages` → `200 {"status":"sent"}`; row persists (`id:1`, `senderId:3`, `senderName:"Fatima Ali"`); teacher `GET /api/teacher/messages` returns the same body. |

**Actual root cause — a test defect in the control under test:**

- The guardian send button was **icon-only with no accessible name**, so `getByRole('button', { name: /send/i })` matched nothing.
- That 30 s timeout was swallowed by `.catch(() => {})`, so the test continued past the failure and timed out later with a misleading error.

**Fixes applied (8 Nov 2026):**

| File | Change |
|---|---|
| `frontend/src/app/guardian/communication/page.tsx` | Added `aria-label={sending ? 'Sending message' : 'Send message'}` to the icon-only send button — a genuine WCAG name defect in the control under test. |
| `frontend/e2e/exhibition-capture.spec.ts` | Rewrote `messaging round-trip` to assert the four steps above; removed every swallowed `.catch()` and the no-op Enter press. |

`npx tsc --noEmit` exit 0; `npx eslint` on both files exit 0 (2 pre-existing warnings, unrelated).

---

## 3. Run history

### 8 Nov 2026 — run 1: 32 passed / 3 failed / 3 flaky (1.2h, exit 1) — host contention, NOT regressions

| Spec | Test | Attempts | Signature |
|---|---|---|---|
| 21/22 | `exhibition-capture.spec.ts:136:7` mobile views | 4.3m, 4.5m | `Test timeout of 240000ms exceeded` inside `page.waitForURL` (login) |
| 27/28 | `journey.spec.ts:64:5` learner journey | 4.0m, 1.6m | `locator('button:has-text("A.")')` not visible within 10s — quiz UI not rendered in time |
| 37/38 | `offline.spec.ts:37:5` offline learner | 1.7m, 3.6m | `toHaveURL(/\/lesson\//)` stayed `/student-home` (45s); then "Saved offline — will sync when you reconnect" absent (15s) |
| 30 | `journey.spec.ts:130:5` guardian ward | flaky → passed retry (51.7s) | 1.5m first attempt |
| 40/42 | `routes-crawl.spec.ts:53,65` learner/teacher crawl | flaky → passed retry | 4.2m first attempts |

**Cause: host resource contention.** Evidence, not assumption:

1. **Isolation result** — the three failing tests re-run alone with `--retries=0`: `3 passed (4.3m)`, `TARGETED EXIT: 0` (mobile views 1.2m, learner journey 42.7s, offline 15.6s). Log: `frontend/e2e-targeted-2026-11-08.log`.
2. **Memory pressure** — host has 8.0 GB total; 1.5 GB free with **no** java/node/chrome running. The `globalSetup` step runs `gradlew bootJar`, leaving a Gradle daemon resident (~1.7 GB) for the entire 1.2h run. `gradlew --stop` returned free RAM from **1.5 GB → 3.2 GB**.
3. **Uniform slowdown** — identical tests ran 4–6× slower than the healthy baseline (logout 1.3m vs 6.7s; forgot-password 42.3s vs 9.7s; offline 1.7m vs 13.8s).
4. **No server-side failure** — zero 5xx / ECONNREFUSED / ETIMEDOUT lines in the suite log; every failure signature was a UI stall or a login navigation stall, never an API error.

### 8 Nov 2026 — run 2 (daemon reclaimed after `globalSetup`): **38/38 passed (19.4m, exit 0)**

Same code, same assertions, same timeouts, no test skipped or weakened. Route crawls remained the slowest file (5.9m).

### 5 Nov 2026 — 37/38 (superseded, kept as history)

| Metric | Count |
|---|---|
| Passed | 37 |
| Failed | 1 (messaging round-trip, spec #20 + retry #21) |
| Duration | 38.7m |
| Exit code | 1 |

Retained only as history. Its stated root cause (seed-data gap) is retracted per §2. The `ShowcaseDataInitializer` ward-link patch remains in the working tree but is **not exercised by E2E**.

---

## 4. Notes

- Coverage of the 38 passing specs: a11y (7 surfaces), attendance/finance, exam, exhibition capture (10 captures), journey, offline/reconnect, routes-crawl (learner/teacher/guardian).
- The suite runs **without** `SHOWCASE_SEED`; the E2E data world comes from `DataInitializer` plus `AttendanceFinanceSeed` (`@Profile("dev") @Order(2)`, ungated).
- Persistence evidence comes from the real JPA/H2 (PostgreSQL mode) layer, because no PostgreSQL listens on :5432; this is the same store the E2E suite itself uses. It is **not** evidence about a PostgreSQL deployment.
- **Operational note for repeatable runs:** on an 8 GB host, stop the Gradle daemon after `globalSetup` (`backend/gradlew --stop`) before the run completes, or run the suite on a machine with more RAM. Leaving it resident reproduces run 1's 240 s timeouts. Timeouts were **not** raised to mask this.
- No orphaned :8090 / :3100 processes were present before either run; both ports were free. The 5 Nov note claiming orphaned processes is removed as inaccurate.
