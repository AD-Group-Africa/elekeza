# ELEKEZA — MASTER DOCUMENT

> **Single source of truth.** Consolidated 2026-10-03 on branch `integration/staging-reconciliation`
> (HEAD `b139b8e` = tag `v0.1.0-pilot-r2`). Where any other document disagrees with this file,
> **this file wins**. Evidence lives in `release-evidence/` and `e2e-evidence/`; per-domain detail
> lives in the sibling canonical docs listed at the bottom.

---

## 1. Product identity

**Elekeza** *(“to understand” in Swahili)* is an **inclusive learning and education infrastructure
platform**. It helps learners access learning in ways that work for them, while connecting learners,
guardians, teachers, and schools around meaningful educational progress.

Elekeza is **not** merely an AI tutor, LMS, ERP, chatbot, or assistive-technology demo. It is the
combination of: **accessible learning + learner support + school operations + guardian connection +
educational intelligence** — with the learner at the center, never dissolved into school software.

One-sentence definition:

> Elekeza is an inclusive learning and education infrastructure platform that helps learners access
> learning in ways that work for them while connecting learners, guardians, teachers, and schools
> around meaningful educational progress.

**What Elekeza is NOT (scope guards):** it does not diagnose disabilities, does not replace teachers,
guardians, therapists or medical professionals, and does not make clinical claims. **Safiri
(transport) is a separate product** and is intentionally absent from this codebase.

---

## 2. Users

| Role | Their question | Their space |
|---|---|---|
| **STUDENT (learner)** | “Can I access learning in a way that works for me?” | Learner home, lessons, quizzes, progress, How I Learn, Elekeza Assist |
| **GUARDIAN** | “Can I understand how my child is learning and support them?” | Guardian dashboard (ward-scoped Today view), progress, fees, communication |
| **TEACHER** | “Can I understand this learner and support them effectively?” | Class/students, assignments, attendance, learning-support summaries |
| **SCHOOL_ADMIN** | “Can we provide inclusive learning while managing the institution properly?” | Own-institution operations: learners, staff, classes, finance, settings |
| **ADMIN (platform)** | Cross-institution platform administration | Cross-school oversight, platform analytics |

Relationship models supported: **A** independent learner, **B** learner + guardian,
**C** school + teacher + guardian around the learner (the core ecosystem).

---

## 3. Architecture (actual)

Modular monolith, one repo:

```
Browser / PWA  ──HTTPS──  Next.js frontend (TypeScript, Tailwind, next-pwa, Capacitor shell)
                              │  same-origin /api proxy
                              ▼
                     Spring Boot 3.2 backend (Kotlin) — JWT httpOnly cookies,
                     CSRF double-submit, RBAC, institution-scoped tenancy
                        │                │                    │ X-Internal-Key
                        ▼                ▼                    ▼
                 PostgreSQL 15/16   Provider-abstracted    FastAPI ai-elewa
                 (Flyway V1–V16)    email/SMS/storage       4-stage AI pipeline
                                    (mock|javamail|AT|R2)   → Groq/OpenAI/Anthropic/Google
```

- Frontend: `frontend/` — Next.js App Router, PWA service worker, role-scoped routes.
- Backend: `backend/` — package-per-domain under `com.elekeza.backend` (auth, institution, content,
  quiz, learner, personalization, guardian, teacher, notification, payments/finance, support,
  analytics, calendar, waitlist, accessibility).
- AI: `ai-elewa/` — FastAPI, stage1 profile → stage2 simplify → stage3 verify → stage4 concepts;
  internal-secret authenticated; deterministic fallbacks everywhere.
- Docker: `docker-compose.yml` (postgres, redis, backend, ai-service, frontend, nginx) +
  `docker-compose.tls.yml` (opt-in TLS override, verified end-to-end dry-run).

---

## 4. Current implementation — status ledger

Classification: **IMPLEMENTED+VERIFIED (IV)** — executed against the running stack this engagement ·
**IMPLEMENTED+NOT FULLY VERIFIED (INV)** · **PARTIAL (P)** · **DESIGNED ONLY (D)** ·
**BLOCKED BY EXTERNAL DEPENDENCY (B)** · **POST-MVP (PM)** · **REMOVED/OBSOLETE (O)**.

