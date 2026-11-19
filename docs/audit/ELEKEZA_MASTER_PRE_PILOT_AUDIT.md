# ELEKEZA — MASTER PRE-PILOT AUDIT

**Date:** 14 Nov 2026
**Repository:** `C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza` (Git, remote `AD-Group-Africa/elekeza`)
**Branch:** `sprint-3-safe-config`
**HEAD:** `47d17f510dd742919f956696506babe76cd5a561` — `fix(elekeza): make guardian messaging accessible and verify delivery`
**Mode:** read-only audit. **No application source, configuration, migration, environment file or deployment was modified.**
**Audience:** Harrison, Victor, Alvin, and the review meeting.

---

## 0. Preservation record (what this audit found, and what it did not touch)

### Git state at audit time
- Branch `sprint-3-safe-config`, HEAD `47d17f5`, upstream `origin/sprint-3-safe-config` (**1 local commit ahead, 0 behind** — `47d17f5` was committed earlier in this engagement and **not pushed**).
- **4 stashes intact:** `{0}` reconciliation WIP, `{1}` filter-branch rewrite, `{2}` staging pre-built jar, `{3}` gradle build artifacts.
- **7 modified, 2 staged-new, 7 untracked** paths. See §1.3.

### Changes that appeared since the last review
Working-tree changes not present at the previous review, **recorded and left untouched**:
- `frontend/next.config.ts` — `allowedDevOrigins: ['192.168.1.25']` (LAN testing) **plus a UTF-8 BOM and mojibake** (`â€”`) from a Windows encoding round-trip.
- `backend/src/main/resources/application-dev.yaml` — CORS origin `http://192.168.1.25:3100` added.
- `backend/src/main/resources/application-dev.yaml.bak` — a stray backup file (untracked).
- `frontend/public/sw.js` — regenerated precache manifest.

These are local-development edits. They are **not** part of any reviewed change set and must not be committed as-is (harmless functionally; the encoding damage is a real defect — UX-P3-04).

### What this audit created
Eleven new documents under `docs/audit/` plus one evidence log (`evidence-backend-test.log`). Nothing else. No existing document was overwritten — in particular the canonical `ELEKEZA_DEPLOYMENT_READINESS.md` was preserved and a dated addendum added beside it.

### Backups
`backups/`, `release-evidence/`, `e2e-evidence/`, `artifacts/` and four stashes already exist in the repo and were **not** modified.

---

## 1. The actual architecture

### 1.1 Three applications in one repository

| App | Stack (verified in manifests) | Port | Role |
|---|---|---|---|
| `backend/` | Spring Boot **3.2.4**, Kotlin **1.9.23**, Java 17, JPA/Hibernate, Flyway, Spring Security, JJWT 0.12.5, Bucket4j, PDFBox 3, POI 5.2.5, OpenCSV, mail, webflux | 8080 / 8085 dev / 8090 E2E | The real system: **163 Kotlin files, 39 controllers, 54 test classes, 357 tests** |
| `frontend/` | Next.js **16.3.3**, React **19.2.3**, TypeScript 5, Tailwind **3.4.19** (+ `@tailwindcss/postcss` **4**), TanStack Query 5, axios, Recharts, next-pwa 5.6, Capacitor 8 (Android), lucide + heroicons | 3000 / 3100 E2E | **61 routes, 3 layouts, 4 shell components** |
| `ai-elewa/` | FastAPI + uvicorn, 4-stage pipeline (profile → simplify → verify → concepts), OCR, readability, retry, Langfuse | 8000 / 8001 dev | AI tutor, quiz generation, simplification, document processing |

**Databases:** Postgres 16 (prod/compose), H2 in PostgreSQL mode (tests), Redis 7 (cache/limits). Flyway owns the schema: **V1–V19**, `ddl-auto: validate`.

**Version notes worth flagging (P3):** Tailwind 3 and 4 are both installed (`tailwindcss@3.4.19` in devDependencies with `@tailwindcss/postcss@4`), which works only because of how Next wires PostCSS — it is a latent trap. `next-pwa@5.6.0` is unmaintained and the repo already carries an `overrides` entry for `serialize-javascript`, strongly suggesting a known transitive vulnerability; it should be replaced (e.g. `@ducanh2912/next-pwa` or a hand-rolled SW) before production.

