# Elekeza — Human Setup Checklist

This checklist contains ONLY actions the human operator must perform. Every item says: `REQUIRED / OPTIONAL / NOT NEEDED`.

## 1. Domain

| Item | Status | Notes |
|------|--------|-------|
| Elekeza account (GitLab) | REQUIRED | Create at GitLab, add team members |
| DNS domain | OPTIONAL | Configure if using custom domain |
| Domain verification (Let's Encrypt) | OPTIONAL | Required for HTTPS in production |

## 2. Database

| Item | Status | Notes |
|------|--------|-------|
| PostgreSQL database | REQUIRED | Create `elekeza_prod` database |
| Database user | REQUIRED | Create restricted user (no superuser) |
| Database password | REQUIRED | Set in `DB_PASSWORD` env var |
| Flyway migration baseline | REQUIRED | Run `./gradlew flywayBaseline` on fresh DB |
| Connection pooling | OPTIONAL | HikariCP configured in `application.yml` |

## 3. Redis

| Item | Status | Notes |
|------|--------|-------|
| Redis instance | OPTIONAL | Caching/sessions — `application.yml` has defaults |
| Redis password | OPTIONAL | Set `REDIS_PASSWORD` env var |
| Redis persistence | OPTIONAL | `allkeys-lru` policy configured |

## 4. AI

| Item | Status | Notes |
|------|--------|-------|
| Groq account | REQUIRED | Obtain from [Groq Console](https://console.groq.com/) |
| Groq API key | REQUIRED | Store as `GROQ_API_KEY` or `AI_API_KEY` |
| AI internal secret | REQUIRED | Python service auth — store as `AI_INTERNAL_SECRET` |
| AI model | OPTIONAL | e.g., `mixtral-8x7b-32768` or `llama3-8b-8192` |
| `ai.client.type` | REQUIRED | Set to `real` (with Groq) or `mock` (offline) |

## 5. M-Pesa

| Item | Status | Notes |
|------|--------|-------|
| Daraja (Safaricom) account | REQUIRED | Register at developer.safaricom.co.ke |
| Consumer key | REQUIRED | From Daraja dashboard |
| Consumer secret | REQUIRED | From Daraja dashboard |
| Passkey | REQUIRED | From Daraja dashboard |
| Shortcode | REQUIRED | Assigned Till/Paybill number |
| Environment | REQUIRED | `sandbox` (testing) or `production` |
| Callback URL | REQUIRED | `https://your-domain.com/api/payments/callback` |

## 6. SMS (Africa's Talking)

| Item | Status | Notes |
|------|--------|-------|
| Africa's Talking account | REQUIRED | Register at https://accreditor.africastalking.com |
| API key | REQUIRED | From dashboard |
| Sender ID | OPTIONAL | Default: `DefaultSender` |

## 7. Email

| Item | Status | Notes |
|------|--------|-------|
| Email provider | REQUIRED | Recommended: Resend, Postmark, SendGrid, or Amazon SES |
| SMTP settings | REQUIRED | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` |
| Domain verification (SPF/DKIM/DMARC) | REQUIRED | For deliverability |
| `MAIL_HOST` / `MAIL_PORT` | REQUIRED | e.g., `smtp.resend.com`, `587` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | REQUIRED | From provider |
| Email templates | OPTIONAL | Verification, password reset, school invitation, payment receipt, guardian notification |

## 8. Storage (Cloudflare R2)

| Item | Status | Notes |
|------|--------|-------|
| Cloudflare account | REQUIRED | Create Cloudflare account |
| R2 bucket | REQUIRED | Create bucket `elekeza-uploads` (or similar) |
| Access key | REQUIRED | From Cloudflare R2 dashboard |
| Secret key | REQUIRED | From Cloudflare R2 dashboard |
| Endpoint | REQUIRED | `https://<account>.r2.cloudflarestorage.com` |

## 9. Monitoring

| Item | Status | Notes |
|------|--------|-------|
| Sentry | OPTIONAL | Error tracking — set `SENTRY_DSN_BACKEND` |
| Langfuse | OPTIONAL | AI tracing and monitoring |
| Health check endpoint | REQUIRED | `/actuator/health` must work |

## 10. Deployment

| Item | Status | Notes |
|------|--------|-------|
| Render (or other hosting) | REQUIRED | Set `AI_CLIENT_TYPE` env var |
| Environment variables | REQUIRED | See `.env.example` for all required vars |
| Domain name | OPTIONAL | Configure DNS + SSL |
| Frontend build | REQUIRED | `npm run build` in `frontend/` |
| Backend JAR | REQUIRED | `./gradlew bootRun` or Docker build |

---

## Quick Validation Steps

After completing the checklist, run:

```bash
# 1. Backend compiles
cd backend && ./gradlew compileKotlin

# 2. Backend tests pass
cd backend && ./gradlew test

# 3. Frontend typecheck
cd frontend && npx tsc --noEmit

# 4. Frontend lint
cd frontend && npm run lint

# 5. Health check
curl http://localhost:8080/actuator/health
```

If all four pass, the code is ready. External resources (Groq, M-Pesa, etc.) can be added later.