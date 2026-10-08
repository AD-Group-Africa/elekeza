# TASK 1 — SYSTEM RECONNAISSANCE / SERVICE TABLE

Snapshot: 2026-10-02 (final product-closure audit). Git HEAD `b139b8e` (= tag `v0.1.0-pilot-r2`),
branch `integration/staging-reconciliation`, working tree 50 porcelain entries (40 pre-existing
user WIP + 10 uncommitted fix-loop files from the earlier closure fix round). Frozen release
`v0.1.0-pilot` (b2da56e) untouched — verified `git log --oneline -3` and HEAD hash.

## Service table

| SERVICE | PORT | STATUS | HEALTH | SOURCE |
|---|---|---|---|---|
| Frontend — Next.js (dev, webpack) | 3100 | UP | HTTP 200 on `/` (verified live) | `cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8097 npm run dev -- --webpack -p 3100` (log: `demo-fe-final-audit.log` at repo root; pid family 78148/82764) |
| Backend — chain-api (Spring Boot, prod profile) | 8097 | UP | `/actuator/health` → `{"status":"UP"}`; `/api/auth/csrf` → 200 (verified live) | Runnable jar with all closure fixes; env from `backend/.env`; CORS locked to `http://localhost:3100`; boot log `backend/chain-backend2.log` |
| AI service — ai-elewa (FastAPI + Groq qwen/qwen3-8b→27b catalog) | 8001 | UP | `GET /health` → `{"status":"ok"}` (verified live) | `ai-elewa/venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001`; env `INTERNAL_SECRET`, `GROQ_API_KEY` from `ai-elewa/.env` |
| PostgreSQL 15 | 5433 | UP | `SELECT count(*) FROM users` → 5 (verified live) | Local service, DB `elekeza_chain_scratch`; creds `DB_USER`/`DB_PASSWORD` in `backend/.env` (DB_NAME in .env is stale — live DB is elekeza_chain_scratch) |
| E2E backend instance (Playwright webServer) | 8098 | ON DEMAND | started by `frontend/playwright.config.ts` (`E2E_BACKEND_PORT=8098`), killed again after suites | `frontend/playwright.config.ts`, `E2E_BACKEND_PORT=8098 E2E_FRONTEND_PORT=3100 npx playwright test` |
| Foreign project stack (demo-v1 / pcea-works) | 3000, 8000, 8090, 55432, 6379, 9000–9001, 8025 | UNTOUCHABLE (foreign) | n/a | Must never be started/stopped/killed by Elekeza tooling |

## Startup commands (existing configuration — none invented)

1. DB: local PostgreSQL 15 service on 5433 (already running as a Windows service).
2. Backend: `java -jar` chain-api jar (prod profile) with `backend/.env` sourced → :8097.
3. AI: `cd ai-elewa && venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001` (only this interpreter has groq/uvicorn).
4. Frontend: `cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8097 npm run dev -- --webpack -p 3100`.

## Environment requirements (keys observed, values never printed)

- `backend/.env`: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `GROQ_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `SECURITY_JWT_SECRET`, `SECURITY_JWT_ACCESS_TOKEN_EXPIRY_MS`, `SECURITY_JWT_REFRESH_TOKEN_EXPIRY_MS`, `SECURITY_JWT_COOKIE_NAME`, `SECURITY_JWT_REFRESH_COOKIE_NAME`
- `ai-elewa/.env`: `INTERNAL_SECRET`, `GROQ_API_KEY`
- Frontend env: `NEXT_PUBLIC_API_URL=http://localhost:8097`

## Request routing note

The browser app calls same-origin `http://localhost:3100/api/*`; Next.js rewrites proxy these to
the backend on :8097 (observed in network logs). The AI service is called backend-side with the
internal shared secret — never from the browser (verified in TASK 5/8 network evidence).
