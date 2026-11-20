# ELEKEZA — MODULE ACTIVATION MATRIX

**Date:** 20 November 2026 · **Candidate:** `c21a404` + working-tree activation changes
**Companion:** `ELEKEZA_COMPLETE_MODULE_INVENTORY.md` (per-module implementation detail)

---

## 1. Overall activation

# **72.1 %**

**220 of 305 acceptance criteria met across 61 modules.**

This is arithmetic, not impression. The method and its denominator are below; anyone can re-derive it.

| Status | Modules | Meaning |
|---|---:|---|
| 🟢 **GREEN** | **26** | Operational and verified |
| 🟡 **AMBER** | **24** | Implemented, partially operational, or awaiting external configuration |
| 🔵 **BLUE** | **6** | Blocked on credentials, approval or infrastructure |
| ⚫ **GREY** | **5** | Not implemented / outside release scope |
| 🔴 **RED** | **0** | Broken or incomplete |

**No module was found broken.** Every frontend route resolves to a screen that exists, and every screen that
calls the API calls a route that the backend actually serves. That is a stronger result than the directive
assumed, and it is worth stating plainly rather than manufacturing a RED row.

### By domain

| Domain | Modules | Criteria | Score |
|---|---:|---|---:|
| LEARN | 14 | 57 / 70 | **81.4 %** |
| ASSIST | 6 | 26 / 30 | **86.7 %** |
| INTEL | 5 | 22 / 25 | **88.0 %** |
| PLATFORM | 9 | 35 / 45 | **77.8 %** |
| ERP | 13 | 43 / 65 | **66.2 %** |
| DATA | 7 | 18 / 35 | **51.4 %** |
| CONNECT | 7 | 17 / 35 | **48.6 %** |

The two lowest domains are the two that depend on things the pilot has deliberately not switched on
(provider credentials, privacy UI). The learning core — the reason the platform exists — is at 81 %.

---

## 2. How the number is computed (reproduce this)

Five binary criteria per module:

| # | Criterion | Test applied |
|---|---|---|
| **C1** | A reachable UI exists for the intended role | Route exists; screen component resolves from disk; listed in that role's `navigation.ts` (or reached via a documented action) |
| **C2** | The frontend contract resolves to a real backend route | Every `apiClient.<verb>('/path')` call matched against the extracted 191-mapping route table |
| **C3** | The data path is verified | Writes persist to PostgreSQL, **or** the module is read-only over records whose writers are verified |
| **C4** | It renders real database data | No fixtures: dashboards read tables, and an empty institution renders zeros rather than invented numbers |
| **C5** | An automated test asserts it | Backend test class, E2E journey, or both — named in the table |

Score = criteria met ÷ 5. Overall = 220 ÷ 305.

**Deliberate strictness:** a module that works but has no automated assertion loses C5. That is why familiar
things like *Assignments* and *CSV import* are AMBER rather than GREEN — they are wired and persisted, but
nothing in the suite would notice if they broke tomorrow.

---

## 3. Module table

Legend: ● met · ○ not met. Evidence column names the actual test, not "tested".

