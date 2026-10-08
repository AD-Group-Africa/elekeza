# ELEKEZA — TESTING

> Canonical testing reference. **No fake passing:** a test passes only when actual behaviour is
> verified — page loads, button existence, mock data, or a bare 200 do not count.

## 1. Suites & how to run

| Suite | Command | Latest verified result |
|---|---|---|
| Backend (JUnit/Kotlin, H2 dev profile) | `cd backend && GRADLE_USER_HOME="$(pwd)/.gradle-user" ./gradlew test` (machine cache quirk: project-local gradle home) | **278/278** (this engagement) |
| Frontend unit (Vitest) | `cd frontend && npm test` | 17/17 (prior audit; re-verify each release) |
| Frontend typecheck | `npm run type-check` (`tsc --noEmit`) | clean (re-verify after each code change) |
| Frontend production build | `npm run build` (webpack; `NEXT_PUBLIC_API_URL` required at build time) | PASS (55–59 pages) |
| E2E (Playwright) | `npm run test:e2e` (isolated stack; set `E2E_BACKEND_PORT`/`E2E_FRONTEND_PORT` — the frontend port must be in the dev CORS allowlist 3000/3100/3005) | **31 green** (30 passed + 1 passed on retry #1), exit 0 (2026-10-03) |
| Journey scripts | `node frontend/scripts/product-closure/journey-{learner,teacher,guardian,admin,ai-down}.mjs` | learner 22/22 · teacher 12/12 · guardian 10/10 · admin 9/9 · ai-down 2/2 (all re-run 2026-10-03 after Assist/Logout fix) |
| Acceptance journey | `bash frontend/scripts/product-closure/pilot-acceptance.sh` | **PASS** (full school→learner→guardian loop) |
| AI service (pytest) | `cd ai-elewa && AI_TEST_BASE_URL=http://localhost:8001 INTERNAL_SECRET=$(grep ^INTERNAL_SECRET= .env | cut -d= -f2-) venv/Scripts/python.exe -m pytest` | **606 passed** incl. live smoke 3/3 (2026-10-03, after fail-closed fix) |
| Migration gate | fresh DB boot (prod profile) | **Re-verified 2026-10-05**: fresh DB `elekeza_migration_probe` → Flyway V1–V16 applied (16/16 success), `ddl-auto=validate` PASS, `/actuator/health` UP; probe DB dropped after. Evidence: `backend/migration-probe.log` |
| Backup/restore | `scripts/db-backup.sh` (needs `PGPASSWORD` export) + `scripts/db-restore-drill.sh backups/<dump>` | drill **PASSED** |
| Staging gate (one command) | `bash scripts/staging-gate.sh` | **GATE PASSED** (2026-09-30): prod build → fresh PG migrations → bootJar fail-fast env → `next start` → smoke |

## 2. Coverage by risk

- **RBAC/tenant isolation:** `MultiTenantAuthorizationTest`, `ContentAuthorizationTest`,
  `GuardianAnalyticsAuthorizationTest`, `SupportAuthorizationTest`, personalization suites,
  guardian relationship tests — plus the live 403 matrix (institutions/{id}/students+staff,
  class session, guardian ward, content).
- **Auth:** rotation/reuse-revocation tests, forgot-password enumeration regression, 429 limiter
  determinism (interval refill — greedy-refill bypass fixed).
- **Integrity:** quiz duplicate-submission score-inflation regression (repeats still score 50%);
  M-Pesa callback chain (12 tests: replay idempotency, amount binding, unknown-ID rejection,
  failure path); duplicate admin registration 409.
- **AI safety:** diagnostic-phrase blacklist, key-term preservation, deterministic transforms
  preserve every source sentence, cache isolation (cross-learner 403), AI-down degradation journey.
- **Uploads:** path-traversal regression (flattened names), extension/MIME/size checks.

## 3. E2E matrix (mandate §32 mapping)

Login ×4 roles · learner learning journey · quiz submission · progress tracking · guardian-child
relationship + progress + notifications · teacher learner management · school administration ·
unauthorized/cross-tenant/invalid-token/expired-token/rate-limit probes · AI authentication,
validation, provider failure, timeout (degradation journey) · notification behaviour · navigation &
back button · mobile navigation & responsive layouts (manual grid this closure; automated viewport
suite post-closure) · production build · database migration · database restore.

## 4. Rules

1. External service unavailable? → **abstraction + deterministic mock + test + clear production
   dependency** (never a silent mock in prod).
2. Never suppress a failure to reach green; fix or classify honestly.
3. Environment notes (Windows): pass file paths via `sys.argv[1]` (never embed inside `python -c`);
   dev-server hydration races → wait `networkidle` before fill/click; backend prod profile needs
   `SERVER_PORT=8097` (8080 occupied) via `backend/restart-local.sh`.
4. Evidence: keep screenshots/videos/logs in `e2e-evidence/` and `release-evidence/` — they are the
   audit trail; do not delete.

## 5. Known gaps (honest)

- Automated axe/WCAG CI suite — not yet (manual accessibility checks this closure).
- AI provider-key suites — blocked on real Groq credential.
- Remote CI runner green run — rehearsed locally; remote execution pending infra.
- Load testing (100/500/1000 concurrent) — not performed (post-pilot).