| Capability | Status | Notes / evidence |
|---|---|---|
| Auth: register (STUDENT-only self-registration), login, refresh rotation, logout, forgot/reset | IV | 278/278 backend suite; 401 matrix (no-cookie/garbage/alg-none/unsigned → 401) |
| Institution registration → SCHOOL_ADMIN | IV | `POST /api/institutions/register` → 201; E2E journey act 1 |
| CSV learner import (+guardian linking, one-time credentials surfaced to school) | IV | 8-column template; import result returns learner logins panel in UI |
| Staff management (create/reactivate, one-time temp password, password reset) | IV | temp password shown once in create response (fix r2) |
| RBAC + object-level authorization | IV | 403 matrix: cross-tenant institutions/{id}/students+staff, class session, guardian ward, content |
| Tenant isolation (IDOR/BOLA) | IV | live two-institution probes → 403 both directions; automated suites |
| Content upload (text/PDF/DOCX) → AI simplification → lessons | IV | acceptance journey: AI content step green |
| Quiz engine (server-scored, no answer key leakage, review own attempts) | IV | learner journey quiz score verified (20.0 step); 409 on duplicate attempt |
| Personalization (How I Learn; EXPLICIT>TEACHER>GUARDIAN>OBSERVED>SYSTEM; 409 on override) | IV | personalization suites + live journey evidence |
| Adaptive simplification (deterministic, curriculum-preserving, cached) | IV | `source=LOCAL/CACHE` verified; AI path validated + safe fallback |
| Guardian ward view (linked wards only, plain-language learning support) | IV | guardian journey 10/10; cross-family ward → 403 |
| Teacher students/assignments/attendance/quiz analytics | IV | teacher journey 12/12 |
| Attendance register (class sessions, history) | IV | attendance page + backend tests; light-theme outlier documented in UX doc |
| Notifications (in-app, mark-read, link navigation) | IV (with P1 gap) | see EL-NEW-02 below |
| Guardian/teacher messages | **P — known defect EL-NEW-02** | messages stored sender-only (`MessageController` saves `Notification(userId=sender)`, recipient ignored) |
| Classes | **P — EL-F-007** | classes exist only via seed/demo; no class-creation UI/API for admins — blocked pending scope decision (Harry) |
| M-Pesa fees (STK push, idempotent callback, ledger, revenue) | IV code / B live | negative-probed (forged callback rejected); real Daraja credentials = external blocker |
| Email/SMS/storage providers | IV code / B live | mock by default, honestly labelled; activation config-only |
| AI (real provider) | IV to provider boundary / B key | Groq key 401'd honestly in prior audit; pipeline verified; **P0 fail-open FIXED + live-verified (see §8)**; r3 ship authorization pending |
| Offline PWA | IV reads / PM writes | service worker caches lessons/adaptations/preferences; offline answer queue exists; no queued sync for preference writes |
| Exams/CBT, marketplace, government portal, therapist portal, subscriptions engine | D → PM | explicit Coming-Soon placeholders; nothing to attack; Q1-2027 roadmap |
| Google OAuth | O | legacy comment only; no such class exists — email+password only |
| Safiri / transport | O | separate product, absent by scope decision |
| Docker TLS deployment path | IV (dry-run) | 6/6 services healthy, HTTPS 200, HTTP→HTTPS 301, 15/15 migrations, users=0 with seed gate off |
| Backup/restore | IV | `scripts/db-backup.sh` + `scripts/db-restore-drill.sh` executed PASSED (this engagement) |

---

## 5. Verified functionality (this engagement, HEAD b139b8e)

| Gate | Result |
|---|---|
| Backend (JUnit/Kotlin) | **278/278** |
| E2E (Playwright) | **31/31** |
| Journey scripts (API+UI) | learner 22/22 · teacher 12/12 · guardian 10/10 · admin 9/9 · AI-degradation 6/6 |
| Acceptance journey (`frontend/scripts/product-closure/pilot-acceptance.sh`) | **PASS end-to-end** (school → admin → teacher → CSV learner+guardian → AI content → assign → learner quiz → AI tutor → guardian 403 isolation → notification → admin analytics) |
| DB integrity | zero orphans/duplicates; restore drill PASSED |
| Staging gate (`scripts/staging-gate.sh`) | **GATE PASSED** (2026-09-30) |
| Security probes | 401 matrix, 403 role+object matrix, 429 after 5 bad logins, CSRF on all mutating POSTs, zero 500s |
| Evidence | `release-evidence/` (8 docs, 11 screenshots, 6 recordings), `e2e-evidence/` (78 shots, 6 videos, console/network logs, DB verifications) |

