# Personalization — Acceptance Report

Date: 2026-09-04 · Repository: Elekeza · Branch: `release/v0.1.0`

## Verdict

```
PERSONALIZATION ENGINE:      READY
ADAPTIVE SIMPLIFICATION:     READY
LEARNER EXPERIENCE:          READY
TEACHER EXPERIENCE:          READY
GUARDIAN EXPERIENCE:         READY
ACCESSIBILITY:               READY (WCAG-oriented; automated axe suite not yet in CI)
OFFLINE:                     READY (cached lessons/adaptations; prefs cache added)
SECURITY / MULTI-TENANCY:    READY
AI SAFETY:                   READY (mock in verified environments; real provider BLOCKED)
PERFORMANCE:                 READY (cached adaptations; no per-open AI calls)
PRODUCTION:                  READY (code) — external AI/notifications infra BLOCKED
```

## Implementation summary

A per-student learning-presentation profile with sourced preferences
(EXPLICIT / TEACHER / GUARDIAN / OBSERVED / SYSTEM), a profile-derived
adaptation engine (deterministic, content-preserving, with an optional
validated AI path), per-(learner, content, code) adaptation caching,
attributable events, teacher learning-support summaries with guidance (never
overriding an explicit learner choice), guardian plain-language summaries, a
learner "How I Learn" page, lesson-page adaptation controls, and a dignity-safe
language model throughout (no diagnosis inference, no stigmatising UI).

## Backend

### Automated tests — `./gradlew test` (final source)

```
tests=108  failures=0  errors=0  skipped=0
```

Coverage of the personalization stack (29–30 targeted + regressions inside the
full suite):

* preference defaults, persistence, EXPLICIT source;
* invalid preference value → 400;
* teacher guidance recorded as TEACHER;
* teacher guidance cannot override an explicit learner choice → 409, learner
  choice stands;
* learner can always change their own mind;
* teacher support summary without diagnostic labels (asserts the words
  `dyslexia`, `adhd`, `autistic`, `disability`, `diagnos…` never appear);
* teacher cannot view/guide another institution's learner → 403;
* learner cannot read other learners' profiles or act as teacher → 403;
* guardian sees own ward only, plain-language summary; another ward → 403;
* deterministic step-by-step variant preserves all source sentences; original
  available;
* lesson stored only as structured JSON (no raw_text) is adaptable — regression
  for the live bug found during E2E;
* second identical request served from cache (cached=true);
* cross-institution lesson cannot be adapted → 403 (Student B / Teacher B);
* unknown adaptation code → 400;
* feedback ×3 → teacher summary "Responds well to Step-by-step", confidence
  High;
* every adaptation + feedback event attributable (learner-scoped);
* pure-domain unit tests: deterministic transforms, safety validation,
  diagnostic-phrase rejection, signal accumulation/decay, boundary behaviour.

Phase 3 baseline (security/functional) remains green in the same run — no
regressions.

### Live API verification (running instance)

| Probe | Result |
| --- | --- |
| Teacher assigns content 1 → student | `{"assigned":1}`; assignment list shows real row |
| `GET /content/lessons/1/adapted?code=step_by_step` | 200, `source=LOCAL`, Step 1–5 text |
| 2nd identical request | `cached=true`, `source=CACHE` |
| `GET …/adapted` (no code — profile default) | `code=clearer` for SYSTEM default; `step_by_step` after profile set |
| Teacher guide `textSize=LARGE` (not learner-chosen) | `source=TEACHER` |
| Effective profile | density/explanation/examples/visual/readAloud `EXPLICIT`, textSize `TEACHER`, contrast `SYSTEM` |
| Teacher support summary | mastery, respondsWellTo [Step-by-step], High confidence, EXPLICIT profile, no labels |
| Guardian ward summary | plain-language, no labels |
| Student → teacher support endpoint | **403** |
| Student → guardian ward endpoint | **403** |
| Student → teacher guidance POST | **403** |
| Anonymous → adapted | **403** |
| Anonymous → preferences | **403** |

## Live browser E2E (Next.js dev → backend proxy)

1. **Learner login** `student@elekeza.app` → dashboard → **How I Learn**.
2. Set high-support profile (Roomier, Step-by-step, Plenty, Visual support,
   Listen) — each shows "Chosen by you" after save.
3. **Logout → relogin** — profile persisted (all five still EXPLICIT).
4. **Lesson 1 (The Water Cycle)** rendered with: Listen button, presentation
   bar (Original / My usual style / Clearer / Step-by-step / Spaced out /
   More detail).
5. **"My usual style"** → profile-derived **Step-by-step** view: Step 1–5,
   every source sentence intact; "Showing: Step-by-step" + "Back to the
   original".
6. 👍 feedback → "Thanks — Elekeza keeps learning how to teach you best."
7. **"More detail"** → chunked Part 1–5 presentation; **"Back to the
   original"** restored the authored lesson (agency verified).
