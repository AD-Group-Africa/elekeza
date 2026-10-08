# ELEKEZA — DEPLOYMENT

> Canonical deployment reference. Local development, staging gate, production runbook.

## 1. Environments

| Environment | Stack | Notes |
|---|---|---|
| Local dev | FE :3100 (`next dev --webpack`, `NEXT_PUBLIC_API_URL=http://localhost:8097`) · BE :8097 prod profile via `backend/restart-local.sh` (pins `SERVER_PORT=8097`; sources `backend/.env`; env: DB :5433 scratch, JWT from `SECURITY_JWT_SECRET`, AI :8001, CORS/FRONTEND_URL :3100, `SECURE_COOKIES=false`, `DEMO_SEED_ENABLED=FALSE`, providers mock) · AI :8001 (`ai-elewa/venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001`, auto-loads `ai-elewa/.env`) · PG 15 :5433 `elekeza_chain_scratch` | foreign ports 3000/8000/8080/8090/55432/6379/9000-9001/8025 untouchable |
| Staging gate | `scripts/staging-gate.sh` — prod FE build → fresh-PG migrations → bootJar with fail-fast env → `next start` → smoke | GATE PASSED 2026-09-30 |
| Production | docker compose (+ TLS override) on a real host | **not yet exercised on a host — external blocker** |

## 2. Docker topology

`docker-compose.yml`: postgres:16 (:5432, volume `postgres_data`), redis:7 (`REDIS_PASSWORD`),
backend (docker profile), ai-service (:8000 internal), frontend (standalone `next start`),
nginx 80/443 + `certbot_data`. `DEMO_SEED_ENABLED` default FALSE; `FEES_MPESA_MODE` default mock.

TLS path: `docker-compose.tls.yml` renders `infrastructure/nginx/templates/nginx.conf.template`
with `NGINX_DOMAIN` (**fail-fast `:?`**), serves ACME webroot, mounts `TLS_CERT_HOST_DIR` read-only.
Bring-up order and certbot webroot issuance are documented in `docs/archive/` PILOT_DEPLOYMENT_RUNBOOK
(kept for provenance) — summary in §4.

## 3. Required environment (production — placeholders in `.env.example`)

**Boot-blocking:** `DB_URL/DB_USER/DB_PASSWORD` · `JWT_SECRET` (64+ random) ·
`AI_INTERNAL_SECRET` (= ai-elewa `INTERNAL_SECRET`) · `CORS_ALLOWED_ORIGINS` (exact origins;
wildcard refused at boot) · `FRONTEND_URL` · `SECURE_COOKIES=true` · `SPRING_PROFILES_ACTIVE=prod` ·
`NEXT_PUBLIC_API_URL` (**frontend build-time**; `next.config.ts` throws if missing — bare origin,
no `/api` suffix).

**State:** `DEMO_SEED_ENABLED` **must remain unset/false** in production (verified: users=0 after
first boot; demo logins 401).

**Optional integrations (mock until enabled):** `AI_PROVIDER/AI_API_KEY` · `MPESA_ENVIRONMENT` +
`MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE/CALLBACK_URL` · `EMAIL_PROVIDER=javamail` + `MAIL_*` ·
`SMS_PROVIDER=africa_talking` + `AFRICA_TALKING_*` · `STORAGE_PROVIDER=cloudflare_r2` +
`CLOUDFLARE_R2_*` · observability: `SENTRY_DSN_*`, `LANGFUSE_*`.

## 4. Production deploy procedure (summary)

```
host prep (Ubuntu, Docker, DNS A-record, ufw 80/443; block 5432/6379/8080 externally)
→ cp .env.example .env; fill per §3 (DEMO_SEED_ENABLED unset)
→ TLS: docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
       (nginx restarts harmlessly until certs exist)
       sudo certbot certonly --webroot -w "$TLS_CERT_HOST_DIR" -d "$NGINX_DOMAIN" -d "www.$NGINX_DOMAIN"
       docker compose -f docker-compose.yml -f docker-compose.tls.yml restart nginx
       renewal: host cron 2×daily certbot renew + nginx restart deploy-hook
→ verify: curl -I https://$NGINX_DOMAIN → 200; http → 301
→ migrations: 16/16 success in flyway_schema_history
→ first-boot security: users=0; demo credentials 401; only 80/443 published; cookies Secure;
   CORS rejects foreign origins; JWT_SECRET 64+ random
→ smoke: register throwaway school → login → assign → quiz → logout (then delete)
→ backups: scripts/db-backup.sh cron nightly (+ before every migration deploy); rehearsed restore
```

Rollback: previous image tag + `docker compose up -d`; migrations are forward-only — never
downgrade the DB.

## 5. Health, logs, monitoring

- `GET /actuator/health` (only exposed actuator endpoint; `show-details: never`).
- Logs: container stdout; **no secrets/PII logging** (audited). Gap (P1): minimal application-level
  logging of auth/integration failures — add structured logging before revenue.
- Optional: Sentry (`SENTRY_DSN_*`), Langfuse for AI traces.
- Alert-worthy events: 429 spikes, M-Pesa callback rejections, `ddl-auto=validate` failures,
  upload-400 spikes.

## 6. Database operations

- Backups: `PGPASSWORD='<pw>' scripts/db-backup.sh --host … --port … --user … --db … --out … --keep 14`
  (fail-loud `pg_dump -Fc`, manifest verified). **Needs PGPASSWORD exported** (known quirk).
- Restore drill: `PGPASSWORD='<pw>' scripts/db-restore-drill.sh backups/<dump>` — disposable DB,
  core-table checks, Flyway history, drop. **PASSED this engagement.**
- RPO 24h (nightly), RTO <1h. Off-site copies are an operational obligation.
- Backups contain learner PII → encrypt at rest at the hosting layer; never web-reachable.
