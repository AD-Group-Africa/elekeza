# Elekeza — Demo Accounts (pilot/demo environment only)

> These accounts exist only in the **dev** profile's demo seed (`DataInitializer`).
> They are re-created on every dev boot. Never enable the dev profile in production,
> and never reuse these passwords anywhere real.

| Act | Role | Email | Password | Relationship / Notes |
| --- | --- | --- | --- | --- |
| 1, 5 | SCHOOL_ADMIN | `schooladmin@elekeza.app`* | — | *If absent, register a fresh school live (30 s) — see runbook fallback |
| 2 | TEACHER | `teacher@elekeza.app` | `teacher123` | Alice Mwalimu — has "The Water Cycle" lesson |
| 3 | STUDENT | `student@elekeza.app` | `student123` | Juma Ali — dyslexia-profile learner, seeded quiz result (80%) |
| 4a | GUARDIAN (PARENT) | `parent@elekeza.app` | `parent123` | Fatima Ali — relationship: **Parent** |
| 4b | GUARDIAN (OLDER SIBLING) | `sibling@elekeza.app` | `sibling123` | Zawadi Ali — relationship: **Older sibling** |
| 4c | GUARDIAN (CAREGIVER) | `caregiver@elekeza.app` | `caregiver123` | Mary Achieng — relationship: **Caregiver** |

## Key demo facts baked into the seed

- All three guardians are linked to the **same learner** with different
  relationship types — this is the "guardian ≠ parent" talking point (Act 4).
- The learner has explicit personalization preferences (set live in Act 3 via
  "How I Learn") and a seeded completed quiz attempt so progress views are non-empty.
- Teacher → learner assignment may need one click after a fresh boot
  (`/api/teacher/content/assign` or the Assign button in the teacher UI).
- School-admin accounts are **not** seeded with fixed credentials by design
  (registration creates `SCHOOL_ADMIN`, never platform `ADMIN`) — use the live
  registration flow in Act 1, which doubles as a product feature demo.
