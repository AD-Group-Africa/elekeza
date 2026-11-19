# ENVIRONMENT VARIABLES

**Date:** 2026-11-19
**Sources of truth:** `.env.example` (root, 48 keys), `ai-elewa/.env.example` (7 keys), `backend/src/main/resources/application{,-prod}.yaml`, `frontend/next.config.ts`, `render.yaml`, `frontend/netlify.toml`.

> **No real values in this document.** Placeholders only. `.env.example` is tracked; `.env` is **not** tracked and must stay that way.

---

## 1. Backend — Render (`elekeza-backend`)

| Variable | Required | Placeholder | Notes |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | yes | `prod` | Must be `prod` in production |
| `PORT` | yes | `8080` | Render injects its own; keep 8080 |
| `DB_URL` | yes | `jdbc:postgresql://<host>:5432/elekeza` | Must include `jdbc:` prefix |
| `DB_USER` | yes | `<db-user>` | Least-privilege app user, not superuser |
| `DB_PASSWORD` | yes | `<db-password>` | Secret |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | yes | `validate` | **Never** `update`/`create` in prod — Flyway owns the schema |
| `DEMO_SEED_ENABLED` | yes | `FALSE` | `TRUE` only on a private demo host. Gates `V2__seed_demo.sql` |
| `JWT_SECRET` | yes | `<64-char-random>` | App fails to start if unset — intentional |
| `SECURE_COOKIES` | yes | `true` | Required with HTTPS |
| `AI_SERVICE_URL` | yes | `https://elekeza-ai.onrender.com` | Bare origin, **no** `/api` suffix |
| `AI_INTERNAL_SECRET` | yes | `<32-char-random>` | **Must equal** the AI service's `INTERNAL_SECRET` |
| `AI_CLIENT_TYPE` | yes | `real` | `real` or a mock client |
| `AI_TIMEOUT_SECONDS` | no | `120` | Lower only after measuring provider latency |
| `FRONTEND_URL` | yes | `https://<site>.netlify.app` | Used in links/redirects |
| `CORS_ALLOWED_ORIGINS` | yes | `https://<site>.netlify.app` | Exact origin, comma-separated, **no trailing slash** |
| `SMS_PROVIDER` | yes | `mock` | `mock` \| `africa_talking` |
| `EMAIL_PROVIDER` | yes | `mock` | `mock` \| `javamail` |
| `STORAGE_PROVIDER` | yes | `mock` | `mock` \| R2 |
| `MAIL_HOST` / `MAIL_PORT` | if email real | `smtp.example.com` / `587` | |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | if email real | `<user>` / `<password>` | Secret |
| `AFRICA_TALKING_API_KEY` | if SMS real | `<key>` | Secret |
| `AFRICA_TALKING_SENDER_ID` | if SMS real | `<sender>` | Must be approved |
| `MPESA_ENVIRONMENT` | if M-Pesa | `sandbox` | `sandbox` \| `production` |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | if M-Pesa | `<key>` / `<secret>` | Secret |
| `MPESA_PASSKEY` / `MPESA_SHORTCODE` | if M-Pesa | `<passkey>` / `<shortcode>` | Secret |
| `MPESA_CALLBACK_URL` | if M-Pesa | `https://<backend>/api/payments/mpesa/callback` | Must be public HTTPS |
| `CLOUDFLARE_R2_ACCOUNT_ID` | if storage real | `<account-id>` | |
| `CLOUDFLARE_R2_BUCKET_NAME` | if storage real | `<bucket>` | Private bucket |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | if storage real | `<id>` / `<secret>` | Secret |
| `R2_ENDPOINT` | if storage real | `https://<account>.r2.cloudflarestorage.com` | |
| `SENTRY_DSN_BACKEND` | **recommended** | `https://<key>@o0.ingest.sentry.io/<id>` | ⚠️ **No Sentry SDK is currently in `build.gradle.kts`** — the variable does nothing until the SDK is added |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | `<id>` / `<secret>` | Google OAuth not implemented in this tree |

---

## 2. AI service — Render (`elekeza-ai`)

| Variable | Required | Placeholder | Notes |
|---|---|---|---|
| `AI_PROVIDER` | yes | `groq` | `groq` \| `openai` \| `anthropic` \| `google`. Boot **fails** on an unsupported value |
| `AI_API_KEY` | yes | `<provider-key>` | Secret. Boot fails if empty (`config.py`) |
| `INTERNAL_SECRET` | yes | `<32-char-random>` | **Must equal** backend `AI_INTERNAL_SECRET` |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | no | `<key>` / `<secret>` | Leave empty to disable tracing |
| `LANGFUSE_HOST` | no | `https://cloud.langfuse.com` | |
| `TESSERACT_CMD` | no | `/usr/bin/tesseract` | Needed for OCR (`simplify_image`) |
| `PORT` | no | `8000` | The Dockerfile reads `${PORT:-8000}` |

⚠️ The AI service **must** run on an always-on paid instance. A free instance idles out; the resulting cold start exceeds the backend's `AI_TIMEOUT_SECONDS=120` and the tutor surfaces as broken.

---

## 3. Frontend — Netlify

| Variable | Required | Placeholder | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | `https://elekeza-backend.onrender.com` | **Bare origin, no `/api`.** `axios` uses `baseURL '/api'` and Next rewrites `/api/*` → `${NEXT_PUBLIC_API_URL}/api/*`; an `/api` suffix double-prefixes. Baked at **build** time — changing it requires a rebuild |
| `NEXT_PUBLIC_SENTRY_DSN` | recommended | `https://<key>@o0.ingest.sentry.io/<id>` | Public by design |
| `CAPACITOR_SERVER_URL` | Android only | `https://<site>.netlify.app` | Build-time; without it the APK serves bundled `out/` |

---

## 4. Local development

| File | Purpose | Tracked? |
|---|---|---|
| `.env` (root) | Compose/local stack values | ❌ **gitignored** |
| `backend/.env` | Backend local values | ❌ gitignored |
| `ai-elewa/.env` | AI local values (incl. `INTERNAL_SECRET`) | ❌ gitignored |
| `.env.example`, `ai-elewa/.env.example` | Templates | ✅ tracked |

`backend/restart-local.sh` is the documented local contract: it maps `SECURITY_JWT_SECRET` → `JWT_SECRET`, `DB_URL` → local Postgres, `AI_SERVICE_URL` → 8001 and sources `AI_INTERNAL_SECRET` from `ai-elewa/.env`.

> ⚠️ `ai-elewa/.env` is also loaded by `tests/conftest.py`, which is why the AI edge-case suite reports 31 false 401 failures when the server is booted with a different secret. Pin `INTERNAL_SECRET` explicitly when running tests.

---

## 5. Secret-handling rules (non-negotiable)

1. Never commit `.env`, keystores, DSNs or provider keys.
2. Never print a secret into a log, report, terminal transcript or chat.
3. `frontend/android/elekeza.keystore` is present on disk and **correctly gitignored** (`.gitignore` lines 34–35). Keep it that way; back it up offline — losing it blocks Play Store updates.
4. Rotate `JWT_SECRET` only with a planned session invalidation (all users sign out).
5. `AI_INTERNAL_SECRET` is the only thing protecting the AI service from the internet. Treat it as a production credential, not a dev convenience.