### 1.2 Integration boundaries

| Boundary | Implementation | Trust |
|---|---|---|
| Browser → backend | Same-origin via nginx `/api/`, cookie `elekeza_access` (HttpOnly) + `elekeza_refresh` + `XSRF-TOKEN` double-submit | Good |
| Backend → AI service | `X-Internal-Key` shared secret, **fail-closed** (`hmac.compare_digest`), service not published on any host port in compose | Good |
| Backend → M-Pesa (Daraja) | `MpesaController` + callback verification (6 test classes) | Good, no IP allowlist (documented P1) |
| Backend → SMS / email / storage | Africa's Talking, JavaMail, R2 — all provider-selectable with a **mock** default | Mock in dev; **not** verified live |
| Frontend → backend in dev | `next.config.ts` rewrite to `NEXT_PUBLIC_API_URL` (default `http://localhost:8085`) | Dev only |

### 1.3 Working tree (unchanged by this audit)

**Modified (7):** `ai-elewa/tests/test_full_pipeline.py`, `backend/…/calendar/DeadlineController.kt`, `backend/…/config/seed/ShowcaseDataInitializer.kt`, `backend/…/guardian/GuardianScheduleController.kt`, `backend/…/devices/DevicesAndBillingApiTest.kt`, `backend/…/guardian/GuardianSchoolDatesTest.kt`, `frontend/next.config.ts`, `backend/…/application-dev.yaml`, `frontend/public/sw.js`
**Staged new (2):** `DeadlineAuthorizationTest.kt`, `GuardianDeadlineLinkLifecycleTest.kt`
**Untracked (7):** `.cloud-attachments/`, `Make-ClaudeAuditZip.ps1`, `Push-Sprint2.ps1`, `backend/flyway-validation/`, `backend/…/application-dev.yaml.bak`, `docs/ELEKEZA_COMPLETION_AND_INTEGRATION_REGISTER.md`, `docs/audit/`, `ignal.`

Two of these contain a **behavioural product change unrelated to messaging**: `GuardianScheduleController` drops `REGIONAL` school dates and `GuardianSchoolDatesTest` was inverted to assert their absence. That is a deliberate narrowing of guardian visibility and needs its own review — it must not travel inside a messaging change.

### 1.4 Running services at audit time
No backend, frontend or AI service was running. Ports 3000/8080/8085/8090/3100/8001 were not serving; **nothing on :5432**, so no real PostgreSQL instance exists locally. This is why the AI test suite produced 31 connection failures (§4).

---

## 2. The ten most important problems

Ordered by consequence, not by effort.

### 1. A child can register without an age gate or guardian consent (SEC-P0-01)
Registration requires email, password, name and a `termsAccepted` boolean. No DOB, no age band, no consent record, no pending state. `AuthService.register` hard-codes `role = STUDENT` (good — no privilege escalation) but activates immediately. For a 7–16-year-old audience this is the defining legal and ethical defect.

### 2. No privacy policy, DPIA, retention schedule or erasure path (SEC-P0-02)
The platform stores children's names, contacts, lesson activity, assessment results, attendance, documents and private messages. None of the accountability artefacts a Kenyan controller needs exist. There is also no erasure endpoint at all — only `active` toggling.

### 3. A misconfigured profile ships a platform super-admin with a published password (SEC-P0-03)
`V2__seed_demo.sql` seeds `superadmin@elekeza.app` (`ADMIN`) and `admin@elekeza.app` (`SCHOOL_ADMIN`) with bcrypt hashes committed in the repo and their passwords written in the file header. The gate is correct for `prod` and `docker` — but the **base** `application.yaml` sets `demoSeedEnabled: "TRUE"`. One wrong `SPRING_PROFILES_ACTIVE` and production has an open super-admin.

### 4. A parent cannot join Elekeza (FUNC-P1-01)
There is no guardian registration, no invite, no self-service child linking. `/guardian` tells an unlinked guardian to "Contact your school". Every guardian must be created by a school administrator. The home-learning thesis — a parent at home supporting a child — has no implementation.

