# Elekeza — Test Evidence

Evidence recorded from actual runs. All live runs on this page were executed on
**2026-09-08** against the local stack (backend :8082, frontend :3000, ai-elewa :8000).

## Showcase rehearsal run (2026-09-09)

Full evidence for the showcase/freeze phase: see **`FRIDAY_SHOWCASE_RUNBOOK.md`**
(root) — that file is the single authoritative demo runbook.

| Check | Result |
|---|---|
| Backend full suite after showcase fixes (seeder order, admin institutionId, guardian lastActive, analytics/SNE fixes) | **PASS — 146/146, 0 skipped, 0 failures** |
| Frontend typecheck after guardian/admin page fixes | **PASS** (exit 0) |
| Clean restart with `SHOWCASE_SEED=1` reproduces showcase | **PASS** (3 reseeds; base seeder `@Order(1)` runs first every time) |
| Learner journey in real browser (dashboard → lesson → 3-level adaptation → quiz → server score → progress → notification bell) | **PASS** |
| Teacher journey in real browser (dashboard → roster with real SNE types → learner support panel → guidance action persisted) | **PASS** |
| Guardian journey in real browser (child card → ward detail → per-lesson score notifications, dated history) | **PASS** |
| Admin journey in real browser (school dashboard 7/30/14 → platform view 1 school / 53 users) | **PASS** (after P1 fixes below) |
| Deterministic AI adaptation, honest `source: LOCAL` label | **PASS** |
| Quiz → progress → guardian notification chain (API + browser) | **PASS** |
| Real external AI provider credential | **BLOCKED** — invalid key (401); deterministic local mode used and honestly labeled |
| Showcase account logins (`student/teacher/parent/admin@elekeza.app`, `learnerN@`/`guardianN@` patterns) | **PASS** — all 200 |

P1/P2 defects found and fixed during the rehearsal (all re-tested): CORS hardcoded
to a single dev origin; showcase admin had no institution (empty admin dashboard);
nondeterministic seeder order flipped `parent@elekeza.app`'s password; teacher roster
hardcoded SNE `NONE`; `activeThisWeek` counted progress rows not learners; unrounded
percentages; guardian "Last Active: N/A" (first-row instead of latest completedAt).

---

## Automated suites (fresh run)

| ID | Suite | Command | Result | Evidence |
|---|---|---|---|---|
| AUTO-001 | Backend full suite | `gradlew test` (no-daemon) | **146/146 PASS** (incl. 17 exam tests, answer-immutability test, 3 marking tests) | JUnit XML: 0 failures, 0 errors |
| AUTO-002 | Frontend typecheck | `npx tsc --noEmit` | PASS (exit 0) | clean output |
| AUTO-003 | Frontend lint | `npx eslint src --quiet` | PASS (0 errors) | clean output |
| AUTO-004 | Frontend production build | `NEXT_PUBLIC_API_URL=... next build` | PASS (prior run; rerun on demand) | build completed |
| AUTO-005 | Live core journey | `python3 .freebuff/live_journey.py` | **40/40 PASS** | script summary `total=40 pass=40 fail=0` |
| AUTO-006 | Live exam journey | `python3 .freebuff/live_exam_journey.py` | **26/26 PASS** | script summary |

## AUTH (from live journeys + dedicated probes)

| ID | Role | Action | Expected | Actual | Status |
|---|---|---|---|---|---|
| AUTH-001 | Teacher | login `teacher@elekeza.app` | 200 + `elekeza_access` cookie | login=200, cookie set | PASS |
| AUTH-002 | Anonymous | GET privileged endpoints | 403 | 403 on all probed | PASS |
| AUTH-003 | Student | teacher/admin/payment endpoints | 403 | 403 | PASS |
| AUTH-004 | Forged JWT | call protected API | 403 | 403 | PASS |
| AUTH-005 | Invalid credentials | login with wrong password | 401, rate limiter counts | rejected | PASS |
| AUTH-006 | Registration | fresh student register → onboarding → dashboard | lands on student dashboard | verified in browser (clean session) | PASS |

## EXAM integrity (API level, from ExamApiTest + live journey)

