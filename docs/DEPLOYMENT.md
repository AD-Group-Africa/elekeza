# Elekeza — Deployment

## Targets

| Component | Target | Status |
|---|---|---|
| Backend (Spring Boot) | Fly.io | Not deployed — requires `fly` CLI + auth (not installed) |
| Frontend (Next.js) | Netlify (`frontend/netlify.toml`) | Not deployed — requires `netlify` CLI + auth (not installed) |
| AI service (FastAPI) | Render — existing `https://elekeza-ai.onrender.com` | Reachable — `/health` returns 200 (verified 2026-08-18); provider calls still blocked until a valid `AI_API_KEY` is set |

No `fly.toml`, `render.yaml`, or Netlify site binding exists in the repo, and no
deploy CLIs (`fly`, `netlify`, `gh`) are installed in this environment. Deploying
therefore requires human authentication — the release audit stopped there and
completed every task that could be done without it.

## Backend (Fly.io)

1. Install `flyctl`, run `fly auth login`.
2. `fly launch` (or reuse an existing `AD-Group-Africa/elekeza` app). The
   `backend/Dockerfile` builds the Spring Boot app; the app listens on `$PORT`.
3. Provision Postgres: `fly postgres create` / attach, or set `DB_URL` to an
   external PostgreSQL (SQLAlchemy/JDBC URL).
4. Set secrets — **never placeholders**:
   ```
   fly secrets set JWT_SECRET="$(openssl rand -base64 48)"
   fly secrets set AI_INTERNAL_SECRET="$(openssl rand -base64 32)"
   fly secrets set DB_URL="jdbc:postgresql://..." DB_USER=... DB_PASSWORD=...
   fly secrets set CORS_ALLOWED_ORIGINS="https://<frontend-domain>"
   fly secrets set FRONTEND_URL="https://<frontend-domain>"
   fly secrets set MPESA_CONSUMER_KEY=... MPESA_CONSUMER_SECRET=... MPESA_PASSKEY=...
   fly secrets set MPESA_CALLBACK_URL="https://<backend-domain>/api/payments/callback"
   ```
5. Deploy: `fly deploy`. On first boot Flyway applies `V1__baseline_schema.sql`
   and `V2__seed_demo.sql` automatically. Verify `/actuator/health` = UP.

## Frontend (Netlify)

`frontend/netlify.toml` is ready (`npm run build`, `.next` publish, Netlify Next
plugin). In the Netlify dashboard set:

- `NEXT_PUBLIC_API_URL = https://<backend-domain>/api` — **required**: the
  production build fails fast without it (enforced in `next.config.ts`).
- Build command `npm run build`, base directory `frontend`, publish `.next`.

## AI (Render — existing app, do not duplicate)

1. Confirm the existing service is awake: `curl https://elekeza-ai.onrender.com/health`.
2. In Render env, set `AI_PROVIDER`, `AI_API_KEY` (valid), and
   `INTERNAL_SECRET` = the same value as the backend's `AI_INTERNAL_SECRET`.
3. If the app is asleep on the free tier, a manual deploy/restart wakes it.

## Local production-like verification

With a local PostgreSQL (this repo was verified against PostgreSQL 15 on
port 5433):

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"
$env:SERVER_PORT="8083"
$env:DB_URL="jdbc:postgresql://localhost:5433/<scratch_db>"
$env:DB_USER="postgres"; $env:DB_PASSWORD="postgres"
$env:JWT_SECRET="<random>"; $env:AI_INTERNAL_SECRET="<random>"
$env:CORS_ALLOWED_ORIGINS="https://<frontend-domain>"
$env:FRONTEND_URL="https://<frontend-domain>"
cd backend; .\gradlew.bat bootRun --no-daemon
```

This exercises Flyway migrations + Hibernate `validate` against real PostgreSQL.

## Release flow

1. `cd backend; .\gradlew.bat clean build` — build + tests must pass.
2. `cd frontend; npm run build` — must pass with `NEXT_PUBLIC_API_URL` set.
3. Smoke test every role (see `docs/SMOKE-TEST.md`).
4. `git add .; git commit`; `git tag -a v1.0.0-pilot`.
5. `git push origin staging --tags`.
