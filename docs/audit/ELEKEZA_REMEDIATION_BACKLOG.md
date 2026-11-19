# ELEKEZA — REMEDIATION BACKLOG

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Sequencing rule:** P0 before any external pilot. P1 before widening a pilot. P2/P3 during and after.
**Effort** is a rough developer-day estimate for one experienced developer, excluding external waiting (legal advice, credential issuance, procurement). Treat it as a planning order of magnitude, not a commitment.

---

## WAVE 0 STATUS — updated 14 Nov 2026

Executed and verified. Full evidence: `ELEKEZA_WAVE_0_EXECUTION_REPORT.md`.

| ID | Status | Evidence |
|---|---|---|
| **R-01** | ✅ **DONE** | `demoSeedEnabled` defaults FALSE; `application-test.yml` opts in; `DemoSeedGuard` fails closed outside dev/test; 8 tests |
| **R-02** | ✅ **DONE** | Security headers repeated in `/sw.js` and `/_next/static/` (inlined — the container mounts `nginx.conf` as a single file, so an `include` would not exist) |
| **R-03** | ✅ **DONE** | `.gitignore`: `backend/flyway-validation/`, `.cloud-attachments/`, `*.bak` |
| **R-04** | ✅ **DONE** | BOM + mojibake removed from `next.config.ts`; `allowedDevOrigins` preserved |
| **R-05** | ✅ **DONE** | `validateToken` checks `type == "access"`; dead `generateRefreshToken` removed; 3 tests |
| **R-06** | 🟡 **PARTIAL** | `ADMIN` fixture added. **No SCHOOL_ADMIN exists in the dev seed** (Flyway V2 creates one, but dev disables Flyway) — seeding one is now part of R-27 |
| UX-P1-01 | 🟡 **5 ROUTES DONE** | `/attendance`, `/admin/staff`, `/finance`, `/analytics`, `/teacher-assignments` now inherit `SidebarLayout`; invariant test added. Full unification remains R-11 |
| FUNC-P1-03 | 🟡 **PARTIAL** | Role mapping extracted to `navConfig.ts` and tested; the two-menu learner problem needs R-11/R-12 |
| SEC-P1-05 | 🟡 **MITIGATED** | Learner `Upload` link removed (it was a guaranteed 403). Real fix is R-16 |
| FUNC-P2-02 | ✅ **DONE** | "View your wards' classes" → "View your child's progress"; no user-facing "wards" string remains |

**Post-Wave-0 test baseline:** backend **368** tests / 56 classes / 0 failures (was 357); frontend **34** tests / 6 files (was 20); tsc clean; production build clean (61 routes).

**New defect found during Wave 0 (not in the original audit):** `application-docker.yml` defaults `jwt.secret` to a publicly known string (`change-me-32-char-minimum-secret-key`). Remove the fallback so a missing secret fails to start. Recommended for Wave 1 as P0-adjacent.

**Audit corrections (proven wrong by re-inspection before editing):** `/admin`, `/school/import` and `/school/payment` already wrapped themselves in a shell — they were never shell-less; and `/school/onboarding` is a public page that correctly has no shell. See `ELEKEZA_WAVE_0_EXECUTION_REPORT.md` §5.2.

---

## Wave 0 — Stop the bleeding (this week, ~1.5 days, no external dependency)

| ID | Finding | Action | Effort | Acceptance criteria |
|---|---|---|---|---|
| **R-01** | SEC-P0-03 / DEP-P0-01 | Invert `demoSeedEnabled` default to `FALSE` in `application.yaml`; set `TRUE` explicitly in `application-dev.yaml` and `application-test.yml`; add a startup guard that refuses to boot with seeding on outside `dev`/`test` | 0.5 d | Non-dev boot leaves `users` free of demo rows; a test asserts the guard fires; boot log names the seed mode |
| **R-02** | DEP-P1-01 | Fix nginx `add_header` inheritance with a shared security-headers include used in every `location` | 0.25 d | HSTS + nosniff present on `/sw.js` and `/_next/static/*` responses |
| **R-03** | SEC-P2-06 | Add ignore rules for `backend/flyway-validation/`, `.cloud-attachments/`, `*.log` evidence, `*.bak` | 0.1 d | `git status` shows no binary or archive paths |
| **R-04** | UX-P3-04 | Normalise `next.config.ts` / `application-dev.yaml` to UTF-8 without BOM; remove the `.bak` | 0.15 d | No BOM, no mojibake, no stray `.bak` in the tree |
| **R-05** | SEC-P2-03 / SEC-P3-04 | Delete dead `generateRefreshToken` and the stale "copy this file" header; assert `type == "access"` in `JwtAuthFilter` | 0.25 d | Unit test: a token with `type=refresh` is rejected by the filter |
| **R-06** | TEST-P1-01 | Add `SCHOOL_ADMIN` and `ADMIN` E2E fixtures | 0.25 d | Both roles log in and reach their home route in CI |

