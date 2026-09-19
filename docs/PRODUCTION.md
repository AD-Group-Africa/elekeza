# Elekeza — Production

Status: **PILOT PREPARATION** (see release gate in the final engineering report).

## Architecture

```
Browser / Android (Capacitor)
   │  HTTPS
   ▼
Frontend (Next.js on Netlify)  ── /api/* rewritten to the backend ──┐
                                                                     ▼
                                              Spring Boot backend (Fly.io) :8080
                                                                     │
                       ┌──────────────┬──────────────┬──────────────┼──────────────┐
                       ▼              ▼              ▼              ▼              ▼
                 PostgreSQL        Redis (declared,     FastAPI AI (Render)      External
                 (Fly Postgres)    not yet used)       elekeza-ai.onrender.com   (M-Pesa, mail)
```

## Configuration

Production configuration lives in `backend/src/main/resources/application-prod.yaml`
and is driven entirely by environment variables. **There are no secret defaults in
production config** — the app fails fast at startup if a required secret is missing.

| Variable | Required | Purpose |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | yes | PostgreSQL connection (Fly Postgres URL) |
| `JWT_SECRET` | yes | ≥ 32 random bytes, base64/hex — sign access tokens |
| `AI_INTERNAL_SECRET` | yes | shared key for backend → AI service calls (`X-Internal-Key`) |
| `CORS_ALLOWED_ORIGINS` | yes | exact production frontend origin(s), comma-separated |
| `FRONTEND_URL` | yes | production frontend URL (cookie domain / links) |
| `AI_SERVICE_URL` | no | defaults to `https://elekeza-ai.onrender.com` |
| `SECURE_COOKIES` | no | defaults `true` in prod |
| `MAIL_HOST/PORT/USERNAME/PASSWORD` | no | SMTP; mail health check disabled |
| `MPESA_*` | yes* | consumer key/secret/passkey + callback URL (required for payments) |
| `AI_PROVIDER`, `AI_API_KEY` | yes* | AI service only — provider + valid provider key |

*Marked integrations must have real values before those features go live; the core
pilot (auth, content, quiz, guardian) runs without them.

## Database

- **PostgreSQL only in production.** H2 is dev-only (`application-dev.yaml`).
- Schema is owned by **Flyway** (`spring.flyway.enabled: true`).
- `ddl-auto` is `validate` — Hibernate must never alter the schema.
- Migrations live in `backend/src/main/resources/db/migration/`:
  - `V1__baseline_schema.sql` — the consolidated schema built from the current
    JPA entity model. **Replaces the old V1–V32 set**, which spanned several
    schema generations and could not build a fresh database (undefined trigger
    function, missing `users`/`learner_profiles` tables, conflicting definitions).
    No environment ever applied the old set because Flyway was not a dependency.
  - `V2__seed_demo.sql` — pilot demo accounts and a demo lesson/quiz
    (see below). Delete or trim before a fully public launch.

## Demo accounts (pilot only)

Seeded by `V2__seed_demo.sql`. **Never use these in a public production launch.**

| Role | Email | Password |
|---|---|---|
| Teacher | teacher@elekeza.app | teacher123 |
| Student | student@elekeza.app | student123 |
| Guardian | parent@elekeza.app | parent123 |
| School Admin | admin@elekeza.app | admin123 |
| Super Admin | superadmin@elekeza.app | superadmin123 |

## AI

- Deployment: **existing Render app `https://elekeza-ai.onrender.com`** — do not
  create a second deployment.
- Backend sends every request with `X-Internal-Key: <AI_INTERNAL_SECRET>`; the AI
  service validates it (`ai-elewa/security.py`). Both must use the same value.
- The AI service requires `AI_PROVIDER` (groq/openai/anthropic/google) and a
  **valid** `AI_API_KEY` at startup, plus `PYTHONUTF8=1` on Windows hosts
  (config prints a UTF-8 emoji on import).
- **Known blocker:** the Render app is reachable (health 200), but no **valid
  Groq key** exists in this environment — provider calls return `401 Invalid API
  Key`, so AI simplification/quiz/adaptive calls fail and the backend falls back
  to storing the raw text (uploads still succeed; quizzes use fallback
  questions). Configure a valid `AI_API_KEY` on Render, plus an
  `INTERNAL_SECRET` matching the backend's `AI_INTERNAL_SECRET` (see rotation
  below), then re-run `docs/SMOKE-TEST.md` rows 3 + 8–11.

## Internal secret rotation

The AI internal secret (`X-Internal-Key` = `INTERNAL_SECRET` on the AI service =
`AI_INTERNAL_SECRET` on the backend) was previously committed to the repository
(test fixtures, tools, and the generated `repomix-ai.xml` export). All tracked
occurrences have been scrubbed and replaced with the placeholder
`elekeza-test-internal-key-not-a-secret`; the fixtures now read the key from the
environment. Treat the old value as **compromised**:

1. Generate a new ≥ 32-char random value (e.g. `openssl rand -hex 32`).
2. Set it on **every environment** so they match:
   - Render AI service env: `INTERNAL_SECRET=<new>` (via Render dashboard).
   - Backend env (Fly.io): `AI_INTERNAL_SECRET=<new>`.
   - Local `ai-elewa/.env`: `INTERNAL_SECRET=<new>` (untracked).
   - Local backend: `AI_INTERNAL_SECRET=<new>`.
3. Restart both services; verify with:
   `curl -si -H "X-Internal-Key: <new>" .../ai/simplify/text` → not 401.
4. The test/tool scripts use the placeholder by default; run them with
   `INTERNAL_SECRET=<new>` exported so they authenticate against a real server.

## Security posture

- JWT access cookie: `HttpOnly`, `SameSite=Lax`, 15 min; refresh cookie:
  `HttpOnly`, `SameSite=Strict`, 7 days, path `/api/auth`, rotated + revoked.
- CSRF: `CookieCsrfTokenRepository` with the classic
  `CsrfTokenRequestAttributeHandler` (axios echoes the `XSRF-TOKEN` cookie);
  login/register/refresh/csrf endpoints exempt.
- CORS: exact origin list from `CORS_ALLOWED_ORIGINS` — never `*`.
- RBAC: `/api/teacher/**`, `/api/guardian/**`, `/api/institutions/**`,
  `/api/analytics/**`, `/api/admin/**` role-gated; registration always creates
  `STUDENT` (no privilege escalation).
- Secrets: `.env*`, keystores, and build output are gitignored; only `.env.example`
  files (now placeholders) are tracked.

## Observability

- Actuator: `/actuator/health` (unauthenticated, no details). Custom
  `/api/system/health` is ADMIN-only.
- Default Spring logging (no logback override). Verified: no JWTs, keys, or
  cookie values appear in application logs.
- Audit: `audit_logs` table (90-day retention purge runs daily at 02:00).
