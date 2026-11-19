# INTEGRATION REGISTER

**Date:** 2026-11-19
**Rule applied:** an integration is "operational" only if it has been exercised end-to-end in this session. **None were.** Everything below is classified from source code plus configuration, never from assumption.

**Legend:** ✅ operational (verified live) · 🟡 implemented, unverified · 🟠 mock only · ⛔ not implemented · 🔒 blocked by credentials

> No secret values appear in this document. Where a credential is missing it is named, not quoted.

---

## 1. Register

| # | Integration | Current implementation | Credentials | Env vars | Sandbox | Production | Webhook | Security requirement | Tests | Blocker | Owner | Est. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Daraja / M-Pesa** | Real adapter: `finance/MpesaGateway.kt`, `payments/MpesaController.kt`, `finance/MpesaPaymentListener.kt`; integrity hardened in `V18__payment_integrity.sql` | 🔒 **missing** | `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL` | 🟠 unverified | ⛔ | `POST` callback → `MpesaPaymentListener`; must verify signature + idempotency | Callback must be verified server-side; replay-safe; no client-trusted amounts | Backend payment-security suite passes; **no sandbox STK push executed** | Daraja app + passkey; public HTTPS callback URL | Harrison | 2–3 d |
| 2 | **Africa's Talking (SMS)** | `common/AfricaTalkingSmsProvider.kt`; selected by `sms.provider=africa_talking` | 🔒 missing | `SMS_PROVIDER`, `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` | 🟠 unverified | ⛔ | n/a (outbound) | Sender ID approval; no learner PII in message bodies | Provider falls back to mock; **no real SMS sent** | Account + approved sender ID | Harrison | 4 h |
| 3 | **Africa's Talking (USSD)** | ⛔ **not implemented** — no USSD handler exists | — | — | ⛔ | ⛔ | needs USSD callback | Session state, rate limiting | none | Out of scope for 30 Nov unless specified | — | — |
| 4 | **Twilio / WhatsApp** | ⛔ **not implemented** — no Twilio SDK or webhook in the codebase | — | — | ⛔ | ⛔ | — | — | none | Explicitly out of scope; SMS via Africa's Talking covers launch | — | — |
| 5 | **AI provider (Groq)** | Real client `ai-elewa/ai_client.py`; 4 providers in `config.py` (`groq`, `openai`, `anthropic`, `google`); per-stage model map; 2-stage pipeline | 🔒 **missing live key** | `AI_PROVIDER`, `AI_API_KEY` | 🟡 dummy-key tests only | ⛔ | n/a | Internal `X-Internal-Key` between backend and AI service | 603 tests pass **without** a real provider | A real API key for one `live_full` run | Harrison | 30 m |
| 6 | **AI provider fallback** | Provider chosen at import time (`config.py` raises on missing key); model fallback inside pipeline | — | — | 🟡 | ⛔ | n/a | Timeout 120 s, retry policy in pipeline | Unit-level only | Confirm fallback behaviour with two providers | Eng | 4 h |
| 7 | **Text-to-speech** | **Browser-native Web Speech API** — `frontend/src/hooks/useTextToSpeech.ts` (`SpeechSynthesisUtterance`). **No server TTS provider.** | none needed | none | 🟡 | 🟡 | n/a | None (no audio leaves the device) | Not covered by automated tests | Voice availability varies by browser/OS; Kiswahili voices are inconsistent on desktop | Eng | 2 h QA |
| 8 | **Image / media storage** | `common/CloudflareR2Provider.kt` + `MockStorageProvider.kt`; `STORAGE_PROVIDER` selector; V15 devices/regions | 🔒 missing | `STORAGE_PROVIDER`, `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` | 🟠 mock | ⛔ | n/a | Bucket private; presigned URLs; per-tenant prefixes; never public learner images | Backend tests cover the mock provider | R2 bucket + API token | Harrison | 1 d |
| 9 | **Sentry** | **Frontend only**: `frontend/sentry.client.config.ts`, `sentry.server.config.ts`. **Backend has no Sentry SDK** (`build.gradle.kts` has none). **AI service has none** (`requirements.txt` has none). | 🔒 missing DSNs | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN_BACKEND`, `SENTRY_DSN_AI` | 🟠 | ⛔ | n/a | PII scrubbing; no learner names in events | none | **Two of three services are blind in production** | Eng | 0.5 d |
| 10 | **Langfuse (AI observability)** | `ai-elewa/langfuse_client.py`; logs a **contradictory** pair: "Authentication error … client disabled" then "✅ connected" | 🔒 missing keys | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | 🟠 | ⛔ | n/a | Prompts may contain learner text — scrub before storage | Startup log only | Keys + fix the false-success log | Eng | 2 h |
| 11 | **Email / SMTP** | `common/JavaMailEmailProvider.kt`; `email.provider=mock\|javamail`; `spring-boot-starter-mail` | 🔒 missing | `EMAIL_PROVIDER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | 🟠 mock | ⛔ | n/a | SPF/DKIM; no passwords in body; rate limits for password reset | Mock provider covered | SMTP provider + verified sending domain | Harrison | 4 h |
| 12 | **PostgreSQL** | Prod profile: `${DB_URL}`, `ddl-auto=validate`, Flyway V1–V21 | 🔒 prod instance missing | `DB_URL`, `DB_USER`, `DB_PASSWORD` | 🟡 H2 in tests | ⛔ | n/a | TLS to DB; least-privilege user; no superuser app account | Migrations apply in tests; **not re-run on PG16 today** | Provisioned DB + migration run | Harrison | 4 h |
| 13 | **DNS / TLS** | Netlify + Render issue certificates automatically; `infrastructure/nginx/` + `docker-compose.tls.yml` exist for a self-hosted path (unused in the Render/Netlify topology) | 🔒 domain access | `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_URL` | — | ⛔ | n/a | CORS allowlist must be the exact origin; `SECURE_COOKIES=true` | none | Domain + DNS control | Harrison | 2 h |
| 14 | **Google OAuth** | Referenced in env template (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | 🔒 missing | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ⛔ | ⛔ | OAuth redirect URI | Exact redirect allowlist | not implemented in this tree | Defer; password auth is complete | — | — |

---

## 2. What must be true on 30 November

**Critical (blocks launch):** #1 or an explicit "fees read-only" decision · #5 (one real AI run) · #9 (at least backend error reporting) · #12 (production DB + migrations) · #13 (domain + CORS).

**Important (launch with mock, disclose it):** #2 SMS (mock = no SMS delivered — guardian notifications silently do nothing) · #8 storage · #11 email (password reset will not deliver).

**Defer past launch:** #3 USSD · #4 Twilio/WhatsApp · #6 multi-provider fallback · #14 Google OAuth.

---

## 3. Honest classification of "mock" adapters

The backend defaults every provider to **mock**: `SMS_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, `STORAGE_PROVIDER=mock`. This is a good safety default (the app boots without credentials), **but it means a green test suite says nothing about delivery.** If launch happens on mocks:

- No SMS is sent to guardians. The UI must not claim "message sent".
- No password-reset email is delivered. Disable or relabel the reset link.
- Uploads either fail or write locally. Verify the upload path before demoing it.

**Never present a mock integration as working in a demo or a release note.**

---

## 4. Credential checklist (exact, no values)

| Service | Values needed | Where they go |
|---|---|---|
| Daraja | Consumer key, consumer secret, passkey, shortcode, public HTTPS callback URL, environment | Render → `elekeza-backend` → Environment |
| Africa's Talking | API key, approved sender ID | same |
| Groq (or other) | API key | Render → `elekeza-ai` (`AI_API_KEY`) **and** the backend does **not** need it |
| Shared secret | One random 32+ char string | **Identical** in backend `AI_INTERNAL_SECRET` and AI `INTERNAL_SECRET` |
| JWT | One random 48+ char string | Backend `JWT_SECRET` only |
| PostgreSQL | URL, user, password | Backend `DB_URL`/`DB_USER`/`DB_PASSWORD` |
| Sentry | 3 DSNs (frontend, backend, AI) | Netlify env + both Render services |
| Langfuse | Public key, secret key, host | AI service |
| Cloudflare R2 | Account ID, bucket, access key, secret, endpoint | Backend |
| SMTP | Host, port, username, password | Backend |
| Netlify/Render | Domain + DNS access | Platform dashboards |

**Rule:** secrets are entered in the platform dashboards. They are never committed, never pasted into chat, and never printed into logs.
