# ELEKEZA — FINAL FULL USER-JOURNEY CLOSURE AUDIT

Date: 2026-10-01 · Branch `integration/staging-reconciliation` · HEAD `b139b8e` (tag `v0.1.0-pilot-r2`, untouched)
Working tree: 39 porcelain lines (pre-existing engagement diff + audit artifacts; nothing committed, per rules).

```text
FRONTEND:  Next.js 16.3.3 (dev, --webpack)  http://localhost:3100  (3000 occupied by unrelated project)
BACKEND:   Spring Boot/Kotlin (prod profile) http://localhost:8097  {"status":"UP"}
AI:        ai-elewa FastAPI/uvicorn          http://localhost:8001  {"status":"ok"}  Groq qwen (frozen r2)
DATABASE:  PostgreSQL 15 @ localhost:5433     elekeza_chain_scratch  DEMO_SEED=true (scratch)
ENV:       Local demo stack; CORS allowlist = :3100; ports 3000/8000/8090 belong to other projects
```

Method: real browser (Electron preview, persist + incognito partitions), UI-driven logins, full journeys per role, DOM snapshots, console/network capture, direct-URL & refresh & back-nav & logout probes, DB cross-checks via psql, curl ground-truth on every anomaly. No code changed. Demo-data setup (disclosed): inserted `classes` row "Grade 4 Blue" + one enrollment via psql (no class-creation API exists — finding EL-F-007); admin/superadmin passwords aligned to `teacher123` in scratch DB (previously disclosed).

---

## Executive Result

```text
OVERALL:            NOT READY — BLOCKED BY VERIFIED P1 FINDINGS (all agent-fixable, small scope; NO P0)
MARKET JOURNEY:     Core value chain PROVEN end-to-end (teacher→AI→learner→quiz→progress→guardian)
P0: 0   P1: 4   P2: 3   P3: 5 (+1 known pre-existing B2 M-Pesa seam, P1, not re-driven)
EXPECTED 403s:      staff mgmt, finance, billing (no institution), ward-2 cross-guardian, unauth probes
UNEXPECTED 403s:    every session-expiry event (root: expired JWT returns 403 + FE keys recovery on 401 only)
500s: 0   404s: 0 (in-app "Quiz not found." was a masked 403, EL-F-005)
Console errors:     dev-noise only (HMR/Fast-Refresh) + the 401/403s attributed below; no hydration/React crashes
Failed network:     all accounted for in ledger
Journeys completed: Learner FULL · Teacher FULL · Guardian FULL · School Admin PARTIAL (seed-degraded)
Journeys blocked:   M-Pesa payment completion (B2, pre-existing); attendance UNTIL a class exists (EL-F-007)
```

## Journey Matrix

| Role | Journey | Result | Evidence | First Failure |
|---|---|---|---|---|
| School Admin | Login→dashboard→staff→finance→attendance→onboarding→settings | PARTIAL PASS | snapshots + screenshots | `/admin/staff` "account is not linked to a school" (EL-F-001, seed) |
| Teacher | Login→dashboard→lessons→AI upload→simplify→assign→attendance | PASS (with findings) | lesson/3 READY screenshot; DB session/record rows; assignment rows | UI save 403 once (EL-F-006 flake); curl re-drive → 200 persisted |
| Learner | Login→home→lesson→reading mode→tutor→quiz 5Q→80%→XP→progress→prefs | PASS (with findings) | review-answers screenshot; DB attempt 16 (score 80, completed) + 5 answers | mid-quiz session death → false feedback (EL-F-005/006) |
| Guardian | Login→dashboard→ward→isolation→fees→communication→notifications | PASS (with findings) | ward detail (avg 50%); DB notification id 5 + QUIZ_COMPLETED id 4 | thread renders "No messages yet." (EL-F-009) |

## Core Education Matrix

