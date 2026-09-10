# ELEKEZA — FRIDAY SHOWCASE RUNBOOK (AUTHORITATIVE)

> This is the **only** runbook for the Friday demo. Older demo documents
> (`DEMO-ACCOUNTS.md`, `TUESDAY_DEMO_RUNBOOK.md`, `DEMO-SCRIPT-5MIN.md`, …)
> are historical and may contain outdated credentials or scope. If this file
> and any other document disagree, **this file wins**.

---

## 1. Environment

| Service   | Where | Command |
|-----------|-------|---------|
| Backend   | `http://localhost:8082` | from `backend/`: `SPRING_PROFILES_ACTIVE=dev SERVER_PORT=8082 SHOWCASE_SEED=1 ./gradlew bootRun` (source `backend/.env` first for DB/JWT vars) |
| Frontend  | `http://localhost:3005` (or :3000 if free) | from `frontend/`: `NEXT_PUBLIC_API_URL=http://localhost:8082 npx next dev --webpack -p 3005` |
| AI        | deterministic/local (in-JVM), honest `source: LOCAL` labels | no external service needed for the demo |
| Database  | in-memory H2 (dev profile) — reseeds on every boot | n/a |

Required environment variables (backend launch):

- `SPRING_PROFILES_ACTIVE=dev`
- `SERVER_PORT=8082`
- `SHOWCASE_SEED=1`  ← **populates the showcase (1 admin, 7 teachers, 30 learners, 15 guardians, 6 subjects, 14 lessons, quizzes, progress, notifications)**
- `SPRING_APPLICATION_JSON={"app":{"cors":{"allowed-origins":"http://localhost:3000,http://localhost:3005"}}}` when the frontend runs on a port other than 3000
- DB + JWT values from `backend/.env` (git-ignored; never commit)

Frontend env:

- `NEXT_PUBLIC_API_URL=http://localhost:8082` (defaults to :8080 otherwise — a mismatch makes every proxied `/api` call return 500)

Boot order note: `DataInitializer` (`@Order(1)`) always runs **before**
`ShowcaseDataInitializer`, so base accounts keep their documented passwords on
every boot. Startup takes ~35–60 s; wait for
`Showcase seed complete: 1 admin, 7 teachers, 30 learners, 15 guardians, 13 lessons`
in the log, then reload the browser.

**Reproducibility**: every clean restart with `SHOWCASE_SEED=1` rebuilds the
identical showcase. Verified 2026-09-09 (three reseeds during this session).

---

## 2. Demo accounts (from the actual seeders)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Learner (primary demo) | `student@elekeza.app` | `student123` | Juma Ali, DYSLEXIA profile, 6 subjects assigned |
| Learner (any) | `learner2@elekeza.app` … `learner30@elekeza.app` | `learner123` | 29 more learners, varied progress |
| Teacher | `teacher@elekeza.app` | `teacher123` | Alice Mwalimu — primary teacher demo |
| Teacher (any) | `teacher2@elekeza.app` … | `teacher123` | 6 more teachers |
| Guardian (primary demo) | `parent@elekeza.app` | `parent123` | Fatima Ali, parent of Juma Ali |
| Guardian (any) | `guardian4@elekeza.app` … `guardian15@elekeza.app` | `guardian123` | 12 more guardians, each linked to 2 wards |
| School admin | `admin@elekeza.app` | `admin123` | Grace Njeri, Sunrise Inclusive Academy (institution 1) |

Do not use `guardian1/2/3@…` in the demo — those emails are the base-seeder
accounts (`parent@`, `sibling@`, `caregiver@`, password `parent123` / `sibling123` / `caregiver123`).

---

## 3. Primary demo script (5–7 minutes, one coherent story)

**Story: Elekeza understands the learner, simplifies learning, tracks progress, and keeps teachers and guardians informed.**

1. **Open** `http://localhost:3005` → login screen.
2. **Learner login** `student@elekeza.app` / `student123`.
   - Dashboard shows assigned lessons, quiz stats, average score, achievements, upcoming work. (67–75% avg before demo quiz; quiz during demo raises it.)
3. **Open the Water Cycle lesson** (Continue Learning card).
   - Show the adaptation switcher: **Original → Clearer → Simplest**. Point out the honest source note (`LOCAL` deterministic mode, no external provider claim).
4. **Start the quiz** from the lesson. Answer all 4 questions; inline adaptive feedback appears per answer; submit → server-scored result + encouraging feedback.
5. **Back to dashboard** — quiz count +1, average score moved, possibly a new achievement badge. Open the notification bell: a lesson/quiz notification is there.
6. **Logout → Guardian login** `parent@elekeza.app` / `parent123`.
   - Guardian dashboard: child card (Juma Ali, learning profile, completed/pending/avg score, last active, teacher note).
   - Open **View Details**: "How Juma Ali is learning right now" summary, recent quizzes incl. the one just taken, dated progress history.
   - Notification bell: per-lesson score notifications matching the learner's history.
7. **Logout → Teacher login** `teacher@elekeza.app` / `teacher123`.
   - Teacher dashboard: 30 learners, quiz volumes, completion/avg charts (clean rounded numbers).
   - **Student Management**: full roster with SNE support types visible; open a learner's support panel (e.g. a DYSLEXIA learner): honest mastery signal + guidance actions.
