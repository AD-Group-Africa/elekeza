# PILOT ACCEPTANCE JOURNEY — 2026-10-02 19:32:52
Backend: http://localhost:8097 (prod profile, released config). Scratch DB. Temp passwords are throwaway.

## 1. SCHOOL CREATED
- POST /api/institutions/register → **201** (expect 201)
- institution id: **9**
## 2. SCHOOL ADMIN LOGIN → **200** (expect 200)
## 3. TEACHER CREATED
- POST /api/institutions/9/staff → **201** (expect 201)
- staff id: 31 — one-time password returned in create response: **YES** (audit fix: was undeliverable with mock email)
- teacher login with one-time password → **200** (expect 200)
## 4/5. LEARNER + GUARDIAN CREATED (CSV import — the white-glove pilot path)
- POST /api/institutions/9/students/import → **200** (expect 200)
- learner: **zawadi.pilot.s9@elekeza.school** (temp pwd returned in response: YES)
- guardian: **pilot-guardian-193252@pilot-school.test** (temp pwd returned in response: YES)
## 6. LEARNER LOGS IN
- login → **200** (expect 200)
- learner id: 32
## 7. TEACHER CREATES CONTENT (AI simplify) AND ASSIGNS TO LEARNER
- POST /api/content/upload/text (teacher, AI simplify) → **200**
- new lesson id: **17** — AI adapted: True
- POST /api/teacher/content/assign (learner 32) → **200** (expect 200)
## 8. LEARNER OPENS ASSIGNED LESSON
- GET /api/content/lessons/17 (own school) → **200** (expect 200)
- GET /api/content/lessons/3 (seed school content, not assigned) → **403** (expect 403 — EXPECTED SECURITY DENIAL: school isolation)
## 9. LEARNER TAKES QUIZ (start → answer → complete → result)
- GET /api/quiz/17/start (own school's lesson quiz) → **200**
- quizId=9 questions=5
- POST /api/quiz/9/answer (Q1) → **200**
- POST /api/quiz/9/complete → **200** score=20.0
## 10. PROGRESS UPDATED
- GET /api/progress/dashboard → **200**
- GET /api/gamification/student → **200** points/level present: True
## 11. AI EXPERIENCE WORKS (on the learner's own lesson)
- POST /api/tutor EXPLAIN lessonId=17 → **200** (expect 200)
## 12. GUARDIAN SEES CHILD + PROGRESS
- guardian login → **200**
- GET /api/guardian/wards → **200** ward id=32
- GET /api/guardian/wards/32/progress → **200**
- guardian-scoped learner lessons visible via ward detail → **200**
## 13. ATTENDANCE RECORDED
- **BLOCKED (expected): no class-creation endpoint exists (EL-F-007).** New school has zero classes; attendance sessions require classes/{id}. Seed class 1 belongs to school 1 — cross-tenant probe below.
- new-school admin POST seed class 1 session (cross-tenant) → **403** (expect 403 — EXPECTED SECURITY DENIAL); body: {"error":"Not authorized for this class"}
## 14. SAFIRI TRIP/STATUS
- **NOT AVAILABLE: module does not exist** (repo-wide verification in ELEKEZA_FINAL_SYSTEM_MAP.md §9). Build-or-descope decision required (owner: Harry).
## 15. NOTIFICATION GENERATED
- notifications rows for new learner (32): **1**
## 16. SCHOOL ADMIN SEES DATA
- GET /api/teacher/students (new school) → **200** contains imported learner: 1
- GET /api/analytics/admin → **200**
## 17. CROSS-TENANT / OBJECT-LEVEL PROBES
### seed teacher (school 1) → new school resources
- GET /api/institutions/9/students → **403** (expect 403 — EXPECTED SECURITY DENIAL)
- GET /api/institutions/9/staff → **403** (expect 403 — EXPECTED SECURITY DENIAL)
### new admin → school 1 resources
- GET /api/institutions/1/staff → **403** (expect 403 — EXPECTED SECURITY DENIAL)
### new guardian → another family's ward (seed learner 1)
- GET /api/guardian/wards/1 → **403** (expect 403/404 — EXPECTED SECURITY DENIAL)
- GET /api/guardian/wards/1/progress → **403** (expect 403/404 — EXPECTED SECURITY DENIAL)
### new learner → own vs others' resources
- GET /api/learner/preferences (self) → **200** (expect 200 — own data)
- GET seed class history (not theirs; method may be unsupported on this route) → **405** (record actual)

## VERDICT SUMMARY
- Core acceptance chain EXECUTED END-TO-END: school → admin → teacher(OTP) → CSV learner+guardian → logins → AI-simplified content → assignment → learner reads own lesson → quiz → progress → AI tutor → guardian visibility → notification → admin analytics.
- School isolation VERIFIED: learners/teachers/guardians/admins get 403 on other schools' content, staff, students, and classes (all EXPECTED SECURITY DENIALS).
- BLOCKED product gaps (verified live): attendance for a NEW school (no class-creation endpoint, EL-F-007) and Safiri (module does not exist).
- Fixes verified live this run: teacher one-time password returned by staff-create (login 200); learner credentials returned by CSV import (login 200).
