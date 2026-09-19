# Elekeza — Production Deployment Checklist

Verified against the repository on 2026-09-07. Every variable below is read by actual code
(`backend/src/main/resources/application*.yaml`, `frontend/next.config.ts`, `ai-elewa/.env.example`).

## Topology (what runs where)

```text
                    HTTPS :443
                        │
                 nginx (TLS termination)
              infrastructure/nginx/nginx.conf
              elekeza.app → Let's Encrypt certs
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
     frontend      backend          ai-elewa
   (Next.js)    (Spring Boot,     (FastAPI)
                 Flyway + JWT)     Groq client
          └──── PostgreSQL 16 ── Redis 7 ────┘
```

`docker-compose.yml` builds all four services (backend, ai-elewa, frontend, nginx) plus
`postgres:16-alpine` and `redis:7-alpine`. TLS certs are expected at
`/etc/letsencrypt/live/elekeza.app/` (see nginx.conf).

---

## Phase 0 — Server prerequisites

- [ ] Ubuntu/Debian VM with 2+ vCPU, 4+ GB RAM, 40+ GB disk
- [ ] Docker Engine + Docker Compose v2 installed
- [ ] DNS: `elekeza.app` + `www` → server IP (A records)
- [ ] Firewall: open 80, 443 only; **block 5432, 6379, 8080 externally**
- [ ] Certbot: `certbot certonly --standalone -d elekeza.app -d www.elekeza.app`
      (then renew via cron; nginx expects the paths above)
- [ ] Clone the repository; create `.env` from `.env.example` (never commit it)

## Phase 1 — Mandatory environment (app will not boot correctly without these)

### Backend (`docker-compose.yml` `backend` service / system env)

| Variable | Value | Notes |
| -------- | ----- | ----- |
| `DB_URL` | `jdbc:postgresql://postgres:5432/elekeza` | prod profile reads this |
| `DB_USER` / `DB_PASSWORD` | dedicated user / strong password | not the postgres superuser |
| `JWT_SECRET` | `openssl rand -base64 48` | **all access tokens invalidate if this changes — set once** |
| `AI_INTERNAL_SECRET` | `openssl rand -base64 32` | must equal `INTERNAL_SECRET` in ai-elewa |
| `CORS_ALLOWED_ORIGINS` | `https://elekeza.app,https://www.elekeza.app` | server **fails to start** on `*` with credentials |
| `FRONTEND_URL` | `https://elekeza.app` | |
| `SECURE_COOKIES` | `true` | cookies will only work over HTTPS |
| `SPRING_PROFILES_ACTIVE` | `prod` | enables Flyway + `ddl-auto=validate` |

### AI service (`ai-elewa/.env`)

| Variable | Value |
| -------- | ----- |
| `AI_PROVIDER` | `groq` |
| `AI_API_KEY` | Groq key from https://console.groq.com |
| `INTERNAL_SECRET` | same value as backend `AI_INTERNAL_SECRET` |

### Frontend — **build-time** (not runtime!)

| Variable | Value | Notes |
| -------- | ----- | ----- |
| `NEXT_PUBLIC_API_URL` | `https://elekeza.app` (bare backend origin, **no `/api` suffix**) | `next.config.ts` **throws at build time** if missing; it is the proxy rewrite target and gets baked into the bundle |

### Infrastructure services

- [ ] PostgreSQL volume mounted for persistence; `DB_PASSWORD` set in its env too
- [ ] Redis reachable (backend token/rate-limit use is single-instance safe)

## Phase 2 — Integration credentials (enable per feature; defaults are safe mocks)

| Feature | Enable by setting | Required values |
| ------- | ----------------- | --------------- |
| Real AI (beyond mock) | `AI_API_KEY` | Groq key (already Phase 1 for ai-elewa) |
| SMS — Africa's Talking | `SMS_PROVIDER=africa_talking` | `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` |
| Email — SMTP | `EMAIL_PROVIDER=javamail` | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` (use app password, not account password) |
| File storage — R2 | `STORAGE_PROVIDER=cloudflare_r2` | `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (`R2_ENDPOINT` optional) |
| M-Pesa payments | set all four | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` (sandbox `174379`; production = your paybill/till), `MPESA_CALLBACK_URL=https://elekeza.app/api/payments/callback`, `MPESA_ENVIRONMENT=sandbox\|production` |
| Google OAuth | when configured | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` + redirect URIs in Google Console |

**M-Pesa Daraja specifics (production):**
- [ ] Daraja production app approved (consumer key/secret)
- [ ] Production passkey (from theshortcode's Lipa na M-Pesa Online)
- [ ] Shortcode is your own paybill/till, **not** `174379`
- [ ] Callback URL must be **public HTTPS**; Daraja must reach `/api/payments/callback`
      (the endpoint is CSRF-exempt and validates payload + idempotency — safe to expose)

**Optional observability:** `SENTRY_DSN_BACKEND`, `SENTRY_DSN_AI`, `NEXT_PUBLIC_SENTRY_DSN`,
`LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` (also in ai-elewa env).

**Optional tuning (sane defaults exist):** `UPLOAD_DIR` (default `uploads` — mount a volume if
not using R2), `MAX_UPLOAD_BYTES` (default 10 MB), `LOGIN_MAX_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`.

## Phase 3 — Build & deploy

```bash
# from the repo root
docker compose build                      # builds backend, ai-elewa, frontend, nginx
docker compose up -d                      # postgres, redis, backend, ai, frontend, nginx