**Wave 0 closes no P0 that requires design work, but it removes the "one wrong environment variable = open super-admin" risk immediately.** Do not wait for the domain decision to start it.

---

## Wave 1 — P0: lawful processing (blocks S2, ~8–12 days + legal)

| ID | Finding | Action | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|
| **R-07** | SEC-P0-01 | Age gate + guardian consent handshake: `dateOfBirth` required; under-18 → pending state; guardian invite; `consent_records` table with scope/version/method/timestamp; activation only on consent | 4–6 d | R-08 (wording), email delivery | A declared 12-year-old cannot get a session without a consent record; consent is attributable and revocable |
| **R-08** | SEC-P0-02 | Privacy notice per audience (plain language), DPIA covering the AI tutor + documents + messaging, retention table per data class, processor register, DSAR + erasure runbook | 3–4 d + legal | Legal advice | A school DPO can be handed a complete artefact set naming every processor and data class in this repo |
| **R-09** | SEC-P1-02 | `POST /api/admin/users/{id}/erase` (audited cascade/anonymise) + `GET /api/me/export` | 2 d | R-08 | Erasure leaves no identifying rows; export returns only the subject's data; both audited |
| **R-10** | FUNC-P1-01 | Guardian self-registration (`GUARDIAN` allowed) + one-time expiring learner-link code issued by school/teacher; record granting actor | 3 d | R-07 | A new guardian with a valid code sees exactly that child; expired/invalid rejected; no enumeration without a code |

**R-07 and R-10 are the same product decision seen twice:** a parent must be able to join and prove the relationship. Build them together.

---

## Wave 2 — P1: one product, one shell (blocks a credible demo to Victor and Alvin, ~6–9 days)

| ID | Finding | Action | Effort | Acceptance criteria |
|---|---|---|---|---|
| **R-11** | UX-P1-01 / FUNC-P1-05 / A11Y-P2-01 | Route groups `(public) (learner) (guardian) (teacher) (admin)` with one `AppShell`; delete `Sidebar`+`DashboardLayout` and `RoleLayout`+`roleConfig` | 3–4 d | All 61 routes render one sidebar, one `<main>`, one skip link; a test enumerates routes and asserts shell presence |
| **R-12** | FUNC-P1-03 | One nav set per role; snapshot test per role | 1 d | A learner sees identical navigation on every page |
| **R-13** | UX-P1-04 / UX-P2-01 / UX-P2-02 | Remove `DocuEase`; consolidate to one visual direction via tokens; measure and fix contrast on the purple/dark pairs | 2 d | No foreign brand strings; every text token pair ≥ 4.5:1 (≥ 3:1 large) |
| **R-14** | UX-P2-03 | Replace bare `.catch(() => {})` in page data loads with visible error states using `ui/StatusBanner`/`ErrorModal`; fix `/admin/staff` infinite load when `institutionId` is absent | 1 d | A forced 500 renders a human error, never zeros or a permanent skeleton |
| **R-15** | UX-P3-02 | Hide `/government`, `/marketplace`, `/therapist` behind feature flags (V19 table already exists) | 0.5 d | No `ComingSoon` page is reachable in a pilot build |

---

## Wave 3 — P1: learner capability and document safety (~7–10 days)

| ID | Finding | Action | Effort | Acceptance criteria |
|---|---|---|---|---|
| **R-16** | SEC-P1-05 | Learner-owned documents: `POST /api/learner/documents`, owner-only visibility, quota, tutor-over-document | 3–4 d | Learner uploads a PDF and asks the tutor about it; another learner gets 403/404 |
| **R-17** | SEC-P1-04 | Content sniffing (Tika/magic bytes), server-side `Content-Disposition`, object storage with per-tenant prefixes + signed URLs, retention job | 3–4 d | HTML renamed `.pdf` → 415; object retrievable only by owner via signed URL; retention deletes past policy |
| **R-18** | A11Y-P1-03 | Extract `<ReadAloud>`; mount on lesson, quiz, exam, assignment; persist position; speech-to-text for short answers where pedagogically sound | 2 d | A learner completes a quiz using keyboard + TTS + STT only |
| **R-19** | SEC-P2-05 / commercial §5 | AI usage metering + per-tier quota; per-tenant usage report | 2 d | A learner cannot exceed the allowance; usage is attributable per tenant |

---

## Wave 4 — P1: platform administration and oversight (~8–12 days)

