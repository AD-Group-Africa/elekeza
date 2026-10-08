# ELEKEZA — PRODUCT

> Canonical product definition. Statuses: **IV** implemented+verified · **INV** implemented, not fully
> verified · **P** partial · **D** designed only · **B** blocked external · **PM** post-MVP · **O** obsolete.

## 1. What Elekeza is

An **inclusive learning and education infrastructure platform** for the Kenyan CBC context: accessible
learning + learner support + school operations + guardian connection + educational intelligence, with
the learner at the center.

### Core product promise

| User | Promise |
|---|---|
| Learner | “Can I access learning in a way that works for me?” |
| Guardian | “Can I understand how my child is learning and support them?” |
| Teacher | “Can I understand this learner and teach/support them effectively?” |
| School | “Can we provide inclusive learning while managing the institution properly?” |
| Elekeza | “Can we connect these people and systems without making the learner disappear inside an ERP?” |

### Explicit non-goals / identity guards

- No diagnosis of disabilities; no clinical claims; no medical language (enforced by backend tests
  via a diagnostic-phrase blacklist on AI/summary output).
- AI never replaces teachers, guardians, therapists or medical professionals; AI never invents
  learner performance — every insight originates from stored data.
- **Safiri (transport) is a separate product** — absent from this repo by decision.
- Not an ERP with an accessibility feature attached — the learner is the center.

## 2. Learner models (all first-class)

```
MODEL A — independent learner        MODEL B — learner + guardian        MODEL C — the ecosystem
   LEARNER → Elekeza                     GUARDIAN → LEARNER → Elekeza       SCHOOL ⇄ (TEACHER, GUARDIAN) ⇄ LEARNER → Elekeza
```

- Model A (IV): learner home is self-sufficient — Continue learning, My Assignments, quizzes,
  progress, How I Learn, Elekeza Assist.
- Model B (IV): guardian sees only linked wards; ward page is a Today-oriented summary (digest,
  lessons, attendance, classwork, fees) — not school ERP access.
- Model C (IV): institution-scoped teachers; guardian links with relationship labels
  (PARENT/CAREGIVER/OLDER_SIBLING/LEGAL_GUARDIAN/OTHER); admin links/unlinks via CSV import or
  Guardian Links panel. Guardian self-registration is intentionally absent (admin-mediated) (P).

## 3. Assistive technology identity (must stay real)

Elekeza currently supports different learning needs through **accessibility, not medicine**:

| Need area | How Elekeza supports it today | Status |
|---|---|---|
| Reading difficulties / dyslexia-type needs | OpenDyslexic + font scaling, spacing controls, chunked sections, TTS read-aloud, adaptation codes (CLEARER/STEP_BY_STEP/SPACED) | IV |
| Dyscalculia-type needs | step-by-step structuring, examples-first presentation, low-distraction surfaces | IV (presentation-level) |
| Autism-related sensory/cognitive needs | calm theme + calm mode (flat surfaces, motion ~0), controlled visual complexity, predictable navigation | IV |
| Attention difficulties | one primary action per screen, focus mode, spaced presentation | IV |
| Intellectual disabilities | simplified language via AI adaptation (validated, curriculum-preserving), larger targets, forgiving feedback | IV |
| Cerebral palsy / motor access | large touch targets, no precision gestures, full keyboard operability in shells, no timed lesson gates | IV |
| Language barriers | Kiswahili toggle where implemented (LanguageToggle component); simplified explanations | P |
| Different speeds | self-paced lessons, persistent progress, no penalty for repetition | IV |
| Different communication preferences | read-aloud, visual support, guardian/teacher messaging | P (messaging has EL-NEW-02 defect) |

**Never claimed:** diagnosis, therapy, clinical grading, or outcome guarantees. Where a need is named
in UI (e.g. CSV `sneType`), it is a school-recorded support-need field — never surfaced as a label to
other learners, never derived by AI.

## 4. Parent + child relationship (explicit design)

```
GUARDIAN ──supports──▶ LEARNER ──learns──▶ ELEKEZA (Learning · Progress · Accessibility · Assistance · Communication)
```

Guardians can see: what their child is working on, recent learning activity, progress, completed and
upcoming classwork, attendance, fees balance, teacher communication, school-relevant information.
Guardians cannot see: other learners, internal teacher tools, school administration, raw internal
data. Enforcement is server-side (ward-link checks → 403), verified by journeys and suites.

## 5. Feature status ledger

| Feature | Status | Notes |
|---|---|---|
| School onboarding (register → SCHOOL_ADMIN) | IV | 201, E2E act 1 |
| CSV learner import + guardian linking + one-time credentials | IV | 8-column template; import UI shows learner logins panel (fix r2) |
| Staff management (teachers etc., one-time temp password, reset) | IV | create response carries tempPassword once (fix r2) |
| Content creation (text/PDF/DOCX → AI lesson) | IV | honest AI failure → raw text + clear message |
| Lessons (sections, key terms, progress) | IV | |
| Quizzes (server-scored, no key leakage, review, 409 dup) | IV | |
| Adaptive presentation (5 codes + original) | IV | deterministic; AI path validated |
| How I Learn preferences + teacher guidance + guardian summary | IV | precedence EXPLICIT>TEACHER>GUARDIAN>OBSERVED>SYSTEM |
| Assignments (teacher assign → learner list) | IV | |
| Attendance (register, history) | IV | light-theme outlier — see UX doc |
| Guardian wards / Today digest / progress / fees / communication | IV (communication P) | EL-NEW-02 messages sender-only |
| Notifications (in-app + bell) | IV | toast/notification UX clash → fixed by Elekeza Assist redesign (UX doc) |
| Fees + M-Pesa (mock mode honest) | IV code / B live | Daraja credentials required |
| Analytics (role-scoped) | IV | learner/teacher/guardian/admin scopes tested |
| Elekeza Assist (floating assistant) | **this session** | UX closure phase — see UX doc |
| Mobile bottom navigation | **this session** | UX closure phase |
| Classes (creation) | P | EL-F-007: seed-only classes; creation blocked on scope decision |
| Offline reads / cached lessons | IV | offline answer queue exists; preference-write sync PM |
| Exams/CBT, marketplace, government, therapist, subscriptions engine | D→PM | Coming-Soon placeholders |
| Google OAuth | O | never implemented; legacy comment only |
| Safiri | O | separate product |

## 6. Guardian “Today” home (design contract)

The guardian dashboard answers four questions at a glance — what my child is learning, what they
completed, anything I should know, how progress is going — via the **Today at a glance** card
(lessons done, attendance, classwork ✓/○/past-due, fees balance) followed by progress history and
teacher communication. Plain language only; relationship chips (Parent / Caregiver / Older sibling)
instead of jargon; no confidence scores or internal labels.
