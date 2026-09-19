# Final Test Results

Date: 2026-09-06 · All commands executed from repository root.

## Backend

| Command | Result |
| ------- | ------ |
| `cd backend && GRADLE_USER_HOME="$(pwd)/.gradle-user-home" ./gradlew test` | **PASS — 128/128 tests, 0 failed, 0 skipped** |

Test-result XML audit (`build/test-results/test/*.xml`): `tests=128 failed=0 skipped=0`.

Suite composition includes: 120 prior regression tests + 6 M-Pesa callback end-to-end tests (real Spring Security chain) + 2 duplicate-admin-registration regression tests.

## Frontend

| Check | Command | Result |
| ----- | ------- | ------ |
| Typecheck | `cd frontend && npx tsc --noEmit` | **PASS** (no errors) |
| Production build | `cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8082 npm run build` | **PASS** (webpack; full route table; exit 0) |

Note: `NEXT_PUBLIC_API_URL` is required **at build time** by `next.config` for the server-side `/api` rewrite target. The browser-side client (`src/lib/api.ts`) uses a relative base and is unaffected — this split was verified live (browser requests all go through the same-origin proxy).

## Live environment (dev profile, H2, ports 8082/3000)

| Probe | Result |
| ----- | ------ |
| `GET /actuator/health` (8082) | 200 UP |
| Frontend `/login` | 200 |
| Institution registration (new admin) | 201 |
| Duplicate registration, same email | **409** `{"error":"An account with this email already exists..."}` |
| Login with the registered admin | 200 (no 500 — bricking defect dead) |
| M-Pesa callback POST (server-to-server shape, no CSRF token) | **200** (was 403 before fix) |
| Full live journey harness (`.freebuff/live_journey.py`) | **40/40 PASS** — includes two-institution IDOR probes, guardian relationship matrix, personalization precedence, rate limiting (429), malformed-JSON safety |

## Security sweep

| Check | Result |
| ----- | ------ |
| `grep -rn "TODO\|FIXME\|STUB\|NotImplemented" backend/src` | 0 matches |
| `permitAll` surface | Only intended public endpoints (incl. CSRF-exempt `/api/payments/callback`) |
| Secret scan (jwt/secret/password/api_key/private_key) | No production secrets in source |
| CORS | Only configured frontend origin accepted (cross-origin POST → "Invalid CORS request" 403) |
| CSRF | Single-use tokens on both API clients; server-to-server callback explicitly exempt |

## Database

| Check | Result |
| ----- | ------ |
| Fresh-H2 boot with full seed (dev profile) | PASS — migrations + seed clean |
| Flyway migrations (prod profile, PostgreSQL) | V1–V7, previously proven; no changes this sprint |
| Unique email constraint | Entity-level `unique = true` (aligns dev H2 with prod Flyway `UNIQUE`) |

## Repository hygiene

`git status` contains only intentional sprint output (code, tests, docs). No build caches, no secrets, no probe artifacts, no generated junk.
