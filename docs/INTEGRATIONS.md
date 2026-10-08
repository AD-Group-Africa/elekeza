# ELEKEZA — INTEGRATIONS

> Canonical integration matrix. Verified live 2026-10-02; **re-verified 2026-10-05** (fresh-DB
> migration probe 16/16 + live auth 401 probes + fail-closed AI matrix).
> "Tested" = evidence exists from this engagement (probe/journey/DB row).
> "No secrets committed" verified: runtime creds live only in `backend/.env` / `ai-elewa/.env` /
> compose `.env` (gitignored).

## 1. Provider matrix

| Integration | Status | Credential | Callback | Tested | Production ready |
|---|---|---|---|---|---|
| **Database** (PostgreSQL, Flyway V1–V16) | **FUNCTIONAL** | DB_USER/DB_PASSWORD in backend/.env (not committed) | n/a | ✅ live queries, migrations, persistence rows, backup+restore drill; **fresh-DB boot 2026-10-05: 16/16 migrations success, `ddl-auto=validate` PASS, health UP** | ✅ (host managed at pilot) |
| **AI** (ai-elewa → Groq, `AI_API_KEY`) | **FUNCTIONAL** (mock provider available but `real` default) | `AI_API_KEY` in ai-elewa/.env (not committed); internal handshake `INTERNAL_SECRET`/`X-Internal-Key` | n/a (backend→AI internal) | ✅ tutor/adaptive/simplify live 200s; AI-down + invalid-key degradation; retries (Retry-After honored); no secrets in browser; **P0 fail-open FIXED + live-verified fail-closed both directions (unset → 401 incl. `/docs`; valid key passes)** | ⚠️ code-ready; remaining: r3 ship authorization + real Groq key |
| **M-Pesa / Daraja** | **PARTIAL — mock gateway** | none at runtime; compose slots `MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE/CALLBACK_URL` (empty by default) | `/api/payments/callback` — public by design, Safaricom ack shape, idempotent (checkoutRequestId key), amount-mismatch + replay rejected (verified in code + probes) | ✅ full initiate→STK(mock)→callback→payment chain, duplicate + tamper cases | ❌ needs real Daraja creds + `FEES_MPESA_MODE=live` + edge signature verification |
| **Email (SMTP)** | **NOT CONFIGURED** (wired-inert `JavaMailEmailProvider`; `EMAIL_PROVIDER=mock`) | none at runtime; compose `MAIL_*` slots exist | n/a | in-app notification persistence ✅; delivery ❌ (no provider) | ❌ needs MAIL_* creds |
| **SMS (Africa's Talking)** | **NOT CONFIGURED** (wired-inert `AfricaTalkingSmsProvider`; `SMS_PROVIDER=mock`) | none at runtime; compose `AFRICA_TALKING_*` slots exist | n/a | in-app ✅; delivery ❌ | ❌ needs API key + sender ID |
| **Safiri (transport/safety)** | **NOT IMPLEMENTED** | n/a | n/a | ❌ module does not exist (verified repo-wide) | ❌ build-or-descope decision required (out of Elekeza scope) |
| **Storage** | **LOCAL DISK functional**; external (R2) not configured | `CLOUDFLARE_R2_*` compose slots exist (empty) | n/a | ✅ content upload → READY | ⚠️ local-disk only for pilot; R2 post-pilot or with creds |
| **Redis** | **NOT USED** at runtime (template in compose) | `REDIS_PASSWORD` slot | n/a | n/a (not required for pilot) | ✅ optional |
| **Google OAuth** | **NOT CONFIGURED** (dead config; no flow in code) | `GOOGLE_CLIENT_ID/SECRET` slots | n/a | ❌ | ❌ implement-or-remove decision |
| **Observability** (Langfuse/Sentry) | **NOT CONFIGURED** | slots exist; Langfuse self-disables without keys (verified in boot log) | n/a | ❌ | ❌ needs DSNs (pilot-optional) |

## 2. Notification provider test results (in-app channel)

| Notification | Generated | Recipient correct | Provider delivery |
|---|---|---|---|
| Welcome (onboarding) | ✅ on register/onboarding (notifications table) | learner self | mock only |
| Attendance marked | ✅ (notification rows on session save) | learner/guardian (in-app) | mock only |
| Quiz/progress | ✅ (progress/gamification events) | learner/guardian | mock only |
| Guardian message | ✅ but **sender-addressed only (EL-NEW-02)** | ❌ counterpart never receives | mock only |
| Safiri boarding/arrival | ❌ no Safiri module | — | — |
| Password reset | ✅ token persisted (`password_reset_tokens`); **no email sent** (enumeration-safe responses verified) | n/a until SMTP | ❌ |
| Queue/retry | in-app writes synchronous + audit-logged; provider queue/retry exists in provider interfaces but inert without creds | — | mock only |

**External integrations pending activation:** Groq production key (AI), Daraja (M-Pesa), SMTP
(email), Africa's Talking (SMS), Cloudflare R2 (storage). All adapters are implemented, mocked
honestly, and configuration-activated — no code work is blocked on them.

## 3. Key corrections vs earlier notes

- AI service reads `AI_PROVIDER` / `AI_API_KEY` / `INTERNAL_SECRET` from `ai-elewa/.env` (config.py)
  — `GROQ_API_KEY` in `backend/.env` is a separate backend-side value.
- **P0 RESOLVED (2026-10-03):** `ai-elewa/security.py` previously failed OPEN when `INTERNAL_SECRET`
  was unset. Now fail-closed (`key_valid = bool(INTERNAL_SECRET) and hmac.compare_digest(...)`) and
  live-verified in both directions. The backend-side `dev-secret` fallbacks
  (`RealAiClient.kt`, `AiWebClientConfig.kt`) were **removed** — boot fails fast without config.
  Shipping the fix is an r3 release authorization, not a code task.