| Capability | UI | API | DB | E2E | Real Journey |
|---|---|---|---|---|---|
| Lessons | ✔ | ✔ | ✔ (content 3 READY, 4 sections) | ✔ | ✔ teacher upload→AI→learner read |
| Quiz | ✔ | ✔ | ✔ attempt 16 = 80%, 5 answers | ✔ | ✔ incl. deliberate wrong answer |
| Progress | ✔ | ✔ | ✔ | ✔ | ✔ mastery guidance rendered |
| Attendance | ✔ | ✔ | ✔ session 1, PRESENT | ✔ | ✔ teacher→guardian consistent |
| AI Tutor | ✔ | ✔ | n/a | ✖ (gap) | ✔ `source:provider`, `/ai/tutor/chat 200` |
| AI Simplification | ✔ | ✔ | ✔ | ✖ | ✔ raw text→4 sections+glossary |
| Quiz Generation | ✔ | ✔ | ✔ 5 AI questions | ✖ | ✔ keys correct (DB-verified) |
| Accessibility | ✔ | ✔ | ✔ | partial | PARTIAL — toggles save but don't render (EL-F-008) |
| Guardian Progress | ✔ | ✔ | ✔ | ✔ | ✔ 50% avg consistent |
| Notifications | ✔ | ✔ | ✔ | partial | ✔ in-app incl. auto QUIZ_COMPLETED; provider delivery = env |
| Finance | ✔ | ✖ | ✖ | ✖ | ✖ initiate-only; callback seam (B2) |

## 403 Matrix (all observed 403s)

| Role | Endpoint | Expected? | UI Handling |
|---|---|---|---|
| any (session expired) | many GET/POST | **NO — defect family** (EL-F-006) | varies: false empty states, loops, raw error, "Not authorized." |
| SCHOOL_ADMIN (no institution) | staff/finance/billing | YES (seed context) | graceful messages (EL-F-001) |
| GUARDIAN → ward 2 | wards/2/learning-support | YES | "Ward not found." alert, nav usable ✔ |
| unauthenticated | /auth/me pre-login probes | YES | login page normal |
| TEACHER (fresh curl) | attendance save | NO — returns 200 | n/a (browser 403 was session flake) |

## Failure Ledger

| ID | Severity | Role | Area | Failure | Evidence | Status |
|---|---|---|---|---|---|---|
| EL-F-001 | P3 | Admin | Seed data | SCHOOL_ADMIN has `institutionId=NULL` → staff/finance/billing unusable; "Students by Grade" empty despite 1 student | staff page screenshot; finance message | OPEN (seed fix or onboarding flow) |
| EL-F-002 | **P1** | all | FE interceptors | 401-only recovery: on 403 the app shows false "No assignments yet", loops `/notifications/unread` 403s, honest-but-cryptic "Not authorized." | network logs (repeated 403 loops) | OPEN (one fix: handle 403-as-expiry for authed users) |
| EL-F-003 | P3/env | all | Browser partition | Ephemeral (incognito) partition drops HttpOnly cookies on reload → session dies; persist partition survives | reload probes both partitions | OPEN (environment; prod Chrome unaffected) |
| EL-F-004 | P2 | Learner | /progress | Raw axios message "Request failed with status code 403" rendered as page | snapshot | OPEN |
| EL-F-005 | P2 | Learner | Quiz | Auth failure masked as "Quiz not found."; instant feedback fabricated during 403s ("Not quite" on a CORRECT answer); server truth stayed correct (queue/recovery worked, score honest) | network (5×403) + DB attempt 16 (80%) | OPEN |
| EL-F-006 | **P1** | all | BE+FE contract | Expired access JWT → empty-body 403 (not 401); 15-min access cookie guarantees mid-journey recurrence; refresh mechanism itself works (curl+in-page proven) | refresh 200 immediately after re-login; 401 after expiry | OPEN (make expiry 401, or FE refresh-on-403) |
| EL-F-007 | P2 | Admin | Product gap | No class-creation endpoint/UI → attendance dead-ends until DB/seed insert (honest in-app note) | attendance empty state; only `SchoolClass` entity, no controller | OPEN (needs API+UI or seed) |
| EL-F-008 | **P1** | Learner | A11y CSS | A11y toggles (Dyslexia Font, Large Text, High Contrast) toggle body classes that **no stylesheet defines** → zero visual change; "Listen to lessons" pref never surfaces TTS button on lessons; Reading mode + TTS engine work | computed styles Inter 16px after toggles; `grep a11y-high-contrast` in CSS = 0 hits | OPEN (add CSS mappings + Listen button) |
| EL-F-009 | **P1** | Guardian | Messaging | Communication thread renders "No messages yet." while `GET /api/guardian/messages` returns the persisted message (id 5); send + notification badge work | network 200 + DB row vs UI snapshot | OPEN (thread read-side filter bug) |
| EL-F-010 | P3 | Teacher | UX | Assignment form takes raw numeric Lesson/Student IDs | form snapshot | OPEN |
| EL-F-011 | P3 | Teacher | UX | Assignment success refreshes silently (no toast); false-empty risk pairs with EL-F-002 | snapshot | OPEN |
| EL-F-012 | P3/env | all | Cosmetic | Freebuff overlay overlaps app hamburger in embedded preview only | screenshots | OPEN (env) |
| B2 (pre-existing) | P1 | Guardian/Finance | M-Pesa | Mock gateway doesn't persist INITIATED transaction → callback leg rejects; initiate+UI fine | earlier chain evidence; not re-driven | OPEN (known, ~20-line fix) |