Honestly blocked journeys: class creation (EL-F-007) and Safiri (absent by design).

---

## 6. Integrations

See [INTEGRATIONS.md](INTEGRATIONS.md) for the full matrix. Summary:

- **Connected & verified:** PostgreSQL (Flyway), internal AI service auth (mechanism), mock
  providers for email/SMS/storage (clearly labelled).
- **Code-complete, blocked on credentials:** M-Pesa Daraja, Africa's Talking SMS, SMTP email,
  Cloudflare R2, Groq production key (pipeline verified to the provider boundary; real key 401'd
  honestly in the 2026-09-08 chain proof).
- **Provisioned but unused:** Redis (compose provides it; backend rate limiting is in-process).
- **Dormant:** Google OAuth (does not exist in code — treat any claim otherwise as obsolete).

---

## 7. External dependencies (all operator-supplied)

| # | Dependency | Unblocks |
|---|---|---|
| 1 | Pilot host + domain + DNS + TLS | real deployment (runbook ready) |
| 2 | `JWT_SECRET`, `AI_INTERNAL_SECRET`, `DB_PASSWORD` for pilot env | secure boot |
| 3 | Groq API key (`AI_API_KEY`) | real AI adaptation |
| 4 | Daraja credentials + public HTTPS callback | real fee collection |
| 5 | SMTP account | real email (invites, resets) |
| 6 | Africa's Talking key (optional) | SMS notifications |
| 7 | Cloudflare R2 keys (optional) | persistent uploads |
| 8 | Harry decisions: AI r3 security fix authorization; class-creation scope; Safiri build-or-descope | AI P0 fix ship; EL-F-007; scope |

---

## 8. Security (actual)

Verified controls: JWT httpOnly cookies + rotated hashed refresh tokens, BCrypt passwords, CSRF
double-submit on all mutating endpoints (narrow exempt list incl. M-Pesa callback), login rate limit
5/60s → 429, explicit CORS (wildcard refused at boot), server-side tenancy on every scoped call,
upload hardening (10 MB, allow-list, flattened names — traversal fix verified), security headers
(`frame-ancestors 'none'`, `nosniff`, `DENY`, `no-referrer`), no secrets in repo, no secrets/PII in
logs (audited), honest 4xx errors (no stack traces).

**P0 FIXED (verified live, 2026-10-03 closure):** `ai-elewa/security.py` — `INTERNAL_SECRET` empty no
longer authenticates anything (fail-closed: every endpoint incl. `/docs` → 401 when unset; valid key
passes; AI pytest 606 green). Backend `RealAiClient.kt` / `AiWebClientConfig.kt` `dev-secret`
fallbacks removed (boot fail-fast). Remaining: **AI r3 release authorization to ship** (Harry).
Detail: [SECURITY.md](SECURITY.md).

---

## 9. Accessibility (actual)

Assistive technology is Elekeza's founding identity — and it is real, not marketing:

- **How I Learn** per-learner presentation profile: density, text size, contrast, explanation style,
  example frequency, visual support, read-aloud — source-labelled (EXPLICIT/TEACHER/GUARDIAN/
  OBSERVED/SYSTEM), learner always outranks inference.
- **Deterministic curriculum-safe adaptation**: ORIGINAL / CLEARER / STEP_BY_STEP / SPACED / DETAILED;
  never invents facts, never drops key terms (`AdaptationSafety`); original always one click away.
- **TTS** read-aloud (Web Speech API), gated by learner preference (serverTts fix r2).
- 40+ accessibility toggles (fonts incl. OpenDyslexic, spacing, themes, calm mode), learner
  localStorage system + server `/learner/preferences` persistence.
- WCAG 2.1 AA-oriented: skip links, `aria-current`, focus-visible rings, reduced-motion, semantic
  HTML, role="alert"/status, no colour-only meaning, dignity language enforced by backend tests
  (diagnostic-phrase blacklist).
