# ELEKEZA — PRODUCT & DEVELOPMENT BRIEF

**Prepared for:** AT4D (Assistive Technology for Development)
**Prepared by:** AD Group / Afrika Digitalis — engineering
**Date:** 20 November 2026
**Status of the platform:** engineering-validated locally; **hosted pilot environment not yet live**
**Release target:** 30 November 2026 (controlled pilot readiness)

> This brief separates what is **built and tested** from what is **planned**. Where a capability is partial,
> it says so. No demonstration URL is included, because none exists yet — a URL will be shared only after the
> staging environment has been deployed and health-checked.

---

## 1. The product

### 1.1 The problem

In Kenyan inclusive classrooms, one teacher may be responsible for forty learners across several learning
needs, with a single set of printed materials and no time to adapt content per child. The consequences are
predictable and unfair:

- A learner with dyslexia receives the same dense paragraph as everyone else, and falls behind in reading
  rather than in understanding.
- A learner with ADHD receives an unbroken wall of text with no structure, and loses the thread.
- A learner with an intellectual disability meets vocabulary that was never simplified for them.
- A guardian — often the only person who can help at home — has no visibility into what was taught, what was
  missed, or what the child is supposed to practise.
- The school cannot evidence any of this to a county officer, a funder, or a parent.

Adaptation, in practice, is a paper exercise that depends on an individual teacher's goodwill and stamina. It
does not survive a staffing change.

### 1.2 Who Elekeza is for

| Beneficiary | What they get |
|---|---|
| **Learners aged ~10–18 with disabilities** | The same curriculum, presented in a form they can actually read: simplified language, structured sections, text-to-speech, calm visual themes, adjustable text size, an AI tutor that answers at their level |
| **Teachers in inclusive classrooms** | Upload existing material (text, PDF, DOCX) once; receive adapted lessons and quizzes; see per-learner progress; record attendance; message guardians |
| **Guardians** | A linked view of their own child's progress, attendance, fees and teacher messages — and nothing about any other child |
| **School administrators** | Staff and learner management, class and timetable setup, attendance and finance review, all scoped to their institution |
| **County / government users** | Aggregated, non-identifying views for planning (in build; not part of the pilot scope) |

### 1.3 Product vision

Every learner in an inclusive Kenyan classroom gets material at their level, every day, without waiting for a
teacher to have a spare evening — and every guardian can see it happening.

### 1.4 Main modules (built)

| Module | What it does | State |
|---|---|---|
| Authentication & onboarding | Email/password with JWT access + refresh cookies, CSRF, per-account login throttling; learner placement and profile capture | Built |
| Cognitive profile | Learner profile (ADHD, autism, dyslexia, intellectual disability, or none) drives adaptation | Built |
| Content ingestion | Paste text, or upload PDF/DOCX/TXT — server extracts, then runs the adaptation pipeline | Built |
| AI adaptation pipeline | Four stages: profile, simplify, verify, concepts — with a fail-closed posture | Built |
| Lessons & progress | Sectioned lessons, per-section progress, resume, streaks and badges | Built |
| Quizzes | Generated per lesson, answered and scored, with replay protection and review | Built |
| AI tutor | Contextual question answering at the learner's level; glossary translation to Kiswahili for common school terms | Built (partial language coverage — §2.4) |
| Accessibility settings | Theme (dark/light/calm), text scale, reduced motion, high-contrast focus, TTS on/off and rate, plain language | Built |
| Teacher tools | Learner lists, attendance, assignments, content, progress, messaging, exams, timetable | Built |
| Guardian tools | Ward progress, reports, fees, schedule, messaging, weekly digest | Built |
| School administration | Institution profile, staff management, classes, attendance and finance review | Built |
| Platform administration | Cross-institution controls, feature flags, analytics | Built |
| Fees & payments | Fee records, M-Pesa integration with server-side status verification and reconciliation | Built, **deliberately inactive** (no live financial activation) |
| Privacy & governance | Consent capture, account erasure, retention rules, audit logging | Built |
| Notifications | In-app, SMS and email providers behind a mock-by-default boundary | Built with mock providers |

### 1.5 The inclusive-learning proposition, precisely stated

Supported and demonstrated:

- **Text-to-speech** for lesson sections, driven by the browser's speech synthesis, with adjustable rate.
- **Simplified language**, generated per cognitive profile, with a plain-language toggle.
- **Calm theme** with reduced motion, plus adjustable text scale (0.9×–2.0×) and high-contrast focus.
- **Structured, sectioned lessons** with one idea per section and explicit progress, which is the single most
  effective accommodation for attention differences.
- **Low-bandwidth posture**: the frontend is a PWA with a service worker caching lesson, quiz and progress
  responses, so a dropped connection does not lose a lesson.

Not claimed:

