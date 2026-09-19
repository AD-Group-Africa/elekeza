# Tuesday Demo Runbook

Companion docs: `DEMO-ACCOUNTS.md` (credentials) · `DEMO-SCRIPT.md` (narrative) · `DEMO-TROUBLESHOOTING.md` (recovery) · `../production/DEMO_READINESS_REPORT.md` (evidence).

Positioning line (open with it):

> Elekeza is not an e-learning app. It is a school operating system that connects administration, teaching, learning, families, and inclusive learner support — in one platform.

## Pre-demo checklist (run top to bottom, ~10 minutes)

```text
☐ Backend healthy:        http://localhost:8082/actuator/health → {"status":"UP"}
☐ Frontend healthy:       http://localhost:3000/login renders
☐ Teacher account works:  teacher@elekeza.app / teacher123
☐ Student account works:  student@elekeza.app / student123
☐ Guardian accounts work: parent@elekeza.app · sibling@elekeza.app · caregiver@elekeza.app (individual passwords: parent123 / sibling123 / caregiver123 — see DEMO-ACCOUNTS.md)
☐ AI status:              AI_CLIENT_TYPE=mock → personalization deterministic, no internet needed
☐ M-Pesa status:          say "integration ready, awaiting Daraja sandbox credentials" — do not demo payments live
☐ Internet:               not required (mock AI, local stack); check anyway if showing the live site
☐ Fresh browser session:  hard-refresh http://localhost:3000 once (clears stale CSRF cookie)
```

If any account fails: **STOP and consult DEMO-TROUBLESHOOTING.md first** — do not improvise accounts on stage.

## ACT 1 — The school (SCHOOL_ADMIN) — ~4 min

1. Go to `http://localhost:3000/school/onboarding`.
2. Fill the 3-step wizard live (school name, county, admin details) — **say**: "a real school signs up in under a minute".
3. Log in as the new SCHOOL_ADMIN.
4. Show: school dashboard → learner roster → classes → reports.
5. **Say**: "Everything on this screen is scoped to this school only."

**Expected results:** wizard completes → login works → dashboard shows the just-imported/created data.
**Fallback:** if the wizard hiccups, register via CSV import page (`/school/import`) or say "pre-provisioned pilot tenant" and log into a seeded account from DEMO-ACCOUNTS.md.

## ACT 2 — The teacher (TEACHER) — ~4 min

1. Log out → log in as `teacher@elekeza.app / teacher123`.
2. Show: Teacher Dashboard (Total Learners, Quizzes Taken, Weekly Activity chart) → Student Management → Lessons ("The Water Cycle") → Assignments.
3. Open a learner and show support signals + teacher guidance.
4. **Say**: "The teacher sees exactly their classes — nothing more, nothing less."

**Expected results:** dashboard shows live counts (1 learner, 1 quiz taken, 1 assignment).
**Fallback:** if a count shows 0 after a DB reseed, re-assign the lesson first (DEMO-TROUBLESHOOTING.md § Reseed).

## ACT 3 — The learner (STUDENT) — ~5 min  ⭐ personalization centerpiece

1. Log in as `student@elekeza.app / student123`.
2. Open "How I Learn" → show explicit preferences (e.g. step-by-step, spacious reading).
3. Open the assigned lesson → **the adapted view reflects the preferences** → show "show original" toggle.
4. Take the seeded quiz → submit → result appears.
5. Show progress updated.
6. **Say**: "The learner sets how they learn. Teacher guidance respects it — the learner always keeps priority. No labels, no diagnostics — just how Juma learns best."

**Expected results:** adapted view active; quiz scored server-side; progress reflects the attempt.
**Fallback:** if AI were unavailable, the platform serves the original content — say exactly that: "graceful fallback by design."

## ACT 4 — The guardian (GUARDIAN) — ~5 min  ⭐ differentiation centerpiece

1. Log in as `caregiver@elekeza.app / caregiver123`.
2. Guardian Dashboard → show the relationship chip **"Caregiver"** on the learner card and the plain-language explainer.
3. Click **View Details** → progress, assessment summary, teacher note ("Great improvement this week!").
4. Switch account to `parent@elekeza.app` → same learner, relationship **"Parent"**.
5. **Say**: "A guardian doesn't have to mean a parent. The school authorizes a parent, caregiver, older sibling, or legal guardian — each with their own relationship and their own scope. Multiple guardians, one learner; one guardian, several learners."
6. **Security beat (optional, powerful):** try `/guardian/wards/99` → blocked. "Scoping is enforced server-side, not by hiding links."

**Expected results:** relationship labels correct; ward detail shows permitted info only.
**Fallback:** screenshots packet in the troubleshooting doc.

## ACT 5 — Platform view (ADMIN) — ~2 min

1. Log in as platform ADMIN (DEMO-ACCOUNTS.md).
2. Show institution list / platform analytics.
3. **Say**: "Platform admin is a separate role — a school admin never becomes a platform admin. That separation is enforced in the role model, not in the UI."

**Expected results:** platform scope distinct from school scope.

## Close — ~1 min

- Recap the loop: **school → teacher → learner (personalized) → guardian → back to school**.
- Integration status, honestly: "Payments, AI, and SMS integrations are built and internally verified; production activation is a configuration step per provider."
- CTA: pilot onboarding path (docs/production/pilot-launch.md).

## Timing budget

| Act | Time | Cumulative |
| --- | ---- | ---------- |
| Setup/intro | 2 min | 2 |
| Act 1 School | 4 min | 6 |
| Act 2 Teacher | 4 min | 10 |
| Act 3 Learner | 5 min | 15 |
| Act 4 Guardian | 5 min | 20 |
| Act 5 Platform | 2 min | 22 |
| Close | 1 min | 23 |

## Rules for the day

1. No new deployments after the 30-minutes-before checkpoint — repeat the critical journey once, then freeze.
2. Never simulate a provider success on stage; show integration status instead.
3. All demos from seeded accounts; nothing created live except the Act-1 registration (which is the point).
4. If anything breaks: DEMO-TROUBLESHOOTING.md → fallback path → keep narrating.
