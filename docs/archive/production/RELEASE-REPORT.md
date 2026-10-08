# Elekeza Release Report — Exams Complete, Marking Live, User-Ready

Date: 2026-09-07 (hardening pass) · Scope: exam state-machine audit, short-answer marking, tester package, clean-browser registration pass, security negative pass

## Executive status

```text
READY WITH KNOWN LIMITATIONS
```

The full student → teacher → guardian exam journey is real, server-authoritative and live-verified,
**including teacher manual marking of written answers with feedback**. Clean-browser registration
was walked end-to-end. Remaining items are external credentials (M-Pesa, SMS, SMTP, OAuth, R2,
Groq production key) and explicitly deferred scope — no code blockers.

## What was already green and preserved

- Backend suite 128/128 (now 142/142) — auth, RBAC, IDOR, M-Pesa chain, personalization
- Frontend typecheck / lint / production build
- 40/40 pre-existing live journey checks (two-institution IDOR, guardian matrix, rate limiting)
- M-Pesa single-ledger architecture, callback idempotency + amount binding
- AI service (ai-elewa) with fail-fast config and mock fallback

## What was completed (this sprint)

### Exams — backend (new module `com.elekeza.backend.exam`)
- `V8__exams.sql`: exams, exam_questions (MCQ / TRUE_FALSE / SHORT_ANSWER), exam_attempts,
  exam_answers (unique per attempt+question), exam_integrity_events
- `ExamService`: server-authoritative lifecycle — availability windows, attempt limits,
  start/expiry timing (client timer is display-only), duplicate-submission protection,
  expired-attempt reconcile with auto-marking, auto-marking of objective questions,
  guardian results scoped by active guardian link (matches existing GuardianController model)
- `ExamController`: 14 endpoints, `@PreAuthorize` RBAC on every route; students cannot touch
  authoring; integrity events are staff-only reads; audit logging on every state change
- Student-facing responses never include correct answers or model answers

### Exams — frontend
- `examAPI` client added to `src/lib/api.ts`
- `/teacher/exams`: full authoring (title/subject/duration/attempts/questions/marks/correct
  answers), publish/close, results table with **per-attempt Review dialog** — teacher marks
  short answers (bounds-enforced 0..max) with learner feedback, total recalculates live
- `/student-exams`: exam list, runner with server-deadline countdown, autosave (debounced,
  plus final answers submitted with the submission), integrity event reporting
  (TAB_HIDDEN / WINDOW_BLURRED / FULLSCREEN_EXITED / NETWORK_LOST — advisory, never auto-fail),
  fullscreen exam mode offered honestly, submit with confirmation state, past results with
  per-question breakdown and teacher feedback
- `/exam` legacy route: ComingSoon replaced with role-aware redirect
- Sidebar: Exams added for teacher and student; teacher dashboard card no longer says "Coming soon"
- Self-registered students without a school see a clean empty state (fixed: was a 409 error)

### Short-answer marking (V9)
- `V9__exam_marking.sql`: `marks_awarded` + `feedback` on exam_answers
- `POST /api/exams/attempts/{id}/mark`: staff-only, institution-scoped, short-answer only,
  marks clamped to [0, question max], submitted answers immutable, attempt total recalculated
  server-side from auto-marked + manual marks, audit-logged
- Verified live: 1.0 → teacher awards 2.5 with feedback → 3.5, student sees updated score + feedback;
  over-max (400), cross-teacher (403), student-marking (403), in-progress marking (409) all rejected

### Notifications
- Popover: Escape-to-close, outside-click close, timestamps, shadow elevation, mark-as-read
  (verified live: badge cleared, unread list updated)

### Defect found & fixed during live verification
- `requireGuardianOf` initially required institution equality, but seeded guardians carry no
  institution (links are the authorization boundary, as in `GuardianController`). Live check
  caught it (403); fixed to link-based scoping; 142/142 still green.

## Test results (exact)

```text
Backend tests:        145/145 PASS (128 prior + 14 exam + 3 marking tests)
Frontend typecheck:   PASS
Frontend lint:        PASS (0 errors)
Production build:     PASS (all routes)
Live core journey:    40/40 PASS
Live exam journey:    26/26 PASS
Live marking journey: PASS (create→submit→mark 2.5/3→recalc 3.5→student sees→bounds enforced)
Browser walkthrough:  clean registration→onboarding→dashboard ✓ · teacher authoring/
                      results/marking ✓ · student exam submit ✓ · notifications ✓
Security negatives:   unauth 403s ✓ · RBAC 403s ✓ · forged JWT 403 ✓ · forged M-Pesa
                      callback safely rejected ✓ · only .env.example tracked ✓
Mobile (409px):       no horizontal overflow on exam pages ✓
```

## Final feature matrix