- **No conformance claim to WCAG or any accessibility standard.** Automated axe-core scans and keyboard
  checks run in the browser test suite, and structural accessibility was built in deliberately, but a formal
  audit has **not** been performed and will not be claimed without one.
- **No disability-specific efficacy claim.** The platform adapts presentation; it does not treat, diagnose or
  replace specialised instruction.
- **Kiswahili is partial** (§2.4).

### 1.6 Technical architecture

```
Learner / Teacher / Guardian
        │  HTTPS
        ▼
Next.js PWA (App Router, React 19, TypeScript, Tailwind)
  · 60 routes across five role experiences
  · service worker caches lesson/quiz/progress reads
        │  same-origin /api/* (proxied, env-driven)
        ▼
Kotlin / Spring Boot 3 backend            ──►  PostgreSQL 16 (Flyway, 21 migrations)
  · stateless JWT access (15 min) +          ──►  AI service (FastAPI, internal shared secret)
    hashed refresh (7 days)                        · 4-stage pipeline
  · role + institution scoping                     · Groq/OpenAI-compatible provider
  · Bucket4j login throttling                      · fail-closed: no secret, no calls
  · audit logging, privacy module
        │
        └──► providers behind interfaces: SMS (Africa's Talking), email (SMTP),
             storage (Cloudflare R2), M-Pesa — all mock by default
```

Android exists as a **Capacitor WebView shell** around the hosted PWA. It is not a native application and
should not be described as one. It is not part of the pilot package.

---

## 2. Progress

### 2.1 Verified engineering achievements (all re-run 2026-11-20)

| Component | Evidence |
|---|---|
| Backend test suite | **417 tests, 64 suites, 0 failures** |
| AI service suite | **603 tests passing** |
| Frontend unit suite | **84 tests passing** |
| Browser end-to-end suite | **46 journeys across five roles**, including negative role-guard tests |
| TypeScript / ESLint / production build | clean / clean / exit 0 (60 pages) |
| Database | 21/21 migrations on PostgreSQL 16; full dump-and-restore drill passed with schema and row parity |
| Backup integrity | mirror `fsck` clean (49 refs), two bundles with complete history, 11 artifacts checksummed |
| Secret scan | no secret in the working tree; no tracked environment file |
| Dependencies | **0 high, 0 critical** advisories in the production tree (was 1 high) |
| Repository consolidation | three unrelated git histories identified, analysed and reconciled in a documented, reversible plan |

The full evidence trail, including exact commands and counts, is in `docs/testing/TEST_RESULTS.md` and the
`docs/deployment/` reports.

### 2.2 Demonstrated capabilities

The browser suite demonstrates, against a real backend and database, that a learner can sign in, open an
adapted lesson, complete it, take a quiz and see progress; that a teacher can see only their own learners,
record attendance and assign material; that a guardian sees only their own ward and is refused another
learner's record; and that a learner is blocked from school-administration surfaces **without any privileged
API call being issued**.

### 2.3 Known limitations (stated plainly)

| Limitation | Consequence for a pilot |
|---|---|
| **No hosted environment yet** | Nothing can be demonstrated over the internet until staging is provisioned |
| **Five-role acceptance has only been run locally** | TLS, CORS, cross-origin cookies and managed-database behaviour are unproven in a hosted setting |
| **No error monitoring in production** | Failures are diagnosable through request ids and logs, but there is no alerting |
| **Login throttling is per-instance** | Fine for a single-instance pilot; not for horizontal scaling |
| **AI endpoints have no per-user quota** | A pilot needs a daily limit per learner before real usage, for cost control |
| **Payments are inactive by design** | No live M-Pesa; fee views are populated from records, not transactions |
| **Android is a remote-URL shell** | No offline app; the PWA in a mobile browser is the supported mobile experience |
| **No load test** | Concurrency behaviour at pilot scale is unmeasured |

### 2.4 Kiswahili — accurate scope

- Lesson **content** can be translated to Kiswahili on request (AI translate action, with a learner-facing
  "Translate Content" setting).
- The tutor includes an **offline English→Kiswahili dictionary** for common school vocabulary, used when the
  provider is unavailable.
- **The interface itself is English-only.** There is no i18n layer, no Swahili UI strings, and no locale
  switching.

For a Kenyan inclusive-education pilot this is the most significant product gap, and AT4D's practitioner
feedback is the right input to fix it properly.

### 2.5 Outstanding development (prioritised)

| Priority | Item |
|---|---|
| 1 | Provision and validate staging; run the hosted five-role acceptance |
| 2 | Per-learner daily AI quota (cost and abuse control) |
| 3 | Error monitoring with PII scrubbing |
| 4 | Kiswahili interface localisation |
| 5 | Educator validation feedback loop and content alignment |
| 6 | Android release signing + device testing (only if schools require an installed app) |
| 7 | Distributed rate limiting, load test, PITR backups (before any real learner data at scale) |

