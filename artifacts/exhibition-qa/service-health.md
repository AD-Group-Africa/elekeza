# Service Health — 2026-10-12

## Stack under test
| Service | Expected | Actual | Health | Evidence |
|---|---|---|---|---|
| Frontend (Next.js dev, webpack) | :3100 | :3100 LISTENING | HTTP 200 | `curl /` → 200; dev log `fe-exhibition-3100.log` shows "Ready in 1583ms" |
| Backend (Spring Boot, prod profile) | :8097 | :8097 LISTENING | UP | `curl http://localhost:8097/actuator/health` → 200 `{"status":"UP"}` |
| AI service (FastAPI/uvicorn) | :8001 | :8001 LISTENING | UP | `curl http://localhost:8001/health` → 200 |
| PostgreSQL | :5433 | :5433 LISTENING (pid 7412, pre-existing — untouched) | UP (in use by backend) | `elekeza_chain_scratch` DB |

## Port verification
- Expected per user: 3100 / 8097 / 8001. **Confirmed exactly** — no port changes made.
- Other listeners observed and NOT touched: :5433 (Postgres), unrelated system ports.

## Processes stopped / restarted
- No stale service listeners wereRunning at session start (Freebuff host restart had killed all).
- Processes started (all spawned this session by my commands, none pre-existing):
  - AI uvicorn (background, log `ai-exhibition-8001.log`)
  - Backend via `backend/restart-local.sh` (log `backend/chain-backend2.log`)
  - Next dev :3100 (log `fe-exhibition-3100.log`)
- Orphans cleaned from a timed-out earlier Playwright attempt: PIDs 15836 (:3005) and 20640 (:8090) — both were spawned by my own command this session. No unrelated process was touched.

## Auth probe results (POST /api/auth/login)
| Account | Status |
|---|---|
| teacher@elekeza.app / teacher123 | 200 |
| student@elekeza.app / student123 | 200 |
| parent@elekeza.app / parent123 | 200 |
| admin@elekeza.app / (tried admin123, schooladmin123, superadmin123, demo123) | 401 — see blockers.md |
