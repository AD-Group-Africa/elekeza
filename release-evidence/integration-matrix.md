# ELEKEZA INTEGRATION MATRIX

Verified live 2026-10-02. "Tested" = evidence exists from this engagement (probe/journey/DB row).
"No secrets committed" verified: runtime creds live only in `backend/.env` / `ai-elewa/.env` / compose `.env` (gitignored).

| Integration | Status | Credential | Callback | Tested | Production Ready |
|---|---|---|---|---|---|
| **Database** (PostgreSQL, Flyway V1–V16) | **FUNCTIONAL** | DB_USER/DB_PASSWORD in backend/.env (not committed) | n/a | ✅ live queries, migrations, persistence rows, backup+restore drill | ✅ (host managed at pilot) |
| **AI** (ai-elewa → Groq, `AI_API_KEY`) | **FUNCTIONAL** (mock provider available but `real` default) | `AI_API_KEY` in ai-elewa/.env (not committed); internal handshake `INTERNAL_SECRET`/`X-Internal-Key` | n/a (backend→AI internal) | ✅ tutor/adaptive/simplify live 200s; AI-down + invalid-key degradation; retries (Retry-After honored); no secrets in browser | ⚠️ code-ready; **P0**: `INTERNAL_SECRET` empty ⇒ fail-open (frozen r2) — needs r3 |
| **M-Pesa / Daraja** | **PARTIAL — mock gateway** | none at runtime; compose slots `MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE/CALLBACK_URL` (empty by default) | `/api/payments/callback` — public by design, Safaricom ack shape, idempotent (checkoutRequestId key), amount-mismatch + replay rejected (verified in code + probes) | ✅ full initiate→STK(mock)→callback→payment chain, duplicate + tamper cases | ❌ needs real Daraja creds + `FEES_MPESA_MODE=live` + edge signature verification |
| **Email (SMTP)** | **NOT CONFIGURED** (wired-inert `JavaMailEmailProvider`; `EMAIL_PROVIDER=mock`) | none at runtime; compose `MAIL_*` slots exist | n/a | in-app notification persistence ✅; delivery ❌ (no provider) | ❌ needs MAIL_* creds |
| **SMS (Africa's Talking)** | **NOT CONFIGURED** (wired-inert `AfricaTalkingSmsProvider`; `SMS_PROVIDER=mock`) | none at runtime; compose `AFRICA_TALKING_*` slots exist | n/a | in-app ✅; delivery ❌ | ❌ needs API key + sender ID |
| **Safiri (transport/safety)** | **NOT IMPLEMENTED** | n/a | n/a | ❌ module does not exist (verified repo-wide) | ❌ build-or-descope decision required |
| **Storage** | **LOCAL DISK functional**; external (R2) not configured | `CLOUDFLARE_R2_*` compose slots exist (empty) | n/a | ✅ content upload → READY (id=6) | ⚠️ local-disk only for pilot; R2 post-pilot or with creds |
| **Redis** | **NOT USED** at runtime (template in compose) | `REDIS_PASSWORD` slot | n/a | n/a (not required for pilot) | ✅ optional |
| **Google OAuth** | **NOT CONFIGURED** (dead config; no flow in code) | `GOOGLE_CLIENT_ID/SECRET` slots | n/a | ❌ | ❌ implement-or-remove decision |
| **Observability** (Langfuse/Sentry) | **NOT CONFIGURED** | slots exist; Langfuse self-disables without keys (verified in boot log) | n/a | ❌ | ❌ needs DSNs (pilot-optional) |

## Notification provider test results (in-app channel)

| Notification | Generated | Recipient correct | Provider delivery |
|---|---|---|---|
| Welcome (onboarding) | ✅ on register/onboarding (notifications table) | learner self | mock only |
| Attendance marked | ✅ (notification rows on session save) | learner/guardian (in-app) | mock only |
| Quiz/progress | ✅ (progress/gamification events) | learner/guardian | mock only |
| Guardian message | ✅ but **sender-addressed only** (EL-NEW-02) | ❌ counterpart never receives | mock only |
| Safiri boarding/arrival | ❌ no Safiri module | — | — |
| Password reset | ✅ token persisted (`password_reset_tokens`); **no email sent** (enumeration-safe responses verified) | n/a until SMTP | ❌ |
| Queue/retry | in-app writes synchronous + audit-logged; provider queue/retry exists in provider interfaces but inert without creds | — | mock only |

## Key correction vs earlier notes

- AI service reads `AI_PROVIDER` / `AI_API_KEY` / `INTERNAL_SECRET` from `ai-elewa/.env` (config.py) — `GROQ_API_KEY` in `backend/.env` is a separate backend-side value.
- **P0 security finding (live-verified):** `ai-elewa/security.py` fails OPEN when `INTERNAL_SECRET` is unset (scratch instance: no-key POST → 422 schema error, not 401). Frozen release r2 must be superseded (r3) before any internet-facing deployment. Backend `dev-secret` fallback (`RealAiClient.kt:18`, `AiWebClientConfig.kt:15`) should also be removed (P2 hardening).