---

## 3. Roadmap

| Phase | Window | What happens | Gate |
|---|---|---|---|
| **1. Stabilisation** | to 24 Nov 2026 | Security remediation (done), dependency audit (done), documentation (done), lineage decision with the repository owner | Zero high/critical advisories; suites green; branch strategy approved |
| **2. Staging** | 24–26 Nov 2026 | Provision backend, AI service, managed PostgreSQL and frontend; HTTPS, secrets, migrations | Health endpoints up, 21 migrations applied, HTTPS + HSTS verified |
| **3. Hosted acceptance** | 26–28 Nov 2026 | Five synthetic roles exercised on the hosted origin, including all negative tests | Every positive journey passes; every negative attempt is refused |
| **4. Educator validation** | 28 Nov – 6 Dec 2026 | AT4D-connected teachers and practitioners review adapted lessons and the tutor; structured feedback | Feedback register opened; blocking defects triaged |
| **5. Controlled pilot** | from 7 Dec 2026, only with separate approval | A small number of schools, synthetic-then-real accounts under a data-protection agreement, defined success measures | Sign-off on data handling, monitoring, backups and support ownership |
| **6. Post-pilot** | Q1 2027 | Kiswahili UI, offline Android, curriculum alignment, county-level reporting, cost/efficacy evaluation | — |

Production release remains on hold until the repository owner explicitly approves it **after** a final
release-gate report. Staging is not production, and a green build is not a deployment.

---

## 4. Support requested from AT4D

1. **Introductions to pilot schools** — two to four inclusive primary schools in or near Nairobi, with a
   named teacher contact and a school administrator willing to review the admin experience.
2. **Access to inclusive-education practitioners** — special-needs teachers, educational psychologists or
   itinerant support staff who can critique the adaptations, not just the interface.
3. **Educator and caregiver feedback** — structured sessions where teachers try to prepare a real lesson and
   guardians try to read their child's progress; we want the friction, not the praise.
4. **Accessibility and assistive-technology expertise** — review of our TTS, text scaling, calm theme and
   reading flow; guidance on what is missing for specific disabilities (particularly low vision and deaf/hard
   of hearing learners, which we have not addressed).
5. **Curriculum alignment** — help mapping our adaptation output to the Kenyan competency-based curriculum
   expectations for the target grades, so a teacher can trust it in class.
6. **Device and connectivity guidance** — realistic minimum device profiles and typical school connectivity,
   so we can size the PWA cache and set honest expectations.
7. **Pilot evaluation design** — assistance defining what "working" means measurably (reading fluency,
   lesson completion, guardian engagement) and how to collect it ethically with minors.
8. **Institutional partnerships and potential funding** — introductions to county education offices, donors or
   programmes that fund inclusive-education technology, and guidance on the procurement route in Kenya.

---

## 5. Access model for institutional review

### 5.1 What an institutional reviewer will receive

A **demonstration package**, delivered once staging has passed health checks:

| Item | Detail |
|---|---|
| Staging URL | shared only after the checklist in `FIVE_ROLE_HOSTED_ACCEPTANCE_REPORT.md` §6 passes |
| Four role accounts | learner, teacher, guardian, school administrator — unique credentials, delivered through a channel the project owner controls, never in email bodies or documents |
| Role access guide | a one-page map of what each role can see, and what it deliberately cannot |
| Synthetic data | two classes, a handful of learners, guardians, adapted lessons and quizzes — no real child's information |
| Feedback and issue register | where reviewers log problems; triaged weekly |
| Data-handling note | what is stored, where, for how long, and how to request deletion |

### 5.2 What is deliberately withheld

- **Platform administrator credentials.** The platform-admin role is demonstrated live by the Elekeza team.
  External accounts are not granted platform-wide access.
- **Payment credentials and live M-Pesa.** No financial activation is in scope for review.
- **Any real learner data.** None will be loaded during validation.

### 5.3 Data handling for reviewers

- All demonstration data is synthetic and clearly labelled.
- Accounts are time-boxed and revoked at the end of the review window.
- The platform records consent, supports account erasure and applies retention rules; the same rules apply to
  demonstration accounts.
- Reviewers are asked not to enter real child information anywhere in the system during review.

---

## 6. What we are asking for at the 20 November session

1. Confirmation of which schools or practitioners can be introduced, and by when.
2. A named AT4D contact for accessibility review of the adaptation output.
3. Agreement on the pilot evaluation questions, so data collection starts with a purpose.
4. Candour on what would make Elekeza **not** worth piloting — that is more useful than encouragement.

We would rather hear a hard objection in November than discover it in a classroom in January.