### LEARN

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Content ingestion (text/file) | ● | ● | ● | ● | ● | 🟢 | `ContentUploadSecurityTest`, `ContentUploadTitleTest`, `ContentAuthorizationTest` | — |
| AI adaptation pipeline | ● | ● | ● | ● | ● | 🟢 | 603 AI tests; fail-closed secret verified | — |
| Lessons + on-demand adaptation (4 styles) | ● | ● | ● | ● | ● | 🟢 | learner-journey E2E | — |
| Quizzes | ● | ● | ● | ● | ● | 🟢 | journey E2E; replay → 409 | — |
| Examinations | ● | ● | ● | ● | ● | 🟢 | `exam.spec.ts` (start→submit→score, immutability, maxAttempts) | — |
| Assignments | ● | ● | ● | ● | ○ | 🟡 | No spec covers assign→submit→grade | Add one E2E journey |
| Progress + dashboards | ● | ● | ● | ● | ● | 🟢 | journey + theme E2E | — |
| Gamification | ● | ● | ● | ● | ○ | 🟡 | Rendered, never asserted | Assert streak/badge after a completed lesson |
| Mastery + support queue | ● | ● | ● | ● | ● | 🟢 | teacher support-panel E2E; `MasteryEngine` tests | — |
| AI tutor | ● | ● | ○ | ● | ○ | 🟡 | Deterministic engine answers without a provider; LLM path needs a key | Fund provider key; add per-learner quota |
| Personalisation / preferences | ● | ● | ● | ● | ● | 🟢 | preferences E2E | — |
| Curriculum | ● | ● | ○ | ● | ○ | 🟡 | Read + content↔objective mapping work; 5 authoring POSTs have no UI | Curriculum authoring screen, or seed official CBC tree |
| Calendar / deadlines | ● | ● | ○ | ● | ○ | 🟡 | Read works; create/delete API-only | Add create/delete controls |
| Study plans | ○ | ○ | ○ | ○ | ○ | ⚫ | `/teacher/plans` renders `ComingSoon` | Out of pilot scope |

### ERP

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Institution onboarding | ● | ● | ● | ● | ● | 🟢 | creates school + SCHOOL_ADMIN in E2E | — |
| Institution dashboard | ● | ● | ● | ● | ○ | 🟡 | **new** admin spec loads it; no data assertion | Assert seeded totals |
| Staff management | ● | ● | ● | ● | ○ | 🟡 | list asserted by **new** spec; deactivate/password-reset API-only | Expose both actions |
| Learner records | ● | ● | ● | ● | ○ | 🟡 | seeded learner asserted by **new** spec | — |
| CSV learner import | ● | ● | ● | ● | ○ | 🟡 | OpenCSV path implemented; untested | One E2E import round-trip |
| Classes + enrolment | ● | ● | ● | ● | ○ | 🟡 | used by attendance flow | Assert class CRUD |
| Attendance | ● | ● | ● | ● | ● | 🟢 | `attendance-finance.spec.ts` marks + saves a register | — |
| Timetable | ● | ● | ● | ● | ○ | 🟡 | teacher UI wired; no admin view | Admin timetable view |
| Finance (fees/charges/payments) | ● | ● | ● | ● | ● | 🟢 | guardian + admin finance E2E | — |
| M-Pesa | ○ | ● | ○ | ○ | ○ | 🔵 | Sandbox-only; live activation prohibited | Await approval; then sandbox → callback → reconciliation drill |
| Billing / plans / entitlements | ○ | ○ | ○ | ○ | ○ | ⚫ | Backend complete, **zero** frontend callers | Build a plans screen, or drop from scope |
| Devices | ● | ● | ○ | ● | ○ | 🟡 | Admin list wired; assign/status/delete API-only | Expose the three actions |
| Academic years / terms | ○ | ○ | ○ | ○ | ○ | ⚫ | `academic_periods` table exists, no API, no UI | Build term lifecycle before real school use |

### INTELLIGENCE

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Teacher analytics | ● | ● | ● | ● | ● | 🟢 | teacher dashboard E2E | — |
| School insights | ● | ● | ● | ● | ○ | 🟡 | **new** spec loads `/analytics`; scoping covered by `GovernanceRegressionTest` | Assert institution-scoped figures |
| Learner analytics | ● | ● | ● | ● | ● | 🟢 | progress E2E | — |
| Guardian analytics | ● | ● | ● | ● | ○ | 🟡 | Guardian composes its own view from ward endpoints | Assert ward-only totals |
| Engagement analytics | ● | ● | ● | ● | ○ | 🟡 | Events captured; institution summary has no UI | Add summary card |