8. **Teacher** `teacher@elekeza.app` → Students → **View support**: mastery,
   AI confidence, "Responds well to ✓ Step-by-step explanations", preferred
   presentation chips (friendly labels), guidance chips.
9. Teacher guidance on a learner-chosen dimension → **409** with respectful
   message ("This learner chose this preference themselves…").
10. **Guardian** `parent@elekeza.app` → ward page → "How Juma Ali is learning
    right now" plain-language card.

## Security / multi-tenancy

Cross-institution, cross-role and ownership probes are encoded as automated
integration tests (two institutions A/B, teachers/learners/guardian) covering
profiles, adaptations, summaries, guidance, feedback and events — all
cross-tenant attempts return 403. Live single-tenant negative probes above
confirm role separation on every personalization endpoint. Cache isolation:
adaptation lookups are learner-scoped by key and gated by `ContentAccessGuard`
(tests assert Student B/Teacher B cannot adapt A's lesson). AI data
minimisation: the personalization AI path sends a neutral learner context
(no SNE/diagnostic labels) and content text only; output is validated for
diagnostic phrasing before it can be cached/shown; any failure falls back to
the deterministic transform, then to the original.

## Diagnostics / dignity

No inference of medical conditions exists in code. Signals are phrased as
"responds well to step-by-step explanations" with confidence/evidence, never
as labels. Unit + integration tests enforce the phrase blacklist. UI language
is "How I Learn / learning support / learning preferences / areas needing
practice".

## Offline

Reused the existing Workbox PWA service worker. `GET /api/content/*`
(lessons and previously generated adaptations) is NetworkFirst-cached
(100 entries, 7 days). The learner profile endpoint
`/api/learner/preferences` was added to the runtime caching config
(`prefs-cache`) so "How I Learn" and profile-driven presentation keep working
offline. Offline-first behaviour: cached adaptation shown when offline; no
cached adaptation → original lesson; learning is never blocked by AI
availability. Feedback/events are fire-and-forget; when offline they are
dropped gracefully (no false success) — queued-sync of feedback events is a
documented future enhancement.

## Frontend gates

```
TypeScript (tsc --noEmit):      PASS
ESLint (changed files):         PASS
Production build (next build --webpack + PWA): PASS
  - sw.js regenerated with prefs-cache route
```

## Performance

* No AI call on lesson open: profile read is one JSONB read; the default code
  is derived locally; the adapted view only requests the cached variant.
* Identical requests hit `content_adaptations` (unique learner/content/code +
  source hash) — no regeneration.
* Events append-only with a (learner_id, content_id) index.

## Blockers (external, documented — not code defects)

* **Real AI provider** (`ai.client.type=real` + FastAPI service): no
  credentials/host in this environment — the real-AI branch is compile-tested
  and safety-validated but never executed end-to-end. All verified behaviour
  used the deterministic path (`source=LOCAL`), which is the same code a
  learner gets on AI failure — i.e., the safe fallback is the verified path.
* **Notifications/email/SMS providers**: unchanged from Phase 3 — external.

## Known limitations (documented, no critical/high severity)

* Preferences are global per learner today; per subject/competency scoping is
  supported by the data model but not exposed.
* Automated axe/Playwright WCAG suite and keyboard walkthroughs are not yet in
  CI (manual/API checks done).
* Guardian/teacher UI still shows the school-recorded SNE chip from the legacy
  `LearnerProfile.sneType` seed on ward cards; the personalization feature
  itself never reads or derives it.
* Adaptation "More detail" for very short texts is a structural re-flow
  (no fabricated extension material) — by design, curriculum integrity first.

## Manual acceptance steps

1. `cd backend && ./gradlew bootRun` (dev) — or docker compose; seed demo users.
2. `cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8082 npm run dev`.
3. Login `student@elekeza.app` / `student123` → open **How I Learn**, change
   several preferences, confirm "Chosen by you".
4. Log out/in; preferences persist.
5. As `teacher@elekeza.app` / `teacher123` assign "The Water Cycle" to Juma Ali.
6. As the student open the lesson → Original / My usual style / Clearer /
   Step-by-step / Spaced out / More detail; listen button when enabled; send
   👍 feedback; return to Original.
7. As the teacher open Students → View support; add guidance; observe 409
   respect for learner-chosen preferences.
8. As `parent@elekeza.app` / `parent123` open the ward → plain-language card.

## Evidence artefacts

* Test results: `backend/build/test-results/test/*.xml` (108/108).
* Frontend build log: `.freebuff/fe-prod-build.log`.
* Companion docs: `docs/product/PER_STUDENT_PERSONALIZATION.md`,
  `docs/product/ADAPTIVE_SIMPLIFICATION.md`,
  `docs/architecture/LEARNING_PROFILE_ARCHITECTURE.md`,
  `docs/accessibility/PERSONALIZED_ACCESSIBILITY.md`.