# verify
docker compose ps                         # all healthy
curl -s https://elekeza.app/api/health    # backend health via nginx (or :8082 direct internally)
curl -sI https://elekeza.app              # 200, HSTS/TLS headers present
```

- [ ] Flyway migrated V1 → V9 (check backend logs: `Migrating schema ... success`)
- [ ] `ddl-auto=validate` passed (prod profile) — entity/schema in agreement
- [ ] Register a throwaway account end-to-end through the real domain
- [ ] Log in, take an exam, check the `Secure` cookie flags in devtools
- [ ] M-Pesa sandbox transaction if credentials configured (initiate → callback → receipt)

## Phase 4 — Go-live verification

- [ ] HTTPS enforced: `http://` redirects to `https://`
- [ ] Cookies: `elekeza_access` has `Secure; HttpOnly; SameSite=Lax`
- [ ] CORS: cross-origin request from another domain is refused
- [ ] Actuator: only `/actuator/health` reachable; no other actuator endpoints exposed
- [ ] Restart test: `docker compose restart backend` → data intact, re-login works
      (JWT secret stable), Flyway does not re-run from scratch
- [ ] Backups: nightly `pg_dump` cron + tested restore
- [ ] Logs: no secrets/passwords/tokens in `docker compose logs`
- [ ] Sentry/Langfuse receiving events (if configured)
- [ ] Demo accounts from dev (student@/teacher@/parent@elekeza.app) are **not** present —
      they are dev-profile seed data; the prod profile must not seed them

## Quick reference — every env var, categorized

```text
REQUIRED (boot-blocking):
  DB_URL, DB_USER, DB_PASSWORD, JWT_SECRET, AI_INTERNAL_SECRET,
  CORS_ALLOWED_ORIGINS, FRONTEND_URL, SECURE_COOKIES=true,
  SPRING_PROFILES_ACTIVE=prod, NEXT_PUBLIC_API_URL (frontend BUILD-TIME),
  AI_API_KEY + INTERNAL_SECRET (ai-elewa)

DEMO-RECOMMENDED (pilot day):
  AI_API_KEY (real Groq key so simplification works live)

OPTIONAL INTEGRATIONS (mock until enabled):
  SMS_PROVIDER + AFRICA_TALKING_API_KEY, AFRICA_TALKING_SENDER_ID
  EMAIL_PROVIDER + MAIL_HOST/PORT/USERNAME/PASSWORD
  STORAGE_PROVIDER + CLOUDFLARE_R2_* (5 vars)
  MPESA_CONSUMER_KEY/SECRET, MPESA_PASSKEY, MPESA_SHORTCODE,
  MPESA_CALLBACK_URL, MPESA_ENVIRONMENT
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

OPTIONAL OBSERVABILITY:
  SENTRY_DSN_BACKEND, SENTRY_DSN_AI, NEXT_PUBLIC_SENTRY_DSN,
  LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY

TUNING (defaults fine):
  UPLOAD_DIR, MAX_UPLOAD_BYTES, LOGIN_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS, REDIS_HOST/PORT/PASSWORD
```

## Known deployment facts (verified in code)

- `next.config.ts` **throws** if `NEXT_PUBLIC_API_URL` is missing in production builds — set it
  before `npm run build` / Docker build.
- CORS **refuses to boot** with `*` when credentials mode is on — list exact origins.
- `SECURE_COOKIES=true` requires real HTTPS; set it only after TLS is live.
- Exam/access tokens are signed with `JWT_SECRET`; rotating it logs every user out (acceptable
  at launch, plan for later).
- The login rate limiter is in-process — correct for single-instance; needs Redis backing before
  horizontal scaling.