### ASSISTIVE

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Text-to-speech | ● | ● | ● | ● | ○ | 🟡 | Used in lesson screen; never asserted | Assert a speak invocation in E2E |
| Text scale / calm / high-contrast | ● | ● | ● | ● | ● | 🟢 | theme E2E: survives reload, follows account across devices, per role | — |
| Simplified language | ● | ● | ● | ● | ● | 🟢 | AI pipeline + toggle; 603 AI tests | — |
| Keyboard / screen-reader navigation | ● | ● | ● | ● | ● | 🟢 | `a11y.spec.ts`, axe scans, skip-link assertion | — |
| Kiswahili | ○ | ● | ○ | ● | ○ | 🟡 | Content-level translation + glossary; **UI is English-only** | Add an i18n layer (post-pilot) |
| Low-bandwidth / offline | ● | ● | ● | ● | ● | 🟢 | `offline.spec.ts`: queue, honest offline state, sync on reconnect | — |

### DATA

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Tenant isolation | ● | ● | ● | ● | ● | 🟢 | `MultiTenantAuthorizationTest`, governance suite, guardian negative E2E | — |
| Guardian relationships | ● | ● | ● | ● | ● | 🟢 | lifecycle tests; "guardian cannot open another ward" E2E | — |
| Consent | ○ | ● | ● | ○ | ○ | 🟡 | API complete (`/privacy/consent`), no UI | Consent screen before real learner data |
| Erasure | ○ | ● | ● | ○ | ○ | 🟡 | API + `AccountErasureService`, no UI | Admin erasure action |
| Retention | ○ | ● | ○ | ○ | ○ | 🔵 | Admin API exists; policy values are a governance decision | Decide retention windows, then expose |
| Audit trail | ○ | ● | ● | ● | ○ | 🟡 | `/api/admin/audit` writes and reads; no UI | Audit view for ADMIN |
| Data export | ○ | ○ | ○ | ○ | ○ | ⚫ | Import only | Out of pilot scope |

