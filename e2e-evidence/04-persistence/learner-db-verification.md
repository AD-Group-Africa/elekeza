# Learner persistence — DB verification (TASK 4, learner role)

Run: journey-learner.mjs final pass, 2026-10-02 ~16:07–16:15 EAT. All queries via psql on
`elekeza_chain_scratch` (PG 15 @ :5433). UI evidence: `02-user-journeys/learner/`.

| Operation | UI persistence (op → logout → login → verify) | DB state |
|---|---|---|
| Quiz attempt + result | PASS — `/quiz/review/3` renders saved result after re-login (L21) | `quiz_attempts` id=54, quiz_id=3, user_id=1, **score=20**, total_questions=5, completed=true, completed_at=2026-10-02 16:15:31 (this run; id=50/46 from earlier runs same day) |
| Gamification (XP) | PASS — level strip identical before logout and after re-login | Derived server-side: 8 completed quizzes ×10 + 2 completed lessons ×2 = **84 points** = UI value |
| Lesson progress | PASS — completed-lesson count stable across re-login | `lesson_progress` user 1, completed=true → 2 rows |
| Accessibility (server pref) | PASS — read-aloud pref still ON after re-login (L22) | learner preferences via `/api/learner/preferences` (readAloud=true) |
| Accessibility (a11y profile mirror) | PASS — set via /dashboard/settings, survives session | `accessibility_profiles` user 1: `{"ttsEnabled": true, "textScale": 1.2, "theme": "dark", ...}` updated_at 16:15:07 |
| Profile page | PASS — renders after re-login (no state loss) | users row 1 (Juma Ali) unchanged |

## Derivation check (gamification is computed, not stored)

- Before quiz run 3: UI "26 points to Level 3" → points = 2×50−26 = 74 = 7 quizzes + 2 lessons? No — 7×10+2×2=74 ✓
- After quiz: "16 points to Level 3" → points = 84 = 8 quizzes + 2 lessons ✓ (+10 for the completed quiz exactly)
- After re-login: still 84 ✓ (stateless derivation from persisted rows — cannot drift)

## Defect evidence captured on this journey

- **EL-NEW-01 (MEDIUM)**: `/learner/preferences` "Listen to lessons" toggle persists
  server-side (survives logout/login) but does **not** gate the lesson-page Listen
  buttons — those read the separate localStorage `elekeza-settings` a11y system
  (useAccessibilitySettings). The server pref alone shows no Listen button on
  `/lesson/3`. Working path: `/dashboard/settings` → Audio & Language → Text to
  Speech (also mirrors `ttsEnabled` to `accessibility_profiles`).
- Points displayed in UI are "points to next level", not raw points (cosmetic
  note; math verified correct).
