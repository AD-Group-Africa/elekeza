# Elekeza — Deployment Runbook

## Topology

`docker-compose.yml` defines the full production stack:

| Service | Image | Notes |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | Primary datastore, Flyway manages schema |
| `redis` | `redis:7-alpine` | Cache / rate-limit backing store |
| `backend` | Spring Boot (Kotlin, Java 21) | REST API, CSRF, JWT cookies, Actuator health |
| `ai` | AI service | Personalization/content pipeline (optional at pilot) |
| `frontend` | Next.js (webpack + PWA) | Web app, service worker for offline |
| `nginx` | `nginx:1.27-alpine` | TLS termination, reverse proxy |

## Build & deploy

```bash
# 1. Configure environment
cp .env.example .env
# fill DB_PASSWORD, JWT_SECRET (32+ chars), AI_INTERNAL_SECRET, CORS_ALLOWED_ORIGINS, MPESA_* …

# 2. Build images
docker compose build

# 3. Start the stack (backend runs Flyway V1–V7 automatically on boot)
docker compose up -d

# 4. Verify
curl -fsS https://<backend-domain>/actuator/health     # {"status":"UP"}
curl -fsS https://<frontend-domain>/ -o /dev/null -w '%{http_code}\n'   # 200
```

## Database

- **Engine:** PostgreSQL 16.
- **Schema:** Flyway migrations `V1__baseline_schema.sql` … `V7__personalization.sql` run on every boot; a fresh database is fully self-provisioning.
- **JPA mode:** `ddl-auto=validate` in prod — Hibernate verifies the schema instead of mutating it.
- **Never** edit an applied migration; add `V8__…` and up.

## Backend profiles

- `dev` (default locally): H2 in-memory, seeded demo data on every boot (`DataInitializer`). **Never use in production.**
- `prod`: PostgreSQL, no auto-seed, fail-safe if required secrets are missing (`SPRING_PROFILES_ACTIVE=prod` in compose).

## Demoware / placeholders (pre-GO)

The demo seed (`DataInitializer`) ships school-admin, teacher, student, and guardian accounts with known passwords (`…@elekeza.app` / `<role>123`). It exists for the pilot demo environment. Before a real school onboards:

- run `prod` profile (no seeder active), **or**
- rotate/delete every demo account immediately after first boot.

## TLS & cookies

- Terminate TLS at nginx; the backend runs plain HTTP inside the compose network.
- Set `SECURE_COOKIES=true` so `elekeza_access`/`elekeza_refresh` cookies are marked `Secure` (they are already `HttpOnly`; access is `SameSite=Lax`, refresh `SameSite=Strict`).
- Frontend origin must exactly match `CORS_ALLOWED_ORIGINS` — the backend rejects wildcard origins when credentials are enabled.

## Rollback

Images are tagged (`IMAGE_TAG`); redeploy the previous tag and restart. Migrations are append-only; if a rollback requires a schema change, ship a new forward-only `V#` migration.

## Verification checklist after every deploy

1. `GET /actuator/health` → 200 UP.
2. Register a throwaway school via `POST /api/institutions/register` (then delete it).
3. Log in as a real user; confirm `/api/auth/me` returns the expected role + `institutionId`.
4. Open a lesson and confirm the PWA service worker registered (`sw.js` fetches succeed).
