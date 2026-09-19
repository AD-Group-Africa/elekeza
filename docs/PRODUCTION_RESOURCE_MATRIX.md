# Elekeza — Production Resource Matrix

| Service | Purpose | Code Status | Account Required | Credential Required | Monthly Cost | Blocker | Setup |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **PostgreSQL** | Primary database | ✅ Code complete | REQUIRED | REQUIRED | $20-50+ (managed) | None | Create DB, set user/pw |
| **Redis** | Caching / sessions | ✅ Code complete | OPTIONAL | OPTIONAL | $15-30+ (managed) | None | Optional config |
| **Groq (AI)** | Text/quiz generation | ✅ Provider abstraction | REQUIRED | REQUIRED | $20-100+ (depends on model) | Groq API key | Obtain from console |
| **M-Pesa** | STK Push payments | ✅ Code complete | REQUIRED | REQUIRED | Free (API calls) | Consumer key/secret/passcode/shortcode | Daraja developer portal |
| **Africa's Talking (SMS)** | SMS notifications | ✅ Provider abstraction + mock | REQUIRED | REQUIRED | $0.02-0.05 per SMS | API key | Dashboard |
| **Email (Resend/Postmark/SES)** | Verification / receipts / notifications | ✅ Provider abstraction + mock | REQUIRED | REQUIRED | $10-30+ (depends on volume) | API key + domain verification | Provider console |
| **Cloudflare R2** | File uploads / downloads | ✅ Code complete | REQUIRED | REQUIRED | $5-20+ (per GB storage + requests) | Access key / secret | Cloudflare dashboard |
| **Sentry** | Error tracking | ✅ Optional | OPTIONAL | OPTIONAL | $26+ (Free tier available) | `SENTRY_DSN_BACKEND` | Sentry account |
| **Langfuse** | AI tracing / observability | ⚠️ Future | OPTIONAL | OPTIONAL | $0-20+ (Free tier available) | `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Langfuse account |
| **Render** | Hosting / deployment | ✅ CI/CD pipeline | REQUIRED | REQUIRED | $7-20+ (Free tier available) | `AI_CLIENT_TYPE` env var | Render dashboard |

---

## Key

- **Code Status**: ✅ = code is complete and compiles; ⚠️ = future work; ⬜ = not started
- **Account Required**: Whether a human must create an account at the service provider
- **Credential Required**: Whether API keys / secrets must be obtained and configured
- **Monthly Cost**: Estimated range; `Free` = free tier available; `Included` = part of another service
- **Blocker**: The single item that must be resolved before production. If blank, no code blocker exists.
- **Setup**: Brief note on what the human needs to do.

---

## Notes

- The `AI_CLIENT_TYPE=mock` setting allows the app to deploy and function without a Groq account. AI features will use mock responses.
- M-Pesa, SMS, Email, and R2 all have **code complete** but **credentials required** — the app gracefully degrades when credentials are absent (mock modes, clear 503 errors, DB-only operation).
- Only PostgreSQL is absolutely required with no optional fallback. All other services can be added incrementally.
- The CI/CD pipeline (`.gitlab-ci.yml`) is code-complete and will build and test on every commit.