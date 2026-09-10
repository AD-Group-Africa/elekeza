# Elekeza — Demo-Day Runbook

## One day before

1. Boot the full stack locally (backend dev profile on 8082, frontend on 3000):
   ```bash
   # backend
   powershell -NoProfile -ExecutionPolicy Bypass -File .freebuff/start-backend-preview.ps1
   # frontend
   powershell -NoProfile -ExecutionPolicy Bypass -File .freebuff/start-fe-preview.ps1
   ```
2. Verify `http://127.0.0.1:8082/actuator/health` → UP and `http://localhost:3000/` → 200.
3. Run `.freebuff/live_journey.py` (from repo root) — must print **40/40**.
4. Log in once as each demo account (accounts list: `DEMO-ACCOUNTS.md`).
5. As teacher, ensure "The Water Cycle" is assigned to Juma (assignment list non-empty).

## Demo morning

- [ ] Backend healthy (`/actuator/health` UP)
- [ ] Frontend healthy (`http://localhost:3000/` loads, no console errors)
- [ ] Demo data present (seed ran — Juma exists, quiz attempt exists)
- [ ] `teacher@elekeza.app` / `student@elekeza.app` / `parent@elekeza.app` / `sibling@elekeza.app` / `caregiver@elekeza.app` all log in
- [ ] Lesson assigned to Juma
- [ ] Personalization works (How I Learn → lesson → My usual style)
- [ ] Assessment works (quiz opens, submit works)
- [ ] Progress works (guardian ward view shows quiz + progress)
- [ ] AI status: mock/deterministic adaptation active (by design; AI optional)
- [ ] M-Pesa status: mock mode — do NOT demo payments, show integration status instead
- [ ] Internet: frontend/backend run fully offline/local; only live registration (Act 1) needs nothing external
- [ ] Fallback ready: screenshots/screen-recordings of all five acts (see troubleshooting)

## 30 minutes before

Run the critical journey once end-to-end (teacher assign → learner adapt →
guardian view). **Do not deploy code changes after this point.**

## During demo

- If a write fails with 403 in the browser: refresh the page (CSRF token
  rotates); never retry the same form twice.
- Keep a second browser profile (or incognito) logged in as the next act's
  account to make role switches instant.
