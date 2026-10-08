# Learner/Teacher/Guardian persistence — consolidated DB verification (TASK 4)

All queries via psql on `elekeza_chain_scratch` (:5433). UI loops: `journey-learner.mjs`,
`journey-teacher.mjs`, `journey-guardian.mjs` (all re-verified live 2026-10-02).

## Learner (student@elekeza.app, user 1)

| Operation | UI loop result | DB state |
|---|---|---|
| Quiz attempt + submit | PASS — score 20% shown; review page renders after logout→login | `quiz_attempts` id=54 (this run): quiz_id=3, user_id=1, score=20, total_questions=5, completed=true, completed_at 2026-10-02 16:15:31 |
| Gamification XP | PASS — 84 pts identical pre-logout / post-relogin | Derived: 8 completed quizzes ×10 + 2 completed lessons ×2 = 84 (server-computed from persisted rows; cannot drift) |
| Lesson progress | PASS — stable across relogin | `lesson_progress` user 1 completed=true → 2 rows |
| A11y preference (server) | PASS — read-aloud still ON after relogin | learner preferences API (readAloud=true) |
| A11y profile mirror | PASS — TTS state kept | `accessibility_profiles` user 1: `{"ttsEnabled": true, "textScale": 1.2, ...}` (updated 16:15:07 by /dashboard/settings mirror) |

## Teacher (teacher@elekeza.app, user 2)

| Operation | UI loop result | DB state |
|---|---|---|
| Content upload → AI simplify | PASS — "AI has simplified your lesson" → preview → lesson renders at /lesson/6 | `content` id=6 "How Plants Make Food" status=READY (simplified_text stored; raw preserved) |
| Attendance register save | PASS — "Saved. Present 1 · Absent 0 · Late 0 · Excused 0"; history shows today after reload | `attendance_records` id=2: session 2, learner 1, PRESENT, recorded_by 2, updated 2026-10-02 16:23:30 |

## Guardian (parent@elekeza.app, user 3)

| Operation | UI loop result | DB state |
|---|---|---|
| Send message to teacher | PASS — message renders in thread; still there after logout→login | `notifications` id=16: user_id=3, type=GUARDIAN_MESSAGE, body="Automated closure check-in 13:26:08", created 16:26:33 |

## Findings

1. **EL-NEW-01 (MEDIUM)** — `/learner/preferences` "Listen to lessons" (server-persisted)
   does not gate the lesson-page Listen button; that UI reads the separate localStorage
   `elekeza-settings` system. Working path exists (`/dashboard/settings`), which also mirrors
   `ttsEnabled` into `accessibility_profiles`. Two preference systems, one dead end-to-end.
2. **EL-NEW-02 (MEDIUM)** — Guardian messages persist as SELF-addressed notifications
   (`userId = sender`); `recipient` from the request body is ignored in
   `MessageController.guardianSendMessage`. The teacher never receives the message; the
   "thread" is one-sided. No data loss, but the communication feature does not deliver.
3. UI shows "N points to Level X" (remaining), not raw points — cosmetic clarity note only.
