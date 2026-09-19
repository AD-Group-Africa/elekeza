# ELEKEZA — Strategic Assessment (Master Reset, 2026-09-17)

*Classification used throughout: `VERIFIED` · `PARTIALLY VERIFIED` · `BLOCKED (external)` · `NOT IMPLEMENTED`.*
*Evidence dates are absolute; every claim maps to a gate in `docs/RELEASE_TEST_MATRIX.md`.*

---

## A. Current architecture

From code (not aspiration):

```
Next.js 16 frontend (dev proxy → /api) ── axios (cookie auth + CSRF double-submit) ──►
  Spring Boot 3.2 / Kotlin backend ──► PostgreSQL (Flyway V1–V11)
        │
        ├─ M-Pesa Daraja adapter (mock | sandbox | production modes)
        └─ deterministic tutor/adaptation engine (no provider credentials required)
```

Key domains now present: auth (JWT access + rotating refresh, CSRF, role + institution RBAC),
content/lessons, quizzes (server-authoritative), exams (server-authoritative timing), mastery,
lessons/gamification, AI tutor V1 (six actions, deterministic fallback), notifications, guardian
links, **attendance (V10)** and **school fees/payments (V11)** — the two P0 domains closed in
this cycle.

## B. Current product

What Elekeza actually does today, end to end:

- **Learner**: dashboard, lessons, gamified progress, quizzes, exams, AI Tutor (explain / practice
  / read-aloud / Kiswahili / diagram / summary), progress, own attendance (read-only).
- **Teacher**: classes, attendance register (per-class/per-day), exams authoring → publishing →
  results, learner progress analytics.
- **Guardian**: ward links, results, attendance (linked wards only), fees (charges, balance,
  payment history, receipts, M-Pesa initiation in configured mode).
- **School Admin**: learners, staff, school setup, finance dashboard (billed / collected /
  outstanding, all server-derived), fee items + structures, charges, manual payments,
  allocations, receipts.
- **Super Admin**: platform/tenant boundary; cross-tenant isolation is tested, not assumed.

## C. P0 blockers — status

| P0 | Status | Evidence |
|---|---|---|
| Attendance domain | **VERIFIED (local)** | V10 migration; entities/service/controller; 12-test suite incl. teacher-class scoping, tenant isolation, guardian-ward isolation, duplicate-session uniqueness |
| Fees/payments domain | **VERIFIED (local)** | V11 migration; FinanceEntities/Service/Controller; charges → payments → allocations → derived balances → receipts; idempotent M-Pesa callback listener; 14-test suite incl. callback-replay idempotency and cross-tenant rejection |
| Clean migration + deterministic seed | **VERIFIED (local)** | Fresh H2 E2E boot applies V1→V11 and base+attendance/finance seed every Playwright run |
| Release gate | see `docs/RELEASE_TEST_MATRIX.md` | Backend 205/205 · frontend tsc/vitest/lint/build green · E2E suite run recorded there |

Production M-Pesa remains **BLOCKED (external)**: no Daraja production credentials or HTTPS
callback endpoint exist. Mock/sandbox paths are honest about this in the UI (`Production M-Pesa
not configured`).

## D. Architecture risks

1. **Migration-history discipline** — V10/V11 must never be edited after first deploy; new
   schema work starts at V12. The consolidated V1 baseline rewrite is only safe pre-deploy.
2. **H2 in dev, PostgreSQL in prod** — dev-profile H2 keeps demos simple but means migration
   quirks (e.g. dialect-specific SQL) surface late. Mitigation: the CI/fresh-Postgres gate must
   run before any release tag.
3. **Single-backend monolith** — correct for this stage. Do not split services until a domain
   has independent scaling needs (none do yet).
4. **Rate limiter coupling** — the login limiter is strict in dev; E2E had to relax it. Keep the
   production limiter strict; never widen it to make tests pass (the fix belongs in test config).
5. **Seed coupling** — attendance/finance demo data lives in the base dev seed so E2E/preview/
   demo share one truth. Idempotency is enforced by existence checks; keep it that way.

## E. UX problems (current, honest)

- Visual language has drifted across generations of pages (purple-era pages vs. moss-green
  newer modules); tokens exist but not every page consumes them.
- Hydration-gated pages caused blank flashes (`/dashboard/settings` fixed this cycle; audit
  found no others).
- Mobile behavior is acceptable but not exemplary: tables in the finance dashboard need a
  stacked-card treatment under 640px.
- Sidebar information architecture is role-filtered but still lists features rather than tasks
  (see §Navigation below).
- Empty states exist on new pages but some legacy pages still show bare tables.

## F. Product gaps (for the school ↔ family ecosystem)

Ordered by proximity to pilot value:

1. **Assignments as a distinct domain** — quizzes/exams exist; free-form assignments with
   submissions do not. Teachers ask for this first.
2. **Parent daily digest** — the data exists (attendance, progress, fees); a single
   "what Amina did today / this week" view would convert guardians from checkers to participants.
3. **Communication** — teacher ↔ guardian messaging (even one-way announcements) closes the
   school-home loop; SMS via the existing Africa's Talking adapter is the low-end channel.
