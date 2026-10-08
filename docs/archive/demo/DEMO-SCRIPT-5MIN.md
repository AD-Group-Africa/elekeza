# Elekeza — 5-Minute Demo Script

**Tagline:** Elekeza doesn't just deliver content. It makes learning understandable.

| Time | Beat | What to do |
| ---- | ---- | ---------- |
| 0:00 | Problem | "Content in one format doesn't reach every learner. Especially learners who think differently." |
| 0:30 | Student login | Log in as `student@elekeza.app` / `student123`. Show the personalized dashboard. |
| 1:00 | Lesson | Open a lesson. Point at the difficult concept. |
| 1:30 | Simplification | Open the AI Tutor: "Make this easier to understand." Show the clearer explanation. |
| 2:00 | Practice | Take a quiz. Show instant feedback. |
| 2:30 | Quiz result | Score updates progress. The learner sees growth. |
| 3:00 | Exam | Open **Exams**. Start the published exam. Show the server timer. Answer 2–3 questions. |
| 3:45 | Submit | Submit. Auto-marked score appears immediately. |
| 4:00 | Teacher view | (Second device/tab) Log in as teacher. Open **Exams → Review**. Mark the written answer with feedback. |
| 4:30 | Guardian view | Log in as `parent@elekeza.app`. Show the child's updated result and the teacher's feedback. |
| 4:45 | Notifications | Show the notification bell — the guardian was kept in the loop. |
| 5:00 | Close | "Elekeza doesn't just deliver content. It helps make learning understandable — for every learner." |

## Backup answers

- **"Is exam lockdown secure?"** — "It's layered: server-side timing, attempt limits, and integrity event logging for human review. We never claim a browser can be made cheat-proof."
- **"What about payments?"** — "M-Pesa STK-Push is fully implemented and sandbox-ready; production activation needs Daraja credentials."
- **"What's next?"** — Manual marking is live for written answers; analytics and attendance expansion are on the roadmap.

## Fallbacks if the demo breaks

- Refresh and log in again (sessions are secure cookies; re-login takes 5 seconds).
- Exam attempt expired? It's preserved and marked — show the result instead.
- AI slow? The mock fallback answers instantly — say "this is the offline mode".
