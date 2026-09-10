# Elekeza — Integration Matrix

Verified against the actual codebase and live services on 2026-09-08 (branch `release/v0.1.0`).
Statuses are evidence-based, not aspirational.

| Integration | Purpose | Code Status | Credentials Needed | Environment | Test Method | Status |
|---|---|---|---|---|---|---|
| **AI Provider (Groq)** | 4-stage lesson simplification + quiz generation | Implemented — `ai-elewa` FastAPI (4-stage pipeline, retry-with-correction, learner-safe errors) + backend `RealAiClient`/`MockAiClient` | `AI_API_KEY` (Groq) — **both stored keys return 401 Invalid API Key** | `ai-elewa/.env` | Direct `POST /ai/simplify/text` with valid `X-Internal-Key` → reached stage2, retried, failed honestly with `SCHEMA_INVALID` + learner message | **IMPLEMENTED + CREDENTIALS REQUIRED** (pipeline verified to the provider boundary) |
| **AI internal auth** | Backend↔ai-elewa service auth | Implemented (`X-Internal-Key` header, verified both sides) | `AI_INTERNAL_SECRET` (backend) must equal `INTERNAL_SECRET` (ai-elewa) | both `.env` files | Live call from backend reached the pipeline (log evidence) | **IMPLEMENTED + VERIFIED** (mechanism; secret must be set consistently in deployment) |
| **M-Pesa (Daraja)** | Fee payments | Implemented — single `mpesa_transactions` ledger, callback CSRF-exempt + authenticated, idempotent by transaction reference, status/reconciliation endpoint | Daraja consumer key/secret, shortcode, passkey, public HTTPS callback URL | backend env | Negative probes: forged callback safely rejected (`ResultCode: 1`); no live transaction possible without credentials | **IMPLEMENTED + CREDENTIALS REQUIRED** (sandbox) |
| **Africa's Talking** | SMS notifications | Implemented behind `SMS_PROVIDER=africa_talking` toggle | Account, API key, sender ID | backend env | Code path reviewed; failure handling present; not exercised live | **IMPLEMENTED + CONFIGURATION REQUIRED** |
| **Email (SMTP)** | Notifications/verification | Implemented behind `EMAIL_PROVIDER=javamail` toggle | SMTP host/port/user/pass, verified sender | backend env | Code path reviewed; not exercised live | **IMPLEMENTED + CONFIGURATION REQUIRED** |
| **Google OAuth** | Sign-in | Implemented behind toggle | OAuth client ID + secret, redirect URIs | backend env | Not exercised live | **IMPLEMENTED + CONFIGURATION REQUIRED** |
| **PostgreSQL** | Primary datastore (prod) | Implemented — Flyway V1→V9, `ddl-auto=validate` in prod | Connection URL + credentials | `DB_URL`, `DB_USER`, `DB_PASSWORD` | H2-compatible dev; migrations verified in test suite | **IMPLEMENTED — production DB must be provisioned** |
| **Redis** | Rate limiting / sessions | Implemented | Host/port/password | backend env | Login rate limiter is in-process (single instance) | **IMPLEMENTED — production Redis must be provisioned** |
| **File/Object storage (R2)** | Content assets | Implemented behind `STORAGE_PROVIDER=cloudflare_r2` toggle | Account ID, access key, secret, bucket | backend env | Not exercised live | **IMPLEMENTED + CONFIGURATION REQUIRED** |
| **H2 (dev database)** | Local/test datastore | Implemented | none | dev profile | Full backend suite + live journeys run on it | **WORKING (dev only)** |

## AI status detail (evidence, 2026-09-08)

- `ai-elewa` runs locally on :8000 — `GET /health` → `{"status":"ok"}`, provider `groq`, stage2 `llama-3.3-70b-versatile`, stage3 `llama-3.1-8b-instant`.
- A deployed instance exists at `https://elekeza-ai.onrender.com` — `/health` → `{"status":"ok"}` (cold-start tolerant), and it **rejects the local internal secret** (correct isolation).
- Full chain proof: teacher `POST /api/content/upload/text` → backend `RealAiClient` → ai-elewa (internal auth accepted, stage2 executed, retry-on-schema-invalid honored) → Groq → **401 Invalid API Key** → ai-elewa returned structured `SCHEMA_INVALID` with `learner_message: "Something went wrong. Please try again."` → backend stored content as-is with an honest message. No fake success at any layer.
- The mock client (`AI_CLIENT_TYPE=mock`) is clearly labeled in responses ("Mock Lesson", explicit "AI service not enabled" messages) — it cannot be mistaken for real AI output.
- **A valid Groq API key is the single missing credential for the working AI pathway.**

## Honesty rules embedded in the code

- No fallback makes a broken AI look healthy: mock mode returns clearly-labeled mock content; real mode surfaces the true failure.
- The deployed ai-elewa does not accept the local dev secret — environments are isolated.
- Payment callbacks are authenticated and idempotent; forged callbacks are rejected.
