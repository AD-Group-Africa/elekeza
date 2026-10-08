# ELEKEZA RUNBOOK — canonical local environment

One canonical way to start, check, and stop the complete system.
All commands run from the repository root in Git Bash. **Never touch foreign ports**
(3000/8000/8090/55432/6379/9000-9001/8025 belong to other projects).

## Ports

```text
FRONTEND:        3100   (Next.js dev/prod; nginx 80/443 in docker topology)
MAIN BACKEND:    8097   (Spring Boot chain-api, prod profile)
AI SERVICE:      8001   (FastAPI ai-elewa)
DATABASE:        5433   (PostgreSQL 15, db elekeza_chain_scratch; 5432 in docker)
REDIS/QUEUE:     6379   (docker topology only — not required for pilot locally)
E2E BACKEND:     8098   (on demand, Playwright webServer)
```

## Startup order (canonical)

```bash
# 1. DATABASE — local PostgreSQL 15 service (already installed); verify:
export PGPASSWORD=$(grep -E "^DB_PASSWORD=" backend/.env | cut -d= -f2- | tr -d '\r')
"/c/Program Files/PostgreSQL/15/bin/psql.exe" -h localhost -p 5433 -U postgres \
  -d elekeza_chain_scratch -tAc "select 1"

# 2. BACKEND (canonical: restart-local.sh — full prod-profile env, SERVER_PORT=8097)
bash backend/restart-local.sh            # optionally: bash backend/restart-local.sh <jarPath>
# rebuild first when backend code changed: cd backend && ./gradlew bootJar -x test
# (equivalent manual start: java -jar build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar
#  --spring.profiles.active=prod with DB_URL/JWT_SECRET/AI_*/CORS/FRONTEND_URL/SERVER_PORT set)

# 3. AI SERVICE (only this venv has groq/uvicorn)
cd ai-elewa && nohup venv/Scripts/python.exe -m uvicorn main:app \
  --host 127.0.0.1 --port 8001 > ../ai-elewa-recovered.log 2>&1 &
# env: AI_PROVIDER=groq, AI_API_KEY, INTERNAL_SECRET (from ai-elewa/.env — auto-loaded)

# 4. FRONTEND (dev; prod build exists via npm run build && npm start)
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8097 \
  nohup npm run dev -- --webpack -p 3100 > ../demo-fe-final-audit.log 2>&1 &
```

## Health checks

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/            # 200
curl -s http://localhost:8097/actuator/health                              # {"status":"UP"}
curl -s http://localhost:8001/health                                       # {"status":"ok"}
export PGPASSWORD=$(grep -E "^DB_PASSWORD=" backend/.env | cut -d= -f2- | tr -d '\r')
"/c/Program Files/PostgreSQL/15/bin/psql.exe" -h localhost -p 5433 -U postgres \
  -d elekeza_chain_scratch -tAc "select count(*) from users"                # 5 (demo)
# login round-trip (CSRF flow — see e2e-evidence/03-security/security-probes.sh)
```

## Logs

| Service | Log |
|---|---|
| Backend | `backend/chain-backend2.log` (boot) |
| AI | `ai-elewa-recovered.log` (current), `ai-elewa-recovery.log`, `ai-elewa-badkey*.log` (audit) |
| Frontend | `demo-fe-final-audit.log` (repo root) |

## Migrations & seed

- Migrations run **automatically on backend boot** (Flyway; V1–V16 applied).
- Seed: `V2__seed_demo.sql` is gated by the Flyway placeholder `demoSeedEnabled` — ON for dev/test, **OFF for prod/docker** (`DEMO_SEED_ENABLED:-FALSE`). Demo accounts (student@elekeza.app / teacher@elekeza.app / parent@elekeza.app / admin@elekeza.app / superadmin@elekeza.app) exist only in dev DBs.

## E2E

```bash
# Full Playwright suite (must stop the dev frontend first — webServer.reuseExistingServer=false)
cd frontend && E2E_BACKEND_PORT=8098 E2E_FRONTEND_PORT=3100 npx playwright test

# Closure product journeys (this engagement; dev FE stays up)
cd frontend && node scripts/product-closure/journey-learner.mjs
cd frontend && node scripts/product-closure/journey-teacher.mjs
cd frontend && node scripts/product-closure/journey-guardian.mjs
cd frontend && node scripts/product-closure/journey-admin.mjs
cd frontend && node scripts/product-closure/verify-fixes.mjs

# Backend suite
cd backend && ./gradlew test

# AI suite (port via env — fixed this audit)
cd ai-elewa && AI_TEST_BASE_URL=http://localhost:8001 venv/Scripts/python.exe -m pytest tests -q
```

## Shutdown order

```bash
# frontend → backend → AI → (database stays as a service)
netstat -ano | grep ":3100" | grep -i listen   # find npm parent pid, then:
taskkill //F //T //PID <pid>
# backend jar pid and uvicorn pid likewise (never kill foreign ports)
```

## Backup / restore

```bash
export PGPASSWORD=$(grep -E "^DB_PASSWORD=" backend/.env | cut -d= -f2- | tr -d '\r')
bash scripts/db-backup.sh --db elekeza_chain_scratch --out backups/<name>.dump
bash scripts/db-restore-drill.sh   # drill script (see release-evidence/database-results.md)
```

## Docker topology (deployment reference — not exercised locally)

```bash
docker compose up -d   # postgres + redis + backend(docker profile) + ai-service + frontend + nginx(80/443)
```

## First-run checklist

1. `.env` files populated (see system map §8; never commit).
2. `DEMO_SEED_ENABLED=FALSE` on any internet-facing host.
3. AI service: `AI_PROVIDER`, `AI_API_KEY`, `INTERNAL_SECRET` set — **`INTERNAL_SECRET` must be non-empty** (see P0 finding).
4. Backend: `AI_INTERNAL_SECRET` must equal the AI service `INTERNAL_SECRET`.
