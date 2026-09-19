# SHOWCASE_TEST_EVIDENCE

Date: 2026-09-10 (sprint coherence pass).
Environment: backend dev profile on the local dev port, frontend local dev
server, AI service in mock mode by default in dev (`AI_CLIENT_TYPE=mock`).
Seed: `SHOWCASE_SEED=1` produces 1 admin, 7 teachers, 30 learners, 15
guardians, 6 subjects, 13 structured lessons.

## Backend

| Check | Result |
|---|---|
| `./gradlew clean test` | **PASS — 151 tests, 0 failed, 0 skipped** |
| compileKotlin after all changes | PASS |
| Clean restart + `SHOWCASE_SEED=1` reseed | PASS (reproducible from the dev profile) |

## Frontend

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | PASS — **0 errors** (26 pre-existing warnings) |
| `npm run build` (with `NEXT_PUBLIC_API_URL`) | **PASS** |

## API verification

| Check | Result |
|---|---|
| `GET /api/gamification/student` | PASS — `{level, levelName, points, nextLevelPoints, stars, achievements}` computed from existing data |
| `GET /api/progress/dashboard` | PASS — returns `name`, `completedLessons`, `quizzesTaken`, `averageScore`, `recentLessons`, `upcomingQuizzes` |
| `GET /api/analytics/student` | PASS — returns `learningStreak`, `weeklyActivity`, `quizHistory` |
| `GET /guardian/wards/{wardId}/learning-support` | PASS — plain-language guardian summary, ward-scoped |
| `GET /guardian/wards/{wardId}` | PASS — ward identity + progress detail, linked ward only |
| Auth/CSRF on state-changing calls | PASS — CSRF enforced on writes |

## Security regression checks

| Check | Result |
|---|---|
| Learner calling teacher endpoint (`/api/teacher/students`) | **403** PASS |
| Guardian requesting a ward that is not theirs (`/api/guardian/wards/999`) | **403** PASS |
| Wrong-password login | 401 PASS |
| CSRF required on state-changing calls | PASS |

## Coherence checks from this sprint

| Check | Result |
|---|---|
| Learner progress page shows real data only | **PASS** — no invented CBC competency rings; shows points/level/stars/achievements + real progress + weekly activity |
| Quiz list empty state is honest | **PASS** — says quizzes live inside lessons and points back to My Lessons |
| Guardian ward detail page exists and reads real endpoints | **PASS** — `/guardian/wards/[id]` reads `/guardian/wards/{id}` + `/guardian/wards/{id}/learning-support` |
| Student-home companion greeting uses real learner name | **PASS** — greets "Juma", not "Learner" |

## Browser rehearsal (real browser against the local dev stack)

| Journey | Result | Evidence |
|---|---|---|
| Learner login → companion home | **PASS** | Companion greeting "Good evening, Juma 👋", Level 2 · Sprout, ★★★★☆, one primary CTA |
| Continue learning → Mathematics lesson | **PASS** | Section-by-section lesson, key terms, reading-mode toggle |
| Lesson → practice quiz | **PASS** | Quiz start only when backend has a quiz for the lesson |
| Quiz → answer → feedback → submit | **PASS** | Per-question server feedback, score computed server-side |
| Celebration | **PASS** | Stars + score + XP (+10) + badges, companion celebrating |
| Progress after quiz | **PASS** | Real gamification + progress numbers updated |
| Guardian view | **PASS** | Ward detail + plain-language summary + recent quizzes |
| Teacher view | **PASS** | Learner roster + support signals |

## AI

| Check | Result |
|---|---|
| Deterministic adaptation (mock/local) | **PASS** — dev profile defaults to mock AI |
| Real provider (Groq) | **BLOCKED** — invalid credential (external dependency); pipeline verified to provider boundary only |
| AI honesty | PASS — no live-AI claims anywhere in the demo |

## Known limitations

- Real Groq credential invalid → deterministic local AI for the demo (documented, honest).
- `student123` is the seeded learner password (base seeder); showcase learner01+ use `learner123`.
- The XP "levelUp" calculation in the celebration uses the last-quiz delta; acceptable for MVP, listed as P2 polish.
- The local dev backend must run on an available port; port 8080 is occupied on this machine, so the walkthrough uses an alternate dev port.
