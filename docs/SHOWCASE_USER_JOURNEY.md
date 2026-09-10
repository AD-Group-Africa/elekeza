# SHOWCASE_USER_JOURNEY — The Elekeza Adaptive Learning World

This is the primary demonstration story for Elekeza. It shows that Elekeza
adapts the **experience** — not just the text — for learners with different
cognitive, learning and interaction needs.

## The story in one line

> A learner logs in, is greeted personally by their Elekeza companion,
> chooses from a small set of big friendly choices, learns through an
> AI-adapted lesson, plays a quiz, is celebrated for their effort, and the
> result flows automatically to their guardian and teacher.

All accounts below are the real showcase seed accounts
(`SHOWCASE_SEED=1` on the dev profile, backend on the local dev port, frontend on its local dev server).

## Scene-by-scene

### Scene 1 — Meet the learner
Login as **student@elekeza.app** / `student123` (learner: Juma Ali).

### Scene 2 — The companion greets him
The learner home is not a dashboard: Elekeza (the purple companion) greets
Juma personally — "Good evening, Juma 👋". One primary action dominates:
**Continue Learning**. Secondary choices: Explore, Play, My Journey,
How I Learn.

### Scene 3 — The level strip
Juma's own progress (Level 2 · Sprout, ★★★★☆, points to next level). No
leaderboards, no comparison — the reward is *his* journey.

### Scene 4 — Subject 1: Mathematics
"Continue Learning" opens **Mathematics: Fractions — What is a half?**
The lesson page offers section-by-section reading, plain-language key terms,
reading-mode toggle, and a practice quiz when the backend has generated one
for that lesson.

### Scene 5 — Interaction + assessment
Juma answers the quiz questions one at a time. Each answer is scored on the
server; the answer key never reaches the client while answering. Adaptive
feedback appears after each answer.

### Scene 6 — Celebration
On submission the companion celebrates: stars, score, XP (+10 per quiz,
matching the backend economy exactly), new badges, honest wording.

### Scene 7 — Progress
Back on the home the level strip has moved (points updated live) and the
achievement list grows. The learner can also open **My Progress** and see
real points, level, stars, achievements, recent lessons, and weekly activity
from the backend — not invented competency percentages.

### Scene 8 — Guardian sees it
Login as **parent@elekeza.app** / `parent123`. The guardian dashboard shows
Juma's card and a ward detail page with a plain-language learning summary,
recent quizzes, and progress history — linked ward only.

### Scene 9 — Teacher sees it
Login as **teacher@elekeza.app** / `teacher123`. The teacher dashboard shows
learners, real completion/average numbers, and per-learner support signals
(SNE roster, learning-support panel).

### Scene 10 — Subject 2: a different world
Back as the learner: **My Lessons** → **Computer Studies: What is a
computer?** (or another available Computer Studies lesson) → read the lesson
→ start practice → quiz → celebration → progress. Two subjects, two adapted
experiences, one platform.

### Closing line for the demo

> Elekeza doesn't ask every learner to learn the same way.
> It adapts the learning experience to the learner.

## AI honesty note

Lesson adaptation runs in deterministic local mode (`AI_CLIENT_TYPE=mock`)
by default in dev. The real-provider pipeline (FastAPI ai-elewa → Groq) is
implemented and verified up to the provider boundary; no valid provider
credential is currently configured, so the demo does not claim live AI. If
asked: "The adaptive-learning pipeline is operational locally; the external
provider credential is not activated."

## Evidence

See `docs/SHOWCASE_TEST_EVIDENCE.md` for the exact PASS/FAIL/BLOCKED
results from the latest run.
