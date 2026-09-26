# END_USER_TESTING — Elekeza

A non-developer guide for controlled testing with real people. Use the synthetic accounts below — they contain only invented data.

## Test accounts (dev seed, reset on every backend restart)

| Role | Email | Password | Who |
| --- | --- | --- | --- |
| Learner | `student@elekeza.app` | `student123` | Juma Ali (Grade 4, dyslexia-supportive profile) |
| Teacher | `teacher@elekeza.app` | `teacher123` | Alice Mwalimu |
| Guardian | `parent@elekeza.app` | `parent123` | Fatima Ali (guardian of Juma) |
| School admin (showcase seed, `SHOWCASE_SEED=1`) | `admin@elekeza.app` | `admin123` | Grace Njeri — school + platform admin |
| Guardian (linked to other learners) | `guardian4@elekeza.app` | `guardian123` | John Kamande |

The dev database (in-memory H2) is rebuilt from the seed on every backend restart. `SHOWCASE_SEED=1` adds the full showcase world (30 learners, 7 teachers, 15 guardians, 13 lessons); without it the base seed above still exists. `superadmin@elekeza.app` exists only on PostgreSQL deployments seeded by Flyway V2 — on the dev H2 database the `admin@elekeza.app` account carries the platform-admin (ADMIN) role.

Institution: Waterpool Primary (demo). Content: "The Water Cycle" lesson with a 2-question practice quiz and a completed demo attempt (80%), plus 13 showcase lessons across 6 subjects when the showcase seed is on.

## Learner session (10 minutes)

1. Open the site and log in as the learner.
2. You are greeted by your companion. Read the screen: **what do you think you should press first?** (Do not instruct — watch.)
3. Press **Continue learning**, read the lesson using **Next section**.
4. Try the **Reading mode** button. Does it help?
5. Open **Practice what you learned** → **Open practice quiz**. Answer all questions, press **Submit**.
6. Read the celebration. Press **Continue**.
7. Open **My Journey** (progress). Can you find your score, your level, and "What to do next"?
8. Open **How I Learn**. Change one setting. Does the lesson feel different?
9. Log out.

**Ask:** Can you understand what to do? · Could you navigate without help? · What felt confusing? · Which settings helped? · What felt enjoyable? · Where did you want to stop? · Would you use it again?

## Teacher session (10 minutes)

1. Log in as the teacher.
2. Open **Students**. Find a learner and press **View support**.
3. Read "Lesson mastery evidence". **Can you tell who needs help, and why?**
4. Open **Progress**. Does this save you time versus your current tools?
5. Try applying a learning-preference guidance for a learner.

**Ask:** Can you identify who needs help? · Does the system save time? · Are the recommendations understandable? · Can you act on them? · What information is missing?

## Guardian session (5–10 minutes)

1. Log in as the guardian.
2. You see your child. Open their page.
3. Read the summary and recent quiz results in plain language.

**Ask:** Can you understand the child's progress? · Is this useful to you? · What would you want to know that isn't here? · Is anything confusing or concerning?

## Finance and attendance notice (updated 2026-09-17)

Attendance and school-fees are now real modules and CAN be included in controlled end-user testing:

- **Teacher:** log in → sidebar **Attendance** → pick class + date → mark each learner → **Save register** (counts confirm). Use **History** on a learner for their record.
- **School admin (showcase seed):** sidebar **Finance** → dashboard shows billed / collected / outstanding; create fee items/structures, learner charges; record manual payments; open a receipt.
- **Guardian:** sidebar **Fees** → ward's charges, balance, payment history, receipts. Where M-Pesa is in mock mode the pay button uses deterministic test mode; production M-Pesa is **not configured** and the UI says so honestly.

Known limitations for testers: M-Pesa runs in mock/sandbox mode (no real money moves); finance figures come from seeded demo data and reset with the dev database on every backend restart.

## New in this build (2026-09-17 evening): Assignments + Guardian daily digest

- **Learner:** sidebar **Assignments** → see work set by your teachers, write your answer, submit. You can always go back and **improve your answer**; graded work shows your score and the teacher's feedback.
- **Teacher:** sidebar **Classwork** → create an assignment for a class (title, instructions, due date, points) → **View submissions** → enter a score (0–points) and optional feedback → **Save grade**. Learners see the feedback immediately.
- **Guardian:** open your child's page → **Today at a glance** card — lessons done, attendance (incl. today's mark), classwork coming up / past due, teacher feedback, and the current fees balance in one calm summary.

All three journeys are covered by automated tests (backend 220/220) and browser E2E (31/31).

## What we record, and what we never do

- Record: task completion, quotes, confusion points, feature requests — aggregated per role.
- Never: publish child-level analytics, diagnose from behaviour, use pilot data for model training, or expose one learner's data to another family.
- Real learners may only participate with guardian consent; prefer synthetic accounts for first rounds.
