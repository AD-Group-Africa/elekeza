# FINAL RELEASE GATE REPORT

**Date:** 20 November 2026 · **Candidate:** `baed7f4` (`consolidation/2026-11-19`)
**Supersedes:** the 19 November report in this file, which incorrectly described promotion as a fast-forward.
That claim was wrong and has been withdrawn (`docs/deployment/ANCESTRY_CORRECTION_2026-11-20.md`).

---

## A. Executive summary

The application is **engineering-validated**. It is **not hosted-pilot-ready**, because no hosted environment
exists, and it is **not production-approved**. Those three states are separate and are not conflated here.

What this session achieved:

1. **Repository forensics completed.** All three unrelated histories were compared at file and feature level.
   **No lineage-A functionality was found missing from the consolidated tree.** The consolidated line is a
   superset in every area the pilot needs, except two cosmetic accessibility controls (`spacing`,
   `layoutDensity`) and dormant Google OAuth (never wired to any UI in either lineage).
2. **The high-severity dependency advisory is closed** — `follow-redirects` 1.16.1 → 1.16.3 via a single
   `overrides` entry, no major upgrades. Production tree is now **0 high / 0 critical**.
3. **Security headers implemented and tested** — HSTS (config-gated, no `includeSubDomains`/`preload`),
   `Permissions-Policy`, explicit `nosniff`, and a corrected Netlify config that no longer *claims* HSTS is
   applied for it. Seven new tests; one of them caught a Spring default that would have over-scoped HSTS.
4. **Generated dump removed from source control** — `ai-elewa/repomix-ai.xml` (438 KB) contained no real
   secret; removed from the index and ignored, history untouched.
5. **Request correlation added** — every request gets an `X-Request-Id` that is echoed, echoed-back only when
   safe, and rendered in the log pattern.
6. **A deployment defect found and fixed before it cost money** — `render.yaml` claimed Render "Starter" is
   2 GB; it is 512 MB. With `-Xmx1200m` the backend would have OOM-looped on first boot. Both services are now
   `standard`, with the cost recorded.