| ID | Check | Expected | Actual | Status |
|---|---|---|---|---|
| EXAM-001 | Start outside availability | rejected | rejected | PASS |
| EXAM-002 | Exceed attempt limit | rejected | rejected | PASS |
| EXAM-003 | Submit twice | 409 duplicate | 409 | PASS |
| EXAM-004 | Answer edit after submit | rejected, DB unchanged | rejected (explicit regression test) | PASS |
| EXAM-005 | Another student's attempt | 403 | 403 | PASS |
| EXAM-006 | Another institution's exam | 403 | 403 | PASS |
| EXAM-007 | Server deadline authoritative | client cannot extend | expiry enforced server-side; refresh recovers state | PASS |
| EXAM-008 | Objective auto-marking | MCQ/TF scored server-side | verified live ("Score 2/4") | PASS |
| EXAM-009 | Short-answer marking | teacher awards marks, clamped [0,max], recalc | live: 1.0 → award 2.5/3 → 3.5; over-max → 400 | PASS |
| EXAM-010 | Guardian results scope | only linked wards | live: ward result visible, unlinked 403 | PASS |
| EXAM-011 | Correct answers hidden from student client | never serialized to student | verified in DTOs + tests | PASS |

## AI service (this session's evidence)

| ID | Check | Expected | Actual | Status |
|---|---|---|---|---|
| AI-001 | ai-elewa health | 200 ok | `{"status":"ok"}` on :8000 | PASS |
| AI-002 | Internal auth enforced | bad/missing header → 401 UNAUTHORISED | 401 structured JSON, no learner message leak | PASS |
| AI-003 | Backend → ai-elewa connectivity | backend call reaches pipeline | ai-elewa log shows stage2_simplify attempt from backend call | PASS |
| AI-004 | Pipeline stages + retry | stage2 runs, schema-invalid retried with correction | log: `Schema invalid on stage2_simplify — retrying with correction note (attempt 2)` | PASS |
| AI-005 | Provider failure honesty | real error surfaced, no fake success | Groq 401 Invalid API Key → `SCHEMA_INVALID` + `learner_message` → backend `adapted:false` with honest message | PASS (BLOCKED: invalid Groq key) |
| AI-006 | Mock clearly labeled | never looks like real AI | "Mock Lesson" content + explicit "AI service not enabled" message | PASS |
| AI-007 | Deployed instance isolation | elekeza-ai.onrender.com healthy, rejects foreign secret | health ok; local secret rejected | PASS |
| AI-008 | End-to-end simplified lesson through UI | learner sees real AI output | **BLOCKED — requires valid Groq API key** | BLOCKED |

## Payments (negative probes; live flow needs credentials)

| ID | Check | Actual | Status |
|---|---|---|---|
| PAY-001 | Forged callback rejected | `ResultCode: 1` rejection, no ledger mutation | PASS |
| PAY-002 | Idempotency | unique transaction reference constraint | PASS (constraint verified) |
| PAY-003 | Real sandbox STK push | requires Daraja credentials | BLOCKED (credentials) |

## Browser walkthroughs (2026-09-08 and prior same-release sessions)

| ID | Role | Journey | Status |
|---|---|---|---|
| UI-001 | Student | register → onboarding → dashboard → lesson → simplify pathway → quiz → exams → start → answer (3 types) → submit → "Score 2/4" → results → notifications → logout/re-login | PASS |
| UI-002 | Teacher | dashboard → exams → create/publish → results → mark short answer (2.5/3 + feedback) | PASS |
| UI-003 | Guardian | login → ward card (relationship, SNE type, progress, teacher note) → ward-scoped data | PASS |
| UI-004 | Notifications | popover anchored, timestamps, mark-read clears badge, Escape + outside-click close | PASS |
| UI-005 | Mobile 409px | exam surfaces: no horizontal overflow, controls reachable | PASS |
| UI-006 | School admin | dashboard verified via live school-registration runbook (no seeded admin account — documented) | PASS (via runbook) |

## Known gaps in evidence

- AI-008 (real AI output in UI) blocked solely by invalid Groq credentials — see `TESTING_CREDENTIALS_CHECKLIST.md`.
- PAY-003 blocked by Daraja sandbox credentials.
- SMTP/OAuth/SMS/R2 live sends not exercised — toggles off locally.