## What Actually Works (proven this run)

1. **Flagship teacher loop**: type text → Upload → AI simplify → `/lesson/3` READY (AI-retitled "Understanding Fractions", 4 sections, glossary) → assign → learner's home/features/progress all reflect it.
2. **Learner quiz loop**: 5 real AI questions, per-answer flow, back-nav preserves selections, deliberate wrong answer, submit → 80%, +10 XP, badge, stars 1→2, points 12→24, mastery guidance on /progress; DB attempt/answers exactly consistent; review screen with ✓/✗ + explanations (screenshot).
3. **AI tutor in-UI**: contextual provider response adapting to the earlier wrong answer (`/ai/tutor/chat 200`); honest offline Kiswahili fallback; graceful error card when unauthenticated; no blank screens.
4. **Attendance**: roster→mark→save→DB→guardian sees 100% rate; duplicate-save is UPDATE (idempotent), roster validation, 200-entry cap in code.
5. **Guardian**: consistent dashboards (50% avg = (20+80)/2), auto-notification "Juma Ali scored 80%… 🎉", message send persists, ward isolation 403 → graceful UI, honest fees empty state.
6. **Auth mechanics**: login (UI+API), logout clears session+refresh cookie, refresh endpoint works, unauth deep-links bounce to login.
7. Honest empty/error states everywhere except the F-002/004/005 family.

## Every 4xx/5xx Observed
401: pre-auth probes + expired sessions (correct for those cases) · 403: listed in 403 Matrix · 400: my malformed hand-rolled PUT (correct validation) · 429/409/500/502/503/504: none.

## Known Environmental Gaps (not code defects)
Production PostgreSQL (B3) · domain/TLS (B4) · AI service deployment (B5) · Daraja credentials (B6) · backup schedule/offsite (B7) · pushed tag (B8) · real SMS/Email providers · Sentry · B1 commit pending · incognito-partition cookie behavior (EL-F-003) · embedded-preview overlay (EL-F-012).

## Remaining Engineering Work Before Pilot (verified, in order)
1. **EL-F-006** (root enabler): return 401 on expired-JWT auth failures, or add 403→refresh-once handling in `frontend/src/lib/api.ts` + `axios.ts`. Small.
2. **EL-F-002/004/005**: with 401 fixed, add honest per-page failure states for 403s (assignments/quiz/progress). Small-medium.
3. **EL-F-009**: guardian communication thread must render `GET /api/guardian/messages` results. Small.
4. **EL-F-008**: define CSS for `a11y-high-contrast/a11y-large-text/dyslexia` classes; surface Listen button when `listenToLessons` on. Small.
5. **B2**: persist INITIATED `MpesaTransaction` in mock gateway path; re-verify initiate→callback→DB→idempotency. Small.
6. **EL-F-007**: class-creation endpoint+UI (or seed classes for pilot). Medium.
7. **EL-F-001**: seed an institution-linked SCHOOL_ADMIN (or route admin through onboarding). Small.
8. Codify this audit's learner/AI-tutor flow as a Playwright spec (closes the named E2E gap permanently).

## §31 Gap Status vs Previous Closure Audit
B1 OPEN · B2 OPEN · B3–B8 BLOCKED BY ENVIRONMENT · AI-tutor-UI E2E gap **CLOSED BY THIS AUDIT** (recommend codifying) · accessibility-preference-application **PARTIAL** (pedagogy prefs apply; visual toggles don't — EL-F-008) · finance payment journey KNOWN FAILURE (B2) · notifications UI **CLOSED** (in-app verified; provider = env) · school-admin deep journey **EXECUTED** (degraded by seed, EL-F-001).

## Market Journey Verdict

**NOT READY — BLOCKED BY VERIFIED P1 FINDINGS**

(Evidence-based, not credential-based: the four P1s — session-expiry UX family, guardian thread read-side, a11y CSS orphans, M-Pesa mock seam — are all agent-completable, estimated 1–2 days combined. On completion, the application qualifies for **READY FOR HUMAN PILOT ACCEPTANCE** with the environmental checklist above.)