4. **Holiday learning packs** — reuse lessons/practice over breaks; deterministic recommendation
   from mastery data (no fake AI).
5. **Documents/resources** — teacher → class materials with the existing storage abstraction.
6. **Timetable** — attendance sessions are class+date; a period/subject dimension arrives with
   timetabling (V12 candidate, after assignments).

## G. Device strategy (assessment, not rewrite)

**Verdict: stay responsive PWA on Next.js; defer native entirely.**

- The current stack already runs offline-capable patterns (queued submissions exist in E2E
  offline spec); investing further in PWA (installable, cached shells, background sync) is
  cheap and serves shared-school-tablet reality.
- Android/Kotlin native is justified only when: (a) device-management (MDM) deployment for
  school-owned tablets becomes a paid requirement, or (b) offline media-heavy content demands
  platform APIs. Neither is true before pilot.
- Tablet-first *experience* (large targets, calm density) is a design-system concern, not a
  framework concern — proceed within the current stack.
- Re-evaluate after 90 days of pilot usage data (device mix, offline session frequency).

## H. Business gaps

- **Pricing hypothesis untested**: per-learner-per-term school subscription is the natural
  model; a pilot with 3–5 schools must include a price experiment (not free).
- **Deployment cost model** missing: onboarding hours per school, training time, support load.
  Measure during pilot; these numbers make or break unit economics.
- **AD Group separation**: Elekeza needs its own docs root, metrics dashboard and pitch
  material (this document set is the start); shared infra stays with AD Group.
- **Evidence assets for funders**: retention curves, weekly active learners/parents, fee
  collection improvement vs. baseline, accessibility usage. Instrument now (§K).

## I. Pilot readiness

Gate to real users (Innovate Now testing):

- [x] Five-role journeys verified (see matrix)
- [x] Tenant isolation tests
- [x] Attendance + fees operational
- [ ] Clean-PostgreSQL migration gate re-run on the release tag
- [ ] Production deployment path exercised once end-to-end (staging, mock providers acceptable)
- [ ] Support runbook + data-rollback procedure documented for the pilot operator
- [ ] Consent + data-governance text finalized (`docs/DATA_GOVERNANCE.md` exists; needs pilot
      school sign-off)

## J. Funding readiness

Fundable when these exist (in order): working product (done) → pilot with real schools (next)
→ usage/outcome metrics (90 days) → unit economics (from pilot) → case studies. Before
approaching funders: the KPI dashboard (§K), three school case studies, and a deployment-cost
model. Grant categories to investigate now (eligibility/deadlines to verify, not assume):
Kenyan ICT/innovation programs, inclusive-education grants, edtech accelerators with East
Africa focus.

---

## K. Product KPI framework (instrument next)

| Layer | Metric | Source |
|---|---|---|
| Learner | weekly active learners, lessons completed, quiz/exam completion, practice sessions | existing progress + attempt tables |
| Teacher | attendance sessions marked, assignments created, grading activity | attendance + exam/quiz tables |
| Guardian | weekly active guardians, progress views, payment actions | guardian + finance tables |
| School | attendance adoption %, fee collection rate, retention | derived, finance dashboard |
| Accessibility | adoption of reading/calm-mode settings (aggregate only, never diagnostic) | settings table |

Implementation note: a single `usage_events` table (user, role, event, entity, ts) written
server-side covers this without touching user-facing code — V12/V13 candidate.

## L. Navigation IA (target)

Task-first sidebars per role (replaces feature lists):

- **Learner**: Home · Learn · Practice · Exams · Progress · Help (Tutor)
- **Teacher**: Home · Classes · Attendance · Assignments · Assessments · Progress
- **Guardian**: Home · My Children · Learning · Attendance · Progress · Fees
- **School Admin**: Home · Learners · Staff · Classes · Attendance · Academics · Fees & Payments · Reports · Settings
- **Super Admin**: Tenants · Health · Audit · Support

Roll into the UX-refinement phase (Phase 5) after P0 evidence is locked; do not reshuffle nav
before the release gate completes.

---

## 30 / 90 / 180 / 365-day roadmap

**30 days** — close release gate → clean-PG tag → staging deploy → Innovate Now testing →
3 pilot schools signed → assignments domain started.

**90 days** — pilot running: weekly metrics reviewed; parent digest shipped; SMS
announcements; deployment-cost model from real onboarding; device-usage data collected;
pricing experiment read-out.

**180 days** — retention/outcome evidence; holiday learning packs; M-Pesa production
(credentialed, callback verified) for at least one school; offline PWA hardening;
accessibility validation round with real learners.

**365 days** — operating as a business: contracted deployments, support process, device
strategy decision (PWA+MDM vs. native) made from pilot data, case studies, funding
conversations from evidence.

## Remaining risks

1. Single-maintainer bus factor; docs now comprehensive but CI must be the enforcer.
2. M-Pesa production is credential-gated — the honest UI state is correct; do not soften it.
3. Accessibility claims are code-review + axe-E2E level, not yet validated with real learners
   with disabilities — schedule an assisted-testing session during the pilot.
4. The pilot's data-governance consent flow needs a school-signable artifact before day one.