| ID | Finding | Action | Effort | Acceptance criteria |
|---|---|---|---|---|
| **R-20** | SEC-P1-01 | Add `SUPER_ADMIN`, `PLATFORM_ADMIN`, `NATIONAL_ADMIN`; introduce a scope claim; enumerate and migrate existing `ADMIN` rows deliberately | 3–4 d | A national admin reads aggregates only and cannot open a learner record |
| **R-21** | Role matrix §6 | Audited provisioning path for privileged accounts + MFA for `SUPER_ADMIN` | 2 d | No privileged account exists except through the documented, audited path |
| **R-22** | Role matrix §7 | General audit trail for privileged reads/writes | 2–3 d | Who opened which learner record, when, and why is queryable |
| **R-23** | FUNC-P1-04 | Build `/admin/users`, `/admin/classes`, `/admin/reports`, `/admin/security` **or** delete the references | 2–3 d | Every navigation entry resolves; no 404 in the admin shell |

---

## Wave 5 — P1/P2: quality, accessibility and deployment (~8–11 days)

| ID | Finding | Action | Effort | Acceptance criteria |
|---|---|---|---|---|
| **R-24** | A11Y-P1-01/02 | Switch axe tags to WCAG **2.2** AA; extend to every route per role | 2 d | One axe result per route per role; exclusions list empty except documented placeholders |
| **R-25** | A11Y-P1-04 | Record manual AT matrix (NVDA+Chrome, TalkBack, VoiceOver) × 5 journeys; include a tester with lived experience | 2 d + human | Signed manual report with defects found and fixed |
| **R-26** | A11Y-P2-02 | i18n layer with `en` + `sw`; localise learner and guardian surfaces first | 3–4 d | A guardian completes messaging and progress reading in Kiswahili |
| **R-27** | TEST-P1-02 | Per-role shell tests, route↔shell test, tests for `/upload` guard and `/admin/staff` empty state | 1.5 d | A lost layout fails CI |
| **R-28** | TEST-P2-01 | Make AI suite hermetic (`TestClient` or session fixture); mark external tests `@pytest.mark.integration` | 1 d | `pytest` passes with no service running |
| **R-29** | TEST-P2-03 | `./gradlew --stop` after `globalSetup`; fail on retry; record host profile with results | 0.5 d | A run that needs a retry is visibly not-green |
| **R-30** | DEP-P1-03 / TEST-P2-04 | CI job: postgres:16 from scratch → Flyway → backend suite | 1 d | Migrations verified on real PostgreSQL on every push |
| **R-31** | DEP-P1-02 | Sentry on backend/frontend/AI, uptime probe, alerts for login/tutor/payment-callback failures, incident runbook | 1.5 d | An induced 500 appears in the tracker and alerts the on-call |
| **R-32** | SEC-P1-03 | `server.forward-headers-strategy: framework`; limiter keyed on real client IP + coarse per-IP bucket | 0.5 d | Two different `X-Forwarded-For` values get independent buckets |
| **R-33** | FUNC-P2-03 | Persist teacher lesson plans and schedule (or remove the forms) | 1 d | A plan survives navigation and reload |

---

## Wave 6 — P2/P3: coherence and future (~5 days)

| ID | Finding | Action | Effort |
|---|---|---|---|
| R-34 | FUNC-P2-01 | Resolve duplicate routes (`/dashboard` vs `/student-home`; `/teacher/assignments` vs `/teacher-assignments`) with redirects | 1 d |
| R-35 | FUNC-P2-02 | Replace "wards" copy with "child/children" in user-visible strings | 0.25 d |
| R-36 | UX-P2-04/05, UX-P3-01 | One top-level pattern; one type scale; consistent heading sizes | 1.5 d |
| R-37 | SEC-P3-01/02 | Password max length (72 bytes), breached-password check, email verification | 1.5 d |
| R-38 | TEST-P3-01/02 | JaCoCo threshold; `jsx-a11y` lint rules (accessible names, no redundant roles) | 0.5 d |

---

## Sequencing summary

| Wave | Theme | Effort | Gate it unblocks |
|---|---|---|---|
| 0 | Stop the bleeding | ~1.4 d | Nothing — risk reduction, start now |
| 1 | Lawful processing (P0) | 8–12 d + legal | **S2 external pilot** |
| 2 | One product, one shell | 6–9 d | A credible demo; navigation stops being embarrassing |
| 3 | Learner capability + document safety | 7–10 d | The product thesis |
| 4 | Platform administration | 8–12 d | National/oversight tier and least privilege |
| 5 | Quality, a11y, deployment | 8–11 d | Defensible quality claims; deployable stack |
| 6 | Coherence | 5 d | Polish |

**Critical path to S2: Wave 0 → Wave 1 → Wave 2 → selected Wave 5 items (R-24, R-27, R-30, R-31).** Wave 4 is required before a *government-facing* pilot, not before a 2-school pilot with school admins only.

---

## The three things that must not be deferred

1. **R-07/R-10** — a parent who cannot join, and a child who can register without consent, are the two facts that make "inclusive education infrastructure" untrue.
2. **R-11** — the shell. Everything visual, accessible and navigational downstream of it is currently being fixed twice.
3. **R-19** — metering. Without it there is no free tier, and without a free tier the affordability promise is empty.