- Honest gaps: no automated axe suite in CI; no real-user AT validation yet (pilot deliverable).

Detail: [ACCESSIBILITY.md](ACCESSIBILITY.md). **No clinical claims anywhere.**

---

## 10. AI (actual)

- Chain: Next.js → backend `AiClient` (`RealAiClient`|`MockAiClient`) → ai-elewa FastAPI
  (`X-Internal-Key`) → provider (Groq/OpenAI/Anthropic/Google).
- ai-elewa 4-stage pipeline with retry-with-correction; output schema-validated
  (`LessonJSON`/`QuizJSON`); failures surface honestly (`SCHEMA_INVALID`, learner-safe messages);
  no layer fakes success.
- Personalization AI path sends **neutral learner context + content text only** (no SNE labels, no
  PII beyond teacher-authored content); output screened for diagnostic phrasing before
  cache/display.
- Mock mode is deterministic and clearly labelled; ai-elewa fails fast at boot on a non-real
  provider — mock can never silently ship to prod. **The historic P0 fail-open exception is fixed
  (fail-closed, 2026-10-03) — no exceptions remain.**
- Every AI-generated insight originates from actual stored data; AI never invents learner
  performance.

Detail: [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

---

## 11. Production status

**READY FOR CONTROLLED PILOT — conditional on external configuration.** All in-repo code, tests,
migrations, security controls and the deployment path are verified. Open items are operator-supplied
(host/domain/TLS, credentials) plus the AI r3 release authorization (the P0 fix is in-repo and
live-verified) and product gaps (class creation EL-F-007, messages EL-NEW-02). The complete gate lives in
[PRODUCTION_READINESS.md](PRODUCTION_READINESS.md); deployment in [DEPLOYMENT.md](DEPLOYMENT.md);
pilot ops in [PILOT.md](PILOT.md).

---

## 12. Remaining work (explicit)

**In-repo (this session / next):** ~~AI P0 fail-open fix~~ **DONE (fixed + live-verified; r3 ship
authorization remains)**, messages
recipient fix (EL-NEW-02), class-creation decision implementation (EL-F-007), Elekeza Assist +
navigation/UX closure **DONE (2026-10-03: Assist + mobile bottom navs + guardian Today home +
Logout-overlap fix; journeys all green)**, axe CI suite, structured auth/integration
failure logging.

**External (blockers):** §7 table.

**Post-MVP:** exams/CBT, subscriptions engine, per-subject preference scoping, offline write
sync-queue, therapist portal, marketplace, government portal, real-user accessibility validation
programme, Redis-backed rate limiting for multi-instance.

---

## 13. Canonical documentation set

| Document | Contents |
|---|---|
| [ELEKEZA_MASTER.md](ELEKEZA_MASTER.md) | this file — the entry point |
| [PRODUCT.md](PRODUCT.md) | product definition, user models, experience promises |
| [ARCHITECTURE.md](ARCHITECTURE.md) | system shape, domains, request flows |
| [DOMAIN_MODEL.md](DOMAIN_MODEL.md) | entities, identities, tenancy, data governance |
| [API.md](API.md) | endpoint reference (verified routes) |
| [SECURITY.md](SECURITY.md) | security model, controls, open P0, privacy |
| [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) | AI chain, pipeline, safety, limits |
| [INTEGRATIONS.md](INTEGRATIONS.md) | provider matrix, credentials, failure behaviour |
| [UX_AND_DESIGN_SYSTEM.md](UX_AND_DESIGN_SYSTEM.md) | roles, navigation, colour system, Elekeza Assist |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | assistive identity, WCAG status, honest gaps |
| [TESTING.md](TESTING.md) | suites, gates, how to run, no-fake-passing rules |
| [DEPLOYMENT.md](DEPLOYMENT.md) | local, staging gate, production runbook |
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | the go/no-go gate with evidence |
| [PILOT.md](PILOT.md) | pilot scope, ops, escalation, role guides |
| [CHANGELOG.md](CHANGELOG.md) | release history |

Historical/superseded material: `docs/archive/` (provenance only — includes the old per-domain
doc sets, production/acceptance/security packs, and the AD Group portfolio strategy material for
other products, which is **not part of Elekeza scope**).