8. **Logout → School admin login** `admin@elekeza.app` / `admin123`.
   - School Administration: Teachers 7 / Students 30 / Lessons 14, students-by-grade list, quick actions.
   - (Optional) **Platform** view: 1 school, 53 users, 30 enrolled learners.

**Exam module**: works and is verified (timer, auto-marking, attempt limits,
teacher authoring, guardian visibility) but is **not part of the primary
story**. Show only if explicitly asked, on the already-published demo exam.

---

## 4. AI mode (say it exactly like this)

> "Elekeza's adaptive-learning pipeline is fully operational. In this demo
> environment it runs in deterministic local mode — the external provider
> credential is not activated, so responses are generated locally and are
> labeled as such in the UI."

- Lesson adaptation: `source: LOCAL` shown in the UI. Real provider pipeline
  (backend → ai-elewa FastAPI → provider) is implemented and verified up to the
  provider boundary; the stored credential is invalid (401) — an external
  dependency, not a product defect.
- **Never** describe local output as "Groq", "live AI" or "real provider".
- The learner AI-Tutor chat page is an honest "coming soon" placeholder — it is
  not part of the demo.

---

## 5. Fallbacks

| Failure | What to do |
|---------|-----------|
| Adaptation/quiz API slow or erroring | Reload the page (H2 + dev server recover instantly). If still failing, show the lesson in Original mode and continue — the story survives without switching levels. |
| Frontend stale/hot-reload weirdness | Hard reload (`Ctrl+Shift+R`). The dev server recompiles in seconds. |
| Login session expires mid-demo | Log in again — sessions are cookie-based; nothing else is lost. |
| Backend must restart | Re-run the backend command from §1; ~40 s to a fully reseeded showcase. Re-login all roles. |
| External provider / network unavailable | Irrelevant to the demo — deterministic mode needs no network. Say so. |
| Anything unexplained fails | Do not claim it worked. Note it, move to the next section of the story. |

---

## 6. Verified evidence (2026-09-09 run)

| Claim | Status |
|-------|--------|
| Backend automated tests | **PASS — 146/146, 0 skipped** |
| Frontend typecheck (`tsc --noEmit`) | **PASS — exit 0** |
| Clean restart reseeds identical showcase | **PASS** (3 reseeds this session) |
| Learner journey in browser (dashboard → lesson → adaptation → quiz → score → progress → notifications) | **PASS** (quiz 100%, avg moved, achievement unlocked) |
| Teacher journey in browser (dashboard → roster → learner support panel → guidance action persisted) | **PASS** |
| Guardian journey in browser (child card → ward detail → per-lesson notifications) | **PASS** |
| Admin journey in browser (school dashboard → platform view) | **PASS** (after fixes below) |
| Deterministic AI adaptation, honest `source: LOCAL` | **PASS** (all 3 levels) |
| Quiz → progress → guardian notification chain | **PASS** |
| Real provider (Groq) credential | **BLOCKED — invalid (401); deterministic mode used instead, honestly labeled** |

### Defects found and fixed during this rehearsal (all re-tested)

1. **P0 — CORS on non-3000 frontend ports**: dev config hardcoded one origin; backend now launched with both origins allowed.
2. **P1 — Admin dashboard empty** (Students 0 / Lessons 0): showcase admin had no institution → roster endpoint empty; admin now belongs to school 1. Analytics field names mapped (`totalLearners/totalContent`, `institutions/students`).
3. **P1 — Seeder order nondeterminism**: `parent@elekeza.app` password flipped between `parent123` and `guardian123` across restarts; `DataInitializer` now `@Order(1)`.
4. **P1 — Roster SNE hidden**: teacher roster hardcoded `NONE`; now reads real `LearnerProfile.sneType`.
5. **P1 — Analytics credibility**: `activeThisWeek` counted progress rows (88 > 30 learners); now distinct learners. Unrounded percentages fixed.
6. **P2 — Guardian "Last Active: N/A"**: controllers took the first progress row (possibly pending); now the latest `completedAt`, rendered as a date.

### Known remaining limitations (non-blocking, do not hide if asked)

- Real external AI provider credential invalid → deterministic local mode (labeled).
- Learner AI-Tutor chat page is an honest placeholder ("coming soon").
- Students-by-grade groups under "Unassigned" — the data model has no grade field; do not invent grades on stage.
- In-memory H2: data resets on backend restart (by design for demo reproducibility).

---

## 7. Final pre-demo checklist

- [ ] Backend up: `curl http://localhost:8082/api/auth/csrf` → 200
- [ ] Frontend up: `http://localhost:3005/login` renders
- [ ] Learner login works (`student@elekeza.app` / `student123`)
- [ ] Guardian login works (`parent@elekeza.app` / `parent123`)
- [ ] Teacher login works (`teacher@elekeza.app` / `teacher123`)
- [ ] Admin login works (`admin@elekeza.app` / `admin123`)
- [ ] Water Cycle lesson present on learner dashboard
- [ ] Adaptation switcher shows all 3 levels
- [ ] Quiz completes and scores
- [ ] Notification bell shows entries for all roles

If any box fails, re-run the backend from §1 and re-check before demo start.
