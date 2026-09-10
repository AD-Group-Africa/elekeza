# Elekeza — Environment Variables

Canonical template: [`.env.example`](../../.env.example) (placeholders only — never commit real values).

## Mandatory for production

| Variable | Consumer | Purpose |
| --- | --- | --- |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | backend | PostgreSQL credentials |
| `JWT_SECRET` | backend | HS256 signing key for access tokens — 32+ random chars |
| `AI_INTERNAL_SECRET` | backend ↔ ai-service | Shared secret on internal AI calls |
| `NEXT_PUBLIC_API_URL` | frontend | Bare backend origin (no `/api` suffix; axios appends it) |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | backend | Exact browser origin(s); wildcard is rejected at boot |
| `SECURE_COOKIES` | backend | Must be `true` behind TLS |

## Provider backends (safe mocks by default)

| Variable | Values | Notes |
| --- | --- | --- |
| `SMS_PROVIDER` | `mock` \| `africa_talking` | Mock logs instead of sending |
| `EMAIL_PROVIDER` | `mock` \| `javamail` | Requires `MAIL_HOST/PORT/USERNAME/PASSWORD` when `javamail` |
| `STORAGE_PROVIDER` | `mock` \| `cloudflare_r2` | Requires `CLOUDFLARE_R2_*` when r2 |
| `MPESA_CONSUMER_KEY/SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL` | Daraja | Callback is public but validated (state machine + amount binding) |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth | Social login is dormant unless configured |
| `SENTRY_DSN_BACKEND`, `SENTRY_DSN_AI`, `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Optional error tracking |
| `LANGFUSE_*` | Langfuse | Optional AI observability |

## Behavioural defaults worth knowing

- `SPRING_JPA_HIBERNATE_DDL_AUTO` defaults to `validate` in prod — schema drift fails fast instead of corrupting data.
- `SPRING_PROFILES_ACTIVE=prod` must be set in deployment; the dev profile silently swaps in an in-memory database.
- Actuator exposure is limited to `health`; nothing else is publicly reachable.

## Rotation notes

- `JWT_SECRET` rotation invalidates all access tokens (15 min TTL) and should be paired with a refresh-token table purge — acceptable in a maintenance window.
- Provider keys (M-Pesa, SMTP, R2) rotate independently; no restart-order coupling.