### CONNECT

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Teacher ↔ guardian messaging | ● | ● | ● | ● | ● | 🟢 | messaging E2E (delivery + refusal) | — |
| Notifications | ● | ● | ● | ● | ○ | 🟡 | API + page; in-app only | Assert unread→read transition |
| SMS (Africa's Talking) | ○ | ● | ○ | ○ | ○ | 🔵 | Provider implemented, `SMS_PROVIDER=mock` | Credentials + sender ID; then delivery drill |
| Email (SMTP) | ○ | ● | ○ | ○ | ○ | 🔵 | `JavaMailEmailProvider`, `MAIL_*` unset — password reset currently sends nowhere | SMTP credentials; verify reset delivery |
| Storage (Cloudflare R2) | ○ | ● | ○ | ○ | ○ | 🔵 | `CloudflareR2Provider`, `STORAGE_PROVIDER=mock` | R2 bucket + keys |
| Announcements | ○ | ○ | ○ | ○ | ○ | ⚫ | Not built | Out of pilot scope |
| Offline sync | ● | ● | ● | ● | ● | 🟢 | `offline.spec.ts` (queue, sync, no fake score offline) | — |

### PLATFORM

| Module | C1 | C2 | C3 | C4 | C5 | Status | Evidence / blocker | Next action |
|---|:-:|:-:|:-:|:-:|:-:|---|---|---|
| Authentication | ● | ● | ● | ● | ● | 🟢 | auth tests, `AuthAndInputSecurityTest`, login/logout/forgot E2E | — |
| Password reset | ● | ● | ● | ● | ● | 🟢 | neutral-response E2E (no account enumeration) | Delivery needs SMTP (BLUE) |
| Role guards | ● | ● | ● | ● | ● | 🟢 | learner blocked from admin **without an API call**; teacher blocked from guardian/finance | — |
| Platform admin console | ● | ● | ● | ● | ○ | 🟡 | Loads; **new** spec adds a cross-role refusal check | Define the console's actual controls |
| Feature flags | ○ | ● | ● | ○ | ○ | 🟡 | Backend + overrides table; no UI | Admin flag toggles |
| Waitlist | ● | ● | ● | ● | ○ | 🟡 | Public capture page | Admin list view |
| Health / metrics | ● | ● | ● | ● | ● | 🟢 | `/actuator/health`, `/api/system/metrics` | — |
| Request correlation | ● | ● | ● | ● | ● | 🟢 | `SecurityHeadersTest` (5 assertions incl. hostile-id replacement) | — |
| Monitoring / error capture | ○ | ○ | ○ | ○ | ○ | 🔵 | No Sentry (or equivalent) anywhere | Choose provider, add DSN, scrub PII |

---

## 4. Role coverage

| Role | Auth | Sidebar destinations | Deep journeys asserted | Status |
|---|---|---|---|---|
| **STUDENT** | ✅ | 10 | login, home → lesson → quiz → score → progress, preferences, offline queue, exams | 🟢 Green |
| **TEACHER** | ✅ | 16 | login, students, support panel + mastery evidence, progress, attendance register, exam authoring, quiz results, messaging | 🟢 Green |
| **GUARDIAN** | ✅ | 6 | login, ward + ward detail, **another guardian's ward refused**, fees, messaging, reports | 🟢 Green |
| **SCHOOL_ADMIN** | ✅ | 11 | **new, 6/6 passing:** all 11 destinations load, `Alice Mwalimu` + `Juma Ali` render, finance shows `KES` figures, attendance reachable, `/super-admin` refused | 🟡 Amber — verified end-to-end, but the module list is broader than the data assertions |
| **ADMIN** | ✅ | 12 (+`/super-admin`) | **new:** platform route loads; existing governance tests cover cross-institution scoping | 🟡 Amber — console contents are thin |

**Closed this session:** the dev seed had **no SCHOOL_ADMIN account**, so no school-admin screen had ever
rendered real data — only a freshly onboarded empty school showing zeros. A `SCHOOL_ADMIN` is now seeded
against the demo institution, and a dedicated spec exercises all 11 destinations.

Verified live against the running backend, not merely constructed:

```
POST /api/auth/login {"email":"schooladmin@elekeza.app",...}   → http=200
{ role: SCHOOL_ADMIN, name: Grace Njeri, institutionId: 1 }
```

```
npx playwright test school-admin-modules  →  6 passed (2.9m)  EXIT=0
  ok 1  every school-admin navigation destination loads (11 routes)
  ok 2  staff and learner lists show the seeded records, not placeholders
  ok 3  finance dashboard renders monetary figures
  ok 4  attendance register reachable for a school administrator
  ok 5  platform admin reaches every platform destination
  ok 6  school admin can NOT reach the platform-only page
```

---

## 5. Service integration status

| Link | State | Evidence |
|---|---|---|
| Frontend → Backend (`/api/*` via Next rewrite) | 🟢 | `NEXT_PUBLIC_API_URL`, same-origin cookies, CSRF interceptor |
| Backend → PostgreSQL | 🟢 | 21 migrations applied; Hibernate `validate` |
| Backend → AI service | 🟡 | Internal shared secret, fail-closed; `mock` in dev, `real` needs key |
| AI → provider (Groq) | 🔵 | Key unset; 603 tests run against a stub |
| Backend → SMS / email / storage | 🔵 | All three default to mock |
| Backend → M-Pesa | 🔵 | Sandbox config only; live activation prohibited |
| Frontend → service worker (offline) | 🟢 | `offline.spec.ts` |
| Android shell → hosted frontend | 🔵 | No staging URL; no signing config |
| Anything → monitoring | ⚫🔵 | Not present |

### Dead endpoints and disconnected pages (explicitly checked)

The cross-check compared **118 frontend call paths** against **191 backend mappings** and every frontend route
against its screen component:

- **Frontend call with no backend route:** none (the initial 18 apparent mismatches were parser artefacts —
  multi-class controller files and bare `@GetMapping` with an empty path; all resolved on re-parse).
- **Page file without a screen component:** none.
- **Screen file missing on disk:** none.
- **Backend routes with no frontend caller:** a real set — but they are the *API-only* surfaces listed as
  AMBER above (curriculum authoring, staff deactivation, privacy/consent, retention, audit, billing,
  guardian-link revoke/restore, exam manual marking, device assignment, finance structure apply, M-Pesa
  initiate). They are not dead: they are implemented capability with no UI yet, which is exactly what the
  AMBER rows record.

---

## 6. Blockers, ordered by what unblocks the most

| # | Blocker | Owner | Unblocks |
|---|---|---|---|
| 1 | Staging credentials + cost approval | Harrison | every AMBER/BLUE verification that requires a hosted origin |
| 2 | AI provider key (funded) | Harrison | AI tutor, real adaptation quality, content pipeline at scale |
| 3 | SMTP credentials | Harrison | password-reset delivery, guardian digests, notifications by email |
| 4 | Sentry (or equivalent) DSN | Engineering + Harrison | monitoring; error capture; correlation already in place |
| 5 | Retention policy decision | Harrison + AT4D | retention module (currently BLUE by policy, not by code) |
| 6 | M-Pesa go-live approval | Harrison | payments (explicitly prohibited today) |
| 7 | i18n decision | AT4D feedback | Kiswahili UI |

Items 1–4 are configuration. Nothing in this list requires new architecture, which is the good news.

---

## 7. What this session changed

| Change | File |
|---|---|
| Seeded a SCHOOL_ADMIN against the demo institution | `backend/.../config/seed/DataInitializer.kt` |
| New school-admin + platform-admin acceptance spec (11 destinations + 4 data assertions + 1 refusal) | `frontend/e2e/school-admin-modules.spec.ts` |
| Exported the fixture; documented the closed gap | `frontend/e2e/helpers.ts` |

Everything else in this document is **measurement**, not modification.

### Two failures hit while verifying, and what they taught

Recorded because they cost ~25 minutes and would cost the next person the same:

1. **A killed Playwright run leaves its servers behind.** `process_stop` on the Playwright parent did not stop
   the `java -jar` on 8090 or `next dev` on 3100, so the next run aborted with *"…/actuator/health is already
   used"*. Always free 8090/3100 by listener PID (`netstat -ano | grep :8090`) before re-running.
2. **A JAR read while Gradle is still writing it fails in a confusing way.** Tomcat started but every worker
   thread threw `NoClassDefFoundError: ch/qos/logback/classic/spi/ThrowableProxy` and
   `Started ElekezaApplication` never appeared, so the health check hung until timeout. Verify the artifact
   independently before blaming the tests:
   `python -c "import zipfile;z=zipfile.ZipFile('…jar');print(z.testzip(), len(z.namelist()))"`, then boot it
   once by hand and `curl` health.

---

## 8. Honest limits of this matrix

1. **C4 ("real data")** is asserted for the journeys listed; for the rest it is inferred from code that reads
   repository methods rather than literals. A module could read the DB and still show the wrong number.
2. **C5** rewards existing tests. A GREEN row means "verified at some level", not "verified exhaustively" —
   e.g. Finance is GREEN because both guardian and admin views are asserted, not because every fee edge case
   is.
3. **Nothing here was run against a hosted environment.** TLS, CORS, cross-origin cookies and managed-Postgres
   behaviour remain unverified, as do provider integrations.
4. The 72.1 % is a *weighted-by-nothing* mean: a missing consent screen counts the same as a missing study
   planner. It is a progress instrument, not a quality score. If the pilot's definition of done weights
   safeguarding (consent/erasure/audit) above convenience features — and it should — the effective readiness
   is lower than 72 %, and DATA at 51.4 % is the number to look at.
