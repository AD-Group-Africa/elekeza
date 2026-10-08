# DEPLOYMENT CHECKLIST — Pilot (exact, actionable)

## Domain (decision: Harry)

- [ ] Choose canonical domain (recommendation: `elekeza.app` main + `api.elekeza.app` + `ai.elekeza.app`).
- The prod yaml already defaults `AI_SERVICE_URL` to a placeholder (`https://elekeza-ai.onrender.com`) — must be pointed at the real AI host.

## DNS records to create

| Record | Name | Value | Purpose |
|---|---|---|---|
| A | `elekeza.app` | server IPv4 | main app (nginx) |
| A | `api.elekeza.app` | server IPv4 | backend (or nginx route on main) |
| A | `ai.elekeza.app` | server IPv4 | AI service (internal-only behind secret; TLS still required) |
| CNAME | `www` | `elekeza.app` | canonical |
| TXT | `elekeza.app` | provider verification | email sender verification (once SMTP chosen) |
| MX/SPF/DKIM/DMARC | — | provider values | required for password-reset + notification mail deliverability |

(No AAAA unless the host publishes IPv6.)

## TLS

- [ ] Issue certs via the compose certbot sidecar (`certbot_data` volume already wired) or host-level (Caddy/cloud LB).
- [ ] Enforce HTTP→HTTPS redirect at nginx (`infrastructure/nginx`).
- [ ] Auto-renewal: certbot timer/compose renewal loop; verify with `openssl s_client` after issuance.
- [ ] `SECURE_COOKIES=true` (default in prod) once HTTPS is live.

## Hosting (compose topology exists; single server is enough for pilot)

| Component | Host | Notes |
|---|---|---|
| Frontend | docker `frontend` behind nginx :443 | `next build` output; 59-route prod build verified |
| Backend | docker `backend` (SPRING_PROFILES_ACTIVE=docker) | behind nginx `/api` route |
| AI | docker `ai-service` | **INTERNAL_SECRET must be set — see security-results P0** |
| Database | docker postgres:16 + volume | or managed PG; backups via `scripts/db-backup.sh` + nightly cron |
| Object storage | local disk (mock) initially | R2 when creds exist |
| Monitoring | none yet (pilot-optional) | Langfuse/Sentry DSNs when provided |

## Secrets (set in server `.env`, never committed — verified none in repo)

```text
DATABASE_URL / DB_*         # postgres
JWT_SECRET                  # (SECURITY_JWT_SECRET locally)
INTERNAL_SECRET / AI_INTERNAL_SECRET   # must MATCH on both sides, non-empty (P0)
AI_API_KEY                  # Groq
MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET / MPESA_PASSKEY / MPESA_SHORTCODE / MPESA_CALLBACK_URL / MPESA_ENVIRONMENT
AFRICA_TALKING_API_KEY / AFRICA_TALKING_SENDER_ID      # SMS (optional for pilot)
MAIL_HOST / MAIL_PORT / MAIL_USERNAME / MAIL_PASSWORD  # SMTP (needed for self-serve onboarding emails)
CLOUDFLARE_R2_* / R2_ENDPOINT                          # storage (optional for pilot)
CORS_ALLOWED_ORIGINS / FRONTEND_URL
DEMO_SEED_ENABLED=FALSE     # mandatory on internet-facing host
FEES_MPESA_MODE=mock|live
```

## Pre-flight (all automated already)

- [x] `scripts/staging-gate.sh` GATE PASSED (bootJar → prod build → fresh DB → migrations → health → login round-trip)
- [x] Backend 278/278 · E2E 31/31 · journeys green (today)
- [ ] Final gate re-run on the actual pilot server after DNS/TLS

## Go-live sequence (90 minutes)

1. Provision server + Docker; clone repo; create `.env` from checklist.
2. `docker compose up -d` (postgres, redis, backend, ai, frontend, nginx).
3. DNS records + certbot issuance; verify HTTPS on all three hosts.
4. Re-run `staging-gate.sh` against the live origin.
5. Create the first real school via `/school/onboarding` (staff OTP + CSV import now return credentials — verified).
6. Smoke: one learner lesson+quiz, guardian view, one AI tutor call, one mock M-Pesa payment.