### 5. There is no application shell for several routes, and three shells for the rest (UX-P1-01, FUNC-P1-05)

> **Correction (Wave 0, 14 Nov 2026):** the count below overstates the shell gap. `/admin`, `/school/import` and `/school/payment` already wrapped themselves in `SidebarLayout`, and `/school/onboarding` is public. The genuine count was **7** authenticated routes, of which five were fixed in Wave 0. See `ELEKEZA_WAVE_0_EXECUTION_REPORT.md` §5.2 and the correction note in `ELEKEZA_COMPLETE_ROUTE_INVENTORY.md` §7b.
The reported "the sidebar disappears on attendance" is not CSS. The App Router tree has exactly three layouts (root, `/guardian`, `/teacher`); `/attendance`, `/admin/staff`, `/finance`, `/analytics`, `/assignments`, `/school/import`, `/school/onboarding`, `/teacher-assignments`, `/government`, `/marketplace`, `/therapist` import no shell and inherit none. Meanwhile three competing shells (`SidebarLayout`, `Sidebar`+`DashboardLayout`, and a dead `RoleLayout`) produce **two different sidebars for the same learner in one session**.

### 6. Learners cannot upload or open their own learning material (SEC-P1-05)
`Sidebar` links every learner to `/upload`; `/upload` posts to `POST /api/content/upload/file`, which is `@PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','ADMIN')")`. The learner's primary "bring my own worksheet" action returns 403. Document-based tutoring — a core product promise — does not exist for the learner.