| Feature | Implemented | Tested | Live | User Ready | Limitation |
| ------- | ----------- | ------ | ---- | ---------- | ---------- |
| Authentication | Yes | 145-test suite + live | Yes | Yes | Google OAuth needs config |
| Learning | Yes | Live | Yes | Yes | — |
| AI Simplification | Yes | Live (mock path) | Yes | Yes | Real key for production |
| Quizzes | Yes | Suite + live | Yes | Yes | — |
| Exams | Yes | 17 exam tests + live | Yes | Yes | — |
| Exam Results | Yes | Tests + live | Yes | Yes | — |
| Manual Marking | Yes | 3 tests + live | Yes | Yes | — |
| Progress | Yes | Suite + live | Yes | Yes | — |
| Notifications | Yes | Live UI + API | Yes | Yes | — |
| Messages | Yes | Role-gated live | Yes | Yes | Basic (feed-style) |
| Parent/Guardian | Yes | 40-check matrix | Yes | Yes | — |
| Teacher | Yes | Suite + live | Yes | Yes | — |
| School Admin | Yes | Suite + live | Yes | Yes | — |
| Payments (M-Pesa) | Yes | 6 chain tests + live | Sandbox-ready | With Daraja creds | Callback URL + credentials |

## Integration matrix

| Integration | Implemented | Configured | Tested | Production-ready | Credentials required |
| ----------- | ----------- | ---------- | ------ | ---------------- | -------------------- |
| AI (Groq via ai-elewa) | Yes | Mock fallback active | Live (mock path) | With real key | `AI_API_KEY` |
| PostgreSQL | Yes | Dev uses H2; prod profile ready | Flyway V1–V8 clean | Yes | `SPRING_DATASOURCE_*` |
| Redis | Rate limiting is in-process | Not required for pilot | n/a | Single-instance OK | — |
| M-Pesa | Yes (STK, callback, idempotent) | Sandbox-ready | 6 chain e2e + live probe | Needs Daraja creds | Daraja key/secret/passkey/shortcode + public HTTPS callback |
| Africa's Talking | Boundary implemented | Not configured | Not live-tested | Needs creds | API key + sender ID |
| SMTP | Boundary implemented | Not configured | Not live-tested | Needs creds | SMTP host/user/pass |
| Google OAuth | Button present, backend pending | Not configured | n/a | Needs creds | OAuth client id/secret + redirect URIs |
| Object storage (R2) | Boundary documented | Not configured | n/a | Needs creds | R2 keys/bucket |

## Role readiness

| Role | Register | Login | Dashboard | Learning | Quiz | Exam | Progress | Messages | Notifications | Demo ready |
| ---- | -------- | ----- | --------- | -------- | ---- | ---- | -------- | -------- | ------------- | ---------- |
| Student | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (new) | ✓ | ✓ | ✓ | Yes |
| Teacher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (new) | ✓ | ✓ | ✓ | Yes |
| Guardian | ✓ | ✓ | ✓ | ✓ | ✓ | results (new) | ✓ | ✓ | ✓ | Yes |
| School Admin | ✓ | ✓ | ✓ | ✓ | ✓ | oversight | ✓ | ✓ | ✓ | Yes |
| Super Admin | n/a | ✓ | ✓ | — | — | — | — | — | ✓ | Yes |

## Deferred (honest, not fabricated)

- Cards / USD payments, payroll, SNE_TEACHER role — out of scope by product decision
- Horizontal scale-out of the login rate limiter (Redis-backed) when multi-instance
- Exam editing of published exams (drafts only, by design)

## Tester quick-start

Full guide: **`docs/demo/TESTER-GUIDE.md`** · 5-minute demo script: **`docs/demo/DEMO-SCRIPT-5MIN.md`**

```text
Open:        http://localhost:3000
Register as: Student (or use demo accounts below)
Demo:        student@elekeza.app / student123
             teacher@elekeza.app / teacher123
             parent@elekeza.app / parent123
```

## Verdict

🟢 **READY FOR TEST USERS / DEMO / PILOT** — every tester-facing journey works end-to-end against
the live stack including manual marking; clean-browser registration walked successfully; security
negative probes all fail safely; no fake surfaces remain for in-scope features. All remaining gaps
are external configuration or explicitly deferred scope.

## AI chain addendum — verified 2026-09-08

- ai-elewa running locally (:8000, health OK, provider `groq`); deployed instance at
  https://elekeza-ai.onrender.com also healthy and correctly isolated from local secrets.
- Full chain proven: backend `RealAiClient` → ai-elewa (internal auth accepted, stage2 executed,
  retry-on-schema-invalid honored) → Groq → **401 Invalid API Key** → structured `SCHEMA_INVALID`
  with learner-safe message → backend stored content as-is (`adapted:false`) with an honest message.
- The single missing credential for the working AI pathway is a **valid Groq `AI_API_KEY`**
  (both keys currently stored in the repo's local `.env` files are rejected by Groq).
  See `docs/TESTING_CREDENTIALS_CHECKLIST.md`.
- Preview launcher now defaults to the real client (`AI_CLIENT_TYPE=real`) so the stack can never
  silently look healthy through the mock; mock output remains clearly labeled when used.
- Full evidence: `docs/TEST_EVIDENCE.md`, `docs/INTEGRATIONS.md`.