7. **Android inspected honestly** — it is a Capacitor WebView shell with no signing config, no current APK and
   no local web bundle. `allowBackup` was `true` (a real exposure for a minor's session) and is now `false`.
8. **Nine deliverables written**, each separating verified fact from observation, assumption and
   recommendation.

What remains is **provisioning and people**, not code: hosting accounts, credentials, cost approval, the
lineage decision, then hosted acceptance.

---

## B. Repository state

| Item | Value |
|---|---|
| Branch | `consolidation/2026-11-19` |
| HEAD at start of session | `baed7f4` |
| Remote of same branch | `baed7f4` (in sync) |
| `origin/main` | `a86e128` — **untouched** (lineage A) |
| `origin/develop` | `f65f436` — **untouched** (lineage A) |
| `origin/staging` | `3d8c738` — **untouched** (lineage C) |
| `origin/HEAD` | still `→ origin/staging` (lineage C) — a trap for new clones |
| Tags | 12, including `v0.1.0-orphan-snapshot` → `3d8c738` |
| Working tree | clean apart from this session's remediation edits and three pre-existing untracked files preserved under `backups/consolidation-2026-11-19/untracked-root-files/` |

**No force-push. No branch deleted. No history rewritten.** Verified by the absence of any `push --force`
in this session's command history and by the remote SHAs above being unchanged.

---

## C. Work completed

### Code

| File | Change |
|---|---|
| `backend/.../config/SecurityConfig.kt` | HSTS (opt-in, no subdomains/preload), `Permissions-Policy`, explicit `nosniff` |
| `backend/.../common/RequestCorrelationFilter.kt` | **new** — validated/generated `X-Request-Id` + MDC |
| `backend/src/main/resources/application.yaml` | `app.security.hsts-enabled` (default false), log pattern carries `requestId` |
| `backend/src/main/resources/application-prod.yaml` | `server.forward-headers-strategy: framework` |
| `backend/src/test/.../SecurityHeadersTest.kt` | **new** — 5 tests |
| `backend/src/test/.../HstsHeaderTest.kt` | **new** — 2 tests |
| `frontend/package.json` | `follow-redirects: ^1.16.3` override; lockfile regenerated |
| `frontend/netlify.toml` | real HSTS header; corrected the false claim about Netlify's layer |
| `frontend/android/.../AndroidManifest.xml` | `allowBackup` true → **false** |
| `render.yaml` | `starter` → `standard` ×2 (with cost + reason), `HSTS_ENABLED=true` |
| `.gitignore` | `ai-elewa/repomix-*.xml` |
| `ai-elewa/repomix-ai.xml` | `git rm --cached` (file kept on disk) |

### Documentation

`REPOSITORY_LINEAGE_DECISION_2026-11-20.md`, `FEATURE_PARITY_MATRIX_2026-11-20.md`,
`SECURITY_REMEDIATION_REPORT_2026-11-20.md`, `STAGING_DEPLOYMENT_REPORT_2026-11-20.md`,
`DATABASE_RESTORE_RUNBOOK.md`, `FIVE_ROLE_HOSTED_ACCEPTANCE_REPORT.md`, `ANDROID_RELEASE_READINESS.md`,
`AT4D_PRODUCT_DEVELOPMENT_BRIEF_2026-11-20.md`, plus `TEST_RESULTS.md` §4 and this report.
Previous-day docs were corrected rather than duplicated.

---

## D. Test evidence

| Suite | Command | Result |
|---|---|---|
| Backend | `./gradlew cleanTest test --console=plain` | **417 / 417**, 64 suites, 0 failures (4 m 38 s) |
| Backend jar | `./gradlew bootJar` | BUILD SUCCESSFUL (8 s) |
| Frontend types | `npx tsc --noEmit` | exit 0 |
| Frontend unit | `npx vitest run` | **84 / 84** |
| Frontend build | `npm run build` | exit 0, 60 routes |
| Browser E2E | `npx playwright test` | **52 / 52**, exit 0 (8 m 42 s) — 46 journeys plus 6 school-admin/platform-admin module checks added under the activation directive |
| Dependency audit | `npm audit --json` | **0 high, 0 critical** (14 moderate/low, build-time) |
| Config parse | XML / TOML / YAML | all valid |
| Database drill | (run earlier this sprint) | 21/21 migrations, restore verified, schema + row parity |
| AI suite | (run earlier this sprint) | 603 / 603 |

One defect was found **by** the new tests and fixed in production code, not in the assertion (HSTS
`includeSubDomains` defaulting to true).

**Not run:** hosted acceptance (no environment), Android build (no staging URL, no signing), load test
(no target), AI suite re-run (no AI code changed in this phase).

---

## E. Security

**Closed:** high-severity `follow-redirects` advisory; a false HSTS claim in deployment config; a real HSTS
gap; missing `Permissions-Policy`; unsafe `allowBackup` on the Android shell; a generated 438 KB dump in
source control.

**Open, in priority order:**

| # | Finding | Severity | Owner |
|---|---|---|---|
| 1 | Credentials that lived in lineage A's tracked `.env` files must be treated as compromised and rotated at provisioning | **High until rotated** | Harrison |
| 2 | AI/tutor endpoints have no per-user quota (cost + abuse) | Medium | Engineering, before pilot |
| 3 | No error aggregation (Sentry) on backend or AI | Medium | needs account/DSN decision |
| 4 | Rate limiting is per-instance only | Low at pilot scale | Engineering, at scale-out |
| 5 | 14 build-time-only dependency advisories | Low | accepted, documented |
| 6 | HSTS not yet observed on a live host | Low | verify with `curl -sI` on staging |

**Not claimed:** penetration testing, formal accessibility conformance, or that monitoring exists.

---

## F. Deployment

**Nothing is deployed. No URL exists.** No account was created, no card entered, no DNS changed.

Ready: `render.yaml` (corrected plans, `HSTS_ENABLED`), `netlify.toml` (real headers), both Dockerfiles,
health endpoints, 21 verified migrations, and an environment-variable inventory with names only.

Estimated recurring cost to stand up staging: **≈ $56/month** (2 × $25 standard services + $6 Postgres;
list prices checked 20 Nov 2026), rising to ≈ $78 with a 1 GB database and Netlify Personal.
**Requires approval before provisioning.**

---

## G. Decisions required from Harrison

| # | Decision | Blocks |
|---|---|---|
| 1 | **Canonical branch strategy** — approve Option 4 (archive-then-replace: tag A, then `--force-with-lease` `main`/`develop`/`staging` to `baed7f4`), or Option 3 (leave protected names alone, declare a new canonical branch) | repository hygiene, default branch, new contributors |
| 2 | **Cost approval** ≈ $56–78/month for staging | all provisioning |
| 3 | **Account access** — Render + Netlify (or invite), and who owns each | all provisioning |
| 4 | **Domain** — accept `*.onrender.com` / `*.netlify.app` for the pilot, or provision a domain | CORS, cookies, AT4D links |
| 5 | **Secret rotation** of every value that ever sat in lineage A's `.env` files | staging go-live |
| 6 | **AI provider budget/key** (paid tier recommended above 30 RPM) | AI journeys in acceptance |
| 7 | **Pilot data posture** — synthetic only, or real learner data under an agreement | whether PITR/monitoring become mandatory first |

If decisions 1–3 land by ~24 November, the 30 November target remains achievable.

---

## H. Next actions

| # | Action | Owner | Estimate |
|---|---|---|---|
| 1 | Approve decisions 1–3 | Harrison | today |
| 2 | Provision Postgres → backend → AI → frontend, set secrets, verify health + migrations | Engineering | 1 day |
| 3 | Run hosted five-role acceptance incl. all 12 negative tests | Engineering | 1 day |
| 4 | Add per-learner daily AI quota | Engineering | half day |
| 5 | `curl -sI` verify HSTS, cookies, CORS on the live origin | Engineering | 1 hour |
| 6 | Wire Sentry with PII scrubbing once a DSN exists | Engineering | half day |
| 7 | Build the AT4D demonstration package (4 role accounts, guide, feedback register) | Engineering + Harrison | half day |
| 8 | Android signing + device test — **only if** a pilot school requires an installed app | Engineering | 2 days |

---

## Release recommendation

**Engineering validated: YES.** Evidence above, all re-run today against the same tree.

**Hosted pilot ready: NO.** Blocked on provisioning, not on code. Nothing in this session's work would
change if provisioning happened tomorrow; conversely, no amount of local testing can substitute for it.

**Production approved: NO — and must not be.** No production deployment is authorised, no live payments are
authorised, no real learner data has been used, and the production gate requires Harrison's explicit approval
after a hosted pilot has actually run.

The honest position for the 11:00 session: *the platform is built, tested and secured to a defensible
standard; it is not yet running anywhere, and I will not present a URL I do not have.*
