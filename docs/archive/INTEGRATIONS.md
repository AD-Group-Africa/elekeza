# ELEKEZA — INTEGRATIONS

> Canonical integration matrix. Statuses are evidence-based. Full per-integration detail:
> `ELEKEZA_INTEGRATION_MATRIX.md` (release-evidence copy).

## Matrix

| Integration | Purpose | Status | Environment | Credential required | Configuration required | Test status | Failure behaviour | Production blocker? |
|---|---|---|---|---|---|---|---|---|
| **PostgreSQL** | primary datastore | **CONNECTED+VERIFIED** | local :5433 scratch / prod PG 15/16 | `DB_URL/DB_USER/DB_PASSWORD` | Flyway auto-runs | 278/278 suite on it; restore drill PASSED; zero orphans/dupes | boot fails fast if unreachable | no (provisioning is standard ops) |
| **Authentication (JWT/refresh)** | identity | **CONNECTED+VERIFIED** | all | `JWT_SECRET` | — | 401 matrix, rotation/reuse tests | 401 AUTH_REQUIRED | no |
| **ai-elewa (internal AI service)** | adaptation/tutor | **CONNECTED+VERIFIED (mechanism)** / **P0 auth gap** | :8001 local / :8000 compose | `AI_INTERNAL_SECRET`↔`INTERNAL_SECRET` | `AI_SERVICE_URL` | chain proof reached pipeline; AI-degradation journey 6/6 | honest degradation; raw-text fallback | **P0 fail-open fix (AI r3) required** |
| **Groq / LLM provider** | real AI | **CODE VERIFIED / BLOCKED: key** | ai-elewa env | `AI_API_KEY` | `AI_PROVIDER=groq` | provider boundary verified; real key 401'd honestly (2026-09-08 chain proof) | structured `SCHEMA_INVALID` + learner-safe message | **YES for real AI** |
| **M-Pesa (Daraja)** | fee collection | **CODE VERIFIED (hardened) / BLOCKED: credentials** | backend env | consumer key/secret, passkey, shortcode, public HTTPS callback | `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_URL` | 12 tests + forged/replay negative probes; never live | STK → 503 honest; callback state machine rejects bad payloads | **YES for real collections** (conditional for pilot) |
| **Email (SMTP)** | invites, resets, notifications | **CODE VERIFIED / BLOCKED: SMTP** | backend env | `MAIL_HOST/PORT/USERNAME/PASSWORD` | `EMAIL_PROVIDER=javamail` | code path reviewed; mock used in all verified runs | mock provider logs only; mail health indicator disabled in docker profile so unconfigured SMTP can't mark platform DOWN | **YES for real email** (pilot can run on in-app credentials surfaced to school) |
| **Africa's Talking (SMS)** | guardian SMS | **CODE VERIFIED / BLOCKED: key** | backend env | `AFRICA_TALKING_API_KEY/SENDER_ID` | `SMS_PROVIDER=africa_talking` | code reviewed; failure caught, fire-and-forget | DB notification always written; SMS skipped | no (optional) |
| **Cloudflare R2 (storage)** | persistent uploads | **CODE VERIFIED / BLOCKED: keys** | backend env | `CLOUDFLARE_R2_*` | `STORAGE_PROVIDER=cloudflare_r2` | not exercised live | mock = container-local ephemeral | no for throwaway pilot; YES for durable uploads |
| **Redis** | cache / limiter backing | **PROVISIONED, UNUSED** | compose | `REDIS_PASSWORD` | — | n/a | n/a — backend rate limiting is in-process | no |
| **Docker/Compose** | deployment topology | **VERIFIED (dry-run)** | host | — | `.env` | 6/6 healthy, TLS path verified | — | host provisioning external |
| **DNS / TLS** | public exposure | **BLOCKED: domain/host** | ops | domain, certbot | `NGINX_DOMAIN`, `TLS_CERT_HOST_DIR` | render+renewal procedure dry-run verified | nginx fail-fast on missing domain template var | **YES for production** |
| **Google OAuth** | social login | **ABSENT (obsolete)** | — | — | — | legacy comment only | n/a | no — do not claim |

## Honest-rules embedded in code

- Mock providers are **clearly labelled** (email.provider/sms.provider/storage.provider
  `${X:mock}`; UI reports “Test mode / not configured” states).
- No integration failure can make learning unavailable (abstraction + deterministic fallbacks).
- No integration is reported successful without evidence; activation checklists:
  [TESTING_CREDENTIALS_CHECKLIST content merged here below](#activation-checklists).

## Activation checklists (external credentials)

**Groq (AI):** obtain key → `ai-elewa/.env AI_API_KEY` (+ deployed env) → `AI_PROVIDER=groq` →
re-run chain proof (teacher upload → `adapted:true`) → note budget/limits. **Do this only after the
AI r3 P0 fix ships** (internal-secret fail-open).

**Daraja (M-Pesa):** sandbox first → consumer key/secret, shortcode (own paybill/till, not 174379),
passkey → `MPESA_ENVIRONMENT` + `MPESA_CALLBACK_URL` (public HTTPS) → 10-step verification
(STK push → callback → ledger row → idempotent replay → wrong-amount rejection → reconciliation).

**SMTP:** provider account + verified sender → `EMAIL_PROVIDER=javamail` + `MAIL_*` → trigger one
real reset email.

**Africa's Talking:** key + sender ID → `SMS_PROVIDER=africa_talking` → send one test SMS.

**R2:** bucket + keys → `STORAGE_PROVIDER=cloudflare_r2` → upload+download round-trip.
