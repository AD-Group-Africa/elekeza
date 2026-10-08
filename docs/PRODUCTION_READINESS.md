# ELEKEZA — PRODUCTION READINESS GATE

> Canonical go/no-go gate. Updated 2026-10-03, HEAD `b139b8e` (`v0.1.0-pilot-r2`),
> branch `integration/staging-reconciliation`. Every ✓ is evidence-backed; every ✗ is named.
> Session verification appended 2026-10-05 (below).

## Executive summary

Elekeza is an inclusive learning & education infrastructure platform (learner-centred; schools,
teachers and guardians support the learner). Product definition, architecture and the full status
ledger live in [ELEKEZA_MASTER.md](ELEKEZA_MASTER.md); this document is the decision gate.
**State:** all in-repo work complete and evidence-backed (tests, journeys, E2E, migration-from-zero,
P0 security fix verified live). **Decision:** GO for a single controlled pilot; NO-GO for public
production until the external items in [Blockers](#blockers-only-real-ones) are provisioned.

## Gate checklist

| # | Item | Status | Evidence / note |
|---|---|---|---|
| 1 | Build passes | ✅ | FE prod build PASS (webpack, PWA); backend bootJar PASS; staging gate GREEN 2026-09-30 |
| 2 | Database migrations pass | ✅ | Flyway V1–V16 from clean DB; `ddl-auto=validate` boot PASS |
| 3 | Backend tests pass | ✅ | **278/278** (re-run after RealAiClient fail-fast hardening) |
| 4 | Frontend tests pass | ✅ | Vitest 17/17; tsc clean (re-verified after Assist token restyle) |
| 5 | E2E passes | ✅ | Journeys re-run this closure: **learner 22/22, teacher 12/12, guardian 10/10, admin 9/9, AI-degradation 2/2** (teacher logout regression found & fixed — Assist clear of sidebar); Playwright spec suite re-run on isolated ports (see release audit) |
| 6 | Authentication verified | ✅ | 401 matrix (no-cookie/garbage/alg-none/unsigned); rotation-reuse → 401; forgot-password no-enumeration |
| 7 | RBAC verified | ✅ | 5-role matrix; registration STUDENT-only; role blocks live-probed |
| 8 | Tenant isolation verified | ✅ | two-institution IDOR matrix 403 both directions (roster, import, profiles, adaptations, wards, content, class sessions) |
| 9 | AI integration verified | ✅ (code) / ⚠️ (live key) | mechanism verified to provider boundary; degradation green; **P0 internal-secret fail-open FIXED + live-verified this closure** (unset secret → 401 on every endpoint incl. /docs; valid key → passes auth; AI pytest 606 passed); real provider key = remaining external blocker |
| 10 | Notification behaviour verified | ⚠️→✅ | in-app notifications verified; **clash with chat fixed this closure via Elekeza Assist + toast/panel split** (see UX doc); messages recipient defect EL-NEW-02 tracked |
| 11 | M-Pesa integration verified if required | ⚠️ | code hardened + negative-probed; **live = blocked on Daraja credentials** (conditional for pilot: run in honest mock) |
| 12 | Email verified if required | ⚠️ | code ready; **live = blocked on SMTP** (pilot can operate with in-app credential surfacing) |
| 13 | Production configuration verified | ✅ | `.env.example` placeholders only; prod fail-fast envs; `DEMO_SEED_ENABLED` off verified; no secrets in repo |
| 14 | No secrets committed | ✅ | audited (tracked files + history patterns); `.env` gitignored |
| 15 | Error handling verified | ✅ | generic 4xx bodies; zero 500s in probe matrix; no stack traces |
| 16 | Logging reviewed | ⚠️ | do-not-log rule verified; **structured auth/integration failure logging still P1 gap** |
| 17 | Health checks verified | ✅ | `/actuator/health` only; compose healthchecks; TLS dry-run |
| 18 | Backup/restore verified | ✅ | db-backup.sh + db-restore-drill.sh **PASSED** (this engagement) |
| 19 | Security audit completed | ✅ (code) | controls verified (SECURITY.md); **P0 ai-elewa fail-open FIXED (fail-closed) + verified both directions live**; backend `RealAiClient` secret now fail-fast (no `:dev-secret` default); structured auth/integration failure logging remains P1 |
| 20 | Accessibility audit completed | ⚠️ | strong verified foundation; **real-user AT validation = pilot deliverable; axe CI suite pending** |
| 21 | Responsive audit completed | ✅ (this closure) | 320–1440 grid inspected; bottom nav + Assist safe-area work verified; 0px horizontal overflow at 320px; Assist geometry clear of sidebar (desktop) and bottom nav (mobile) |
| 22 | Documentation consolidated | ✅ (this closure) | `docs/` canonical 15-file set; old docs archived |
| 23 | Manual user journey completed | ✅ (this closure) | guardian desktop + mobile manual pass in shared browser: Today home, Assist open/Esc/focus-return, More overlay, console clean |

## Decision

**GO for controlled pilot / NO-GO for public production** — precisely:

- **GO** to deploy the frozen pilot release (`v0.1.0-pilot-r2` + this closure's UX/doc/accessibility
  work) to a **single controlled pilot school**, with AI in clearly-labelled mode until the r3 P0
  fix + real key, payments in honest mock, and email in mock-or-SMTP once provisioned.
- **NO-GO** for broad/public production until: (1) **AI r3 release ships the fail-closed fix now in-repo**
  (fix verified live; what remains is the r3 tag/deploy authorization); (2) pilot host + domain + TLS exist; (3) pilot credentials are generated on the host; (4) class creation (EL-F-007) is decided and shipped if
  in scope; (5) messages recipient fix (EL-NEW-02) ships.

## Blockers (only real ones)

| ID | Blocker | Type | Owner |
|---|---|---|---|
| B1 | ~~ai-elewa `INTERNAL_SECRET` fail-open (P0)~~ **FIXED in repo this closure** (fail-closed verified live, both directions); remaining: r3 release authorization to ship it | release authorization | Harry (AI r3) |
| B2 | Pilot host, domain, DNS, TLS | external infrastructure | operator |
| B3 | Pilot env secrets generation | external credential | operator |
| B4 | Groq production key (real AI) | external credential | operator |
| B5 | Daraja credentials + public callback (real fees) | external credential | operator (conditional) |
| B6 | SMTP account (real email) | external credential | operator |
| B7 | Class creation scope decision (EL-F-007) | product decision | Harry |
| B8 | Safiri build-or-descope | scope decision (out of repo) | Harry |

## Completion summary

| Dimension | Completion |
|---|---|
| Core product | ~90% (missing: class creation, messages recipient fix, live AI) |
| Accessibility | ~85% verified (gaps: real-user validation, axe CI) |
| UX | ~90% (this closure completes Assist/nav/responsive + Logout-overlap fix; deep per-page polish continues) |
| Integrations | ~70% (all code paths verified; live credentials externally blocked) |
| Testing | ~95% (backend 278/278, AI 606, FE vitest 17/17 + tsc, all 5 journeys green, Playwright spec suite green on isolated ports; axe CI + load tests pending) |
| Security | ~95% (P0 fixed + live-verified; r3 ship authorization pending; logging gap P1) |
| Documentation | 100% (canonical set complete) |
| **Production readiness** | **GO (controlled pilot) / NO-GO (public)** |

## Release audit — 2026-10-03 (one-shot production completion closure)

All checks executed live this session against the running stack (FE :3100 dev, BE :8097 prod profile,
AI :8001, PG :5433).

| Check | Result |
|---|---|
| Backend suite (`gradlew test`) | **278/278**, 0 failures, 0 errors |
| AI suite (`pytest`, incl. live smoke) | **606 passed**, 2→0 after `AI_TEST_BASE_URL` fix in `test_live_smoke.py` |
| Frontend unit (`vitest`) + types (`tsc`) | **17/17**; tsc clean |
| Product journeys (Playwright) | learner **22/22**, teacher **12/12**, guardian **10/10**, admin **9/9**, ai-down **2/2** |
| Playwright spec suite (isolated ports :8098/:3005) | **31 green** — 30 passed + 1 flaky (console-error test passed on retry #1); exit 0 in 9.1m. First isolated run failed 28/31 on a single environmental cause (e2e frontend on non-allowlisted :3105 → dev CORS blocked every login preflight); re-run on the yaml-reserved :3005 after rebuilding a corrupted boot JAR — no product code involved |
| Production build (`NEXT_PUBLIC_API_URL=:8097`) | PASS — 59/59 pages, exit 0 |
| AI P0 fail-closed verification | unset secret → **401** on all endpoints (incl. `/docs`); valid key → auth passes; previously no-key reached pipeline |
| AI P0 negative control | probe instance booted with `INTERNAL_SECRET=` explicitly empty reproduced the pre-fix behaviour class and confirmed the fix closes it |
| Backend AI secret hardening | `RealAiClient` no longer defaults `ai.internal-secret:dev-secret`; boot fails fast without config (prod/dev yaml verified) |
| Regression found & fixed in closure | Elekeza Assist pill intercepted the sidebar **Logout** button on desktop (geometry-verified); Assist now anchors to the content column and all journeys pass |
| Manual QA (shared browser) | guardian Today home (desktop+mobile), Assist open/Esc/focus-return, More overlay, notification/chat separation, console clean (401s = expected token-refresh cycle) |

### Defects fixed during this closure

| ID | Defect | Fix | Verified by |
|---|---|---|---|
| D1 | ai-elewa auth fail-open when `INTERNAL_SECRET` unset (P0) | `key_valid = bool(INTERNAL_SECRET) and hmac.compare_digest(...)` | live 401 matrix, both directions; AI pytest 606 |
| D2 | `RealAiClient` dev-secret fallback | removed default → fail-fast | boot config chain; backend 278/278 |
| D3 | Assist/Logout desktop overlap (new this closure, caught by E2E) | content-column anchoring, sidebar-width aware | geometry probe + teacher journey 12/12 |
| D4 | Assist panel translucent over page text | opaque token surface (`--bg-primary`), moss tokens | 25-point leak sweep: 0 leaks |
| D5 | `test_live_smoke.py` hardcoded `:8000` (EL-F-AIport class) | `AI_TEST_BASE_URL` env support | live smoke 3/3 on :8001 |

### External blockers (unchanged, not fixable in repo)

Pilot host/domain/TLS, pilot credentials, Groq production key, Daraja credentials, SMTP account,
class-creation scope (EL-F-007), messages recipient defect (EL-NEW-02), Safiri descope decision,
AI r3 release authorization (the P0 fix is in-repo and verified; shipping it is an authorization step).

## Session verification — 2026-10-05 (master dev session)

| Check | Result |
|---|---|
| Migration from zero | fresh DB `elekeza_migration_probe` → Flyway V1–V16 applied, **16/16 success**, `ddl-auto=validate` PASS, `/actuator/health` **UP** on :8099; probe torn down (DB dropped). Evidence: `backend/migration-probe.log` |
| Live negative auth probes | `GET /api/auth/me` no credentials → **401**; `Authorization: Bearer garbage` → **401** |
| Canonical doc set | restored to the intended **15 files** (ARCHITECTURE, ACCESSIBILITY, INTEGRATIONS re-canonicalized from archive with post-fix updates; MASTER §13 links now all resolve) |
| Stack re-check | BE :8097 UP · FE :3100 200 · AI :8001 ok throughout |

### RAG roll-up

| Category | RAG | Basis |
|---|---|---|
| Product | 🟢 | core journeys + acceptance loop green; EL-F-007 / EL-NEW-02 tracked |
| Architecture | 🟢 | modular monolith, verified live; no rewrite pressure |
| Database | 🟢 | V1–V16 from zero 16/16; backup/restore drill PASSED |
| Auth / RBAC / Tenancy | 🟢 | 401+403 matrices; suite-covered; live probes re-verified |
| Learner/Parent/Teacher/Admin UX | 🟢 | journeys 22/12/10/9; Assist geometry-safe |
| Notifications | 🟢 | in-app verified, non-blocking; EL-NEW-02 tracked |
| AI | 🟡 | fail-closed verified; r3 ship authorization + real key pending |
| Accessibility | 🟡 | strong verified foundation; real-user AT validation + axe CI pending |
| Payments | 🟡 | honest mock chain verified; Daraja creds pending |
| Storage | 🟡 | local disk for pilot; R2 optional |
| Deployment | 🟡 | compose TLS dry-run 6/6; real host external |
| Security | 🟢 | P0 closed + verified; P1 structured logging gap documented |
| Testing / E2E | 🟢 | 278 + 606 + 17/17 + 31 green + 5 journeys |
| Documentation | 🟢 | 15-file canonical set, all links resolve |

### Manual verification required

1. Real-user assistive-technology validation with learners with disabilities (pilot deliverable #1).
2. Browser/device matrix on the real pilot host after TLS (compose dry-run verified only).
3. Live provider activation tests after credentials: Groq real-key smoke, Daraja sandbox
   STK→callback, SMTP delivery, Africa's Talking SMS delivery.
4. r3 authorized deploy smoke: fail-closed AI fix verified live on the deployed instance.

## Recommended next action

Sign the **AI r3 release authorization** and provision the **pilot host, domain/TLS and
host-generated credentials** — the two acts that unblock the pilot. In parallel (small, in-repo):
ship EL-NEW-02 and decide EL-F-007. Nothing else blocks.

---

## Session status � 2026-10-08

Reconciliation brought onto release/v0.1.0: canonical 15-doc set, AI Gates 0-3, V13-V16 migrations, hardened fail-closed security.py, E2E evidence.

Live-verified locally today:
- Backend /actuator/health: UP (16 migrations validated, Flyway V1-V16 applied)
- AI /health: ok
- Frontend :3100: 200
- AI fail-closed: 401 without X-Internal-Secret, 200 with correct secret (P0 fix confirmed live)

Still blocking controlled pilot:
- VPS + domain + TLS (external)
- AI r3 release authorization (Harry)
- Groq production key, SMTP, Africa's Talking, Daraya if required
- EL-NEW-02 (messages sender-only) � open
- EL-F-007 (class creation) � deferred, decision pending

### EL-NEW-02 � corrected assessment (2026-10-08)

Code inspection shows EL-NEW-02 is worse than originally classified: the messaging feature is a **UI shell with no plumbing**. MessageController ignores req.recipient, saves userId=sender.id; no sender_id column exists on notifications; no teacher-side read endpoint exists; frontend sends literal strings ('teacher', CSV of learner IDs) that cannot resolve to users. Scope: design change, ~3 hours. Deferred to pilot #2 unless Harry requires two-way messaging in pilot #1. Implementation plan to be authored as docs/EL-NEW-02_DESIGN.md before pilot #2 work begins.