### 7. Uploads are extension-checked only (SEC-P1-04)
10 MB limit, extension allowlist, flattened filename, UUID prefix — all good. But no content sniffing, no malware strategy, no object storage (files land in the container's `uploads/`), and no retention/deletion policy. A malicious file renamed `.pdf` is accepted and later served to teachers.

### 8. The administration hierarchy the product needs cannot be expressed (SEC-P1-01)
`UserRole` has five values: `STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN`. `ADMIN` **is** the platform super-admin and appears in every allow-list. There is no `SUPER_ADMIN`, no `PLATFORM_ADMIN`, no national/government role (`/government` is a `ComingSoon` stub). Least privilege at the top is structurally impossible; a government overseer could only be created by granting full platform control.

### 9. The frontend is largely untested where it matters (TEST-P1-01/02)
Backend: **357/357 pass** (verified this session). Frontend: **20 unit tests across 4 files for 61 routes**. E2E covers 3 of 5 roles — there is **no school-admin or platform-admin test account**, so the five shell-less, form-dense admin pages are exercised by nothing. The defect distribution in this audit sits almost exactly in the untested area.

### 10. Accessibility is aimed below the target and measured too narrowly (A11Y-P1-01/02/03)
axe runs with WCAG **2.1** tags (target is 2.2) over **7 of 61** routes, none administrative. Text-to-speech exists on exactly one page (`/student-ai-tutor`) and nowhere in a quiz — the highest-stakes reading moment. There is no speech-to-text and no manual screen-reader pass recorded. `LanguageToggle.tsx` is a **0-byte file**; Kiswahili does not exist.

---

## 3. Critical security & privacy findings (condensed)

Full detail, reproduction steps and acceptance criteria in `ELEKEZA_SECURITY_AUDIT.md`.

**P0 (3):** open registration of minors without consent · absent DPA artefacts and erasure path · inverted demo-seed default exposing a platform admin.

**P1 (5):** no role separation at the top · no data-subject access/erasure · login limiter keyed on the proxy's IP (targeted lockout + weakened throttling) · upload validation and storage · learner upload impossibility.

**P2 (6):** nginx header inheritance drops HSTS/nosniff on cached assets · minimal Spring security headers · `type` claim unchecked + dead refresh generator · no access-token revocation window documented · rate limiting only on login · binary/archive paths not ignored.

**What is genuinely strong and must be preserved:**
- Refresh tokens: opaque, SHA-256-hashed at rest, **rotated on each use**, revoked on logout, on suspension and on expiry.
- Suspension cuts both the access and refresh legs, including an already-issued unexpired JWT.
- Self-registration cannot mint a privileged role.
- Login responses are indistinguishable for unknown-account / wrong-password / suspended.
- AI service fails **closed** with constant-time comparison.
- Institution scoping derives from the principal, never from request input, throughout.
- 357 backend tests with real authorization and payment coverage.

---

## 4. Broken and incomplete user journeys

Full matrix in `ELEKEZA_FUNCTIONALITY_AND_WORKFLOW_AUDIT.md` (20 journeys: 6 WORKS, 9 PARTIAL, 1 BROKEN, 3 MISSING, 1 NOT VERIFIED).

**Hard breaks**
- **Learner upload** → 403 (`/upload` → teacher-only endpoint).
- **Parent sign-up** → no path exists.
- **Government oversight** → placeholder page, no role, no data.

**Journeys that work only inside a school**
- Learner registration (needs consent), parent linking (needs an admin), document-based study (needs a teacher to upload).

**Journeys that work but look broken**
- Attendance, finance, staff management, analytics, school import: functional, shell-less.

**Journeys that are forms with no persistence**
- `/teacher/plans`, `/teacher/schedule` — local state only.

---

## 5. Pages requiring redesign

Not "restyle" — restructure:

| Page(s) | Why |
|---|---|
| `/attendance`, `/admin/staff`, `/finance`, `/analytics`, `/assignments`, `/school/import`, `/school/onboarding`, `/teacher-assignments` | No shell, no skip link, no navigation — must move into a route-group layout |
| Every learner page currently under `DashboardLayout` | Wrong/duplicated navigation for the role |
| `/super-admin` | Real but minimal; hides failures with `.catch(() => {})`; needs the admin role split behind it |
| `/government`, `/marketplace`, `/therapist` | Placeholders; hide behind feature flags rather than redesign |
| Whole product (visual) | Two palettes and no token system; consolidate (see `ELEKEZA_UI_UX_REVIEW.md` §6) |

---

## 6. Missing capabilities

1. **Guardian self-registration + code-based child linking.**
2. **Age gate + verifiable parental consent + consent records.**
3. **Privacy notice, DPIA, retention, DSAR/erasure.**
4. **Learner-owned documents + tutor-over-document.**
5. **AI usage metering and quotas** (also a security and commercial control).
6. **`SUPER_ADMIN` / `PLATFORM_ADMIN` / `NATIONAL_ADMIN` with scopes**, plus audited provisioning and MFA.
7. **General audit trail** of privileged reads/writes.
8. **Admin tooling**: user management, class management, reports, security settings (five navigation entries currently point nowhere).
9. **Monitoring, alerting, incident runbook.**
10. **Kiswahili** and a functioning language switch.
11. **Read-aloud across learning surfaces**; speech-to-text.
12. **Teacher class management** (create/edit classes; the API lives only on an unmerged branch).
13. **Persistence for teacher plans and schedule.**
14. **Real-PostgreSQL migration verification.**

---

## 7. Recommended remediation sequence

Full backlog with IDs, dependencies and acceptance criteria: `ELEKEZA_REMEDIATION_BACKLOG.md`.

| Wave | Theme | Effort | Unblocks |
|---|---|---|---|
| **0** | Stop the bleeding: seed default, nginx headers, ignore rules, encoding, dead code, admin test fixtures | ~1.4 d | Nothing — risk reduction, start immediately |
| **1** | **P0 lawful processing**: age/consent, DPA artefacts, erasure/export, guardian self-service | 8–12 d + legal | **External pilot** |
| **2** | One product, one shell: route groups, one nav per role, tokens, real error states | 6–9 d | A credible demo to Victor and Alvin |
| **3** | Learner capability + document safety: learner documents, upload hardening, read-aloud, metering | 7–10 d | The product thesis |
| **4** | Platform administration: role split, provisioning, audit trail, admin tooling | 8–12 d | Government/oversight tier |
| **5** | Quality, accessibility, deployment: WCAG 2.2 on all routes, manual AT pass, shell tests, hermetic AI tests, Postgres CI, monitoring | 8–11 d | Defensible claims; a deployable stack |
| **6** | Coherence: duplicate routes, copy, type scale, password policy, lint gates | 5 d | Polish |

**Total: roughly 43–60 developer-days** of engineering plus external waits (legal advice, domain, credentials). That is an estimate for sequencing, not a commitment.

**Critical path to a controlled 2-school pilot:** Wave 0 → Wave 1 → Wave 2 → selected Wave 5 items.

---

## 8. Dependencies and risks

| Risk | Impact | Mitigation |
|---|---|---|
| Legal advice on consent/DPIA is external and unscheduled | Blocks Wave 1, therefore blocks the pilot | Start the legal conversation now; it is the longest lead time |
| Domain/host decision is pending (Harrison) | Blocks any deployment, not any code | Wave 0/1/2 need no host — proceed in parallel |
| Provider credentials (M-Pesa prod, SMS, SMTP, R2) | Blocks integration verification | Mock providers are correct for pilot; do not switch to live early |
| AI cost is uncapped and unmetered | Free tier is an unbounded liability; a pilot could burn budget | Wave 3 metering before any free-tier commitment |
| Frontend test desert | Regressions ship silently in exactly the areas being fixed | Wave 5 R-27/R-24 as the guard rail for Waves 2–3 |
| 8 GB dev host causes E2E flakiness | A green suite is machine-dependent | Wave 5 R-29; record host profile with results |
| Tailwind 3+4 coexistence and unmaintained `next-pwa` | Latent build/security surprise at production | Plan replacement before S3 |
| Unrelated backend changes in a shared dirty tree | A future `git commit -a` mixes messaging with a visibility change | Path-scoped commits only; the two extra useful review items (`DeadlineController`, `GuardianScheduleController`) deserve their own review |

---

## 9. Commercial position (summary)

Full analysis: `ELEKEZA_COMMERCIAL_MODEL.md`.

The structural finding: **compute is roughly flat per school; AI inference is linear per learner-turn.** Any flat school fee with unlimited tutoring has a cost curve that crosses revenue. Therefore **metering is the business model** — the same work as the security control in §3. Four tiers are viable (free essential, freemium, household, institutional/sponsored), but **none is enforceable today** because no AI quota exists anywhere. Do not build a paywall in front of the free learning loop.

---

## 10. Verdict

| Question from the brief | Answer |
|---|---|
| Can a learner aged 7–16 independently access Elekeza and learn? | **Inside a school, yes.** At home, **no** — and only with consent arrangements that do not exist. |
| Can a parent support that child from home? | **No.** They cannot even create an account. |
| Can a teacher manage learning and communicate with parents? | **Yes**, with a shell-less attendance page and two non-persistent forms. |
| Can a school onboard its community securely? | **Partly.** School + staff + CSV learners work; guardians cannot be invited; admin pages have no navigation. |
| Can a national administrator oversee institutions without compromising privacy? | **No.** The role does not exist. |
| Can this be delivered affordably, including to those who cannot pay? | **Not yet.** There is no metering, so no free tier can be offered safely. |

**Overall: NOT READY for an external pilot. Ready for continued internal testing, and closer than the defect count suggests** — because the hard, unglamorous layer (authorization, tenancy isolation, payment integrity, token lifecycle) is the part that is actually strong, and the gaps are concentrated in product surface, consent and administration.

### What must happen next

1. **Wave 0 this week** — six small changes, no external dependency, one of which removes an open-super-admin footgun.
2. **Start the legal/DPA workstream immediately** — it is the longest lead time and the true critical path.
3. **Decide the guardian model** — self-registration + link code, or school-invite only. This single decision determines whether Elekeza is a school tool or education infrastructure.
4. **Do not widen any exposure** — no deploy, no push, no production secrets, no live payments until Waves 0–1 are closed.

> A note on honesty: this audit found nothing in the repository that overstates readiness. The existing gate matrix already records data protection as FAIL/BLOCKED and mobile as NOT TESTED. That discipline is the most valuable asset in this project — it is what makes the eventual green light meaningful.
