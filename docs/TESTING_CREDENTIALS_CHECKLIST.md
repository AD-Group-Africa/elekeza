# Elekeza — Testing Credentials Checklist

What must be obtained externally vs. what is finished in code. Verified against the
codebase on 2026-09-08. Variable names are the actual ones the code reads.

## A. AI provider (Groq) — BLOCKING for the AI pathway

Code is complete and verified to the provider boundary. The pipeline ran and failed
only on the provider call.

- [ ] Create/verify a Groq account (https://console.groq.com)
- [ ] Generate a **valid API key**
- [ ] Put it in `ai-elewa/.env` as `AI_API_KEY=` (and in the deployed ai-elewa env)
- [ ] Confirm `AI_PROVIDER=groq` (models: stage2 `llama-3.3-70b-versatile`, stage3 `llama-3.1-8b-instant`)
- [ ] Note usage limits/budget for the pilot
- [ ] Re-run the chain proof: teacher → `POST /api/content/upload/text` → expect `adapted:true`

Variables: `AI_API_KEY`, `AI_PROVIDER`, `INTERNAL_SECRET` (ai-elewa) ↔ `AI_INTERNAL_SECRET` (backend) — must match.

## B. M-Pesa (Daraja) — required for real fee payments

Code (ledger, callback auth, idempotency, reconciliation) is implemented and negative-tested.

- [ ] Safaricom Daraja developer account (sandbox first)
- [ ] Consumer key + consumer secret
- [ ] Shortcode (sandbox: test paybill)
- [ ] Passkey (sandbox passkey for sandbox; production Lipa na M-Pesa Online passkey for live)
- [ ] Public HTTPS callback URL reachable from Safaricom (e.g. `https://<domain>/api/payments/callback`)
- [ ] Test MSISDN registered in the sandbox toolkit
- [ ] Set backend env: `MPESA_*` per `docs/production/environment-variables.md` + `MPESA_CALLBACK_URL`
- [ ] Run one sandbox STK push → approve on test phone → verify callback lands, ledger row goes PENDING→SUCCESS, duplicate callback is idempotent

## C. Africa's Talking (SMS) — required only if SMS notifications are in the demo

- [ ] Africa's Talking account + API key
- [ ] Sender ID / shortcode approved
- [ ] Backend env: `SMS_PROVIDER=africa_talking` + key/username vars (see environment-variables.md)
- [ ] Send one test SMS and confirm delivery report

## D. Google OAuth — required only if Google sign-in is in the demo

- [ ] Google Cloud project + OAuth consent screen configured
- [ ] OAuth client ID + secret
- [ ] Authorized redirect URIs: dev (`http://localhost:3000/...`) and prod (`https://<domain>/...`)
- [ ] Backend env: the two `GOOGLE_*` vars (see environment-variables.md)
- [ ] Perform one real sign-in with a Google account

## E. Email (SMTP) — required for password reset / email notifications

- [ ] SMTP provider account (or transactional service) with verified sender domain
- [ ] Host/port/username/password/app-password
- [ ] Backend env: `EMAIL_PROVIDER=javamail` + SMTP host/port/user/pass + from address
- [ ] Trigger a real email (e.g. password reset) and confirm delivery

## F. File storage (Cloudflare R2) — required only for content file uploads in prod

- [ ] Cloudflare account + R2 bucket created
- [ ] Access key ID + secret + account ID
- [ ] Backend env: `STORAGE_PROVIDER=cloudflare_r2` + the R2 vars (see environment-variables.md)
- [ ] Upload one file via the app and confirm it is retrievable

## G. Infrastructure (not credentials, but must exist)

- [ ] PostgreSQL 16 instance + `DB_URL`/`DB_USER`/`DB_PASSWORD`
- [ ] Redis 7 instance
- [ ] Domain + TLS certificate (nginx/Let's Encrypt per `docs/production/DEPLOYMENT-CHECKLIST.md`)
- [ ] `JWT_SECRET` set once (rotating logs everyone out)
- [ ] `CORS_ALLOWED_ORIGINS` explicit (app refuses `*`)

## Not required for the current release

Cards/USD payments, payroll, marketplace, government integrations, advanced analytics —
deliberately deferred; no credentials needed.
