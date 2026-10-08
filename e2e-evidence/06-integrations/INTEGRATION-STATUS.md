# TASK 6 — INTEGRATION STATUS (evidence-based, 2026-10-02)

Rule applied: an integration is only as complete as its *runtime-verified* behaviour —
existing credentials or template keys alone never count.

| # | Integration | Status | Evidence |
|---|---|---|---|
| 1 | Database — PostgreSQL 15, `elekeza_chain_scratch` | **FUNCTIONAL** | Live on :5433 (verified `users=5`); Flyway V1–V16 applied; persistence loops DB-verified today (quiz attempt 54, attendance id=2, guardian message id=16, accessibility_profiles mirror); prior audit 13/13 integrity checks zero-defect |
| 2 | AI — Groq via ai-elewa (`AI_PROVIDER=groq`, `AI_API_KEY`) | **FUNCTIONAL** | Live Groq 200s from the real frontend (learner tutor EXPLAIN ≈1.8 s; teacher upload "AI has simplified"); provider Retry-After honored; AI-down and invalid-key degradation fully graceful (05-ai/AI-DEGRADATION-EVIDENCE.md) |
| 3 | M-Pesa / Daraja | **PARTIAL** (mock) | Full initiate → callback → payment chain works in MOCK gateway (`fees.mpesa-mode:mock`, MpesaGateway.kt:33); state machine idempotent, amount-mismatch + replay rejected (MpesaService.processCallback). Live Daraja **BLOCKED on real credentials** (consumer key/secret, passkey, shortcode, callback URL) + mandatory edge signature verification — requires Harry |
| 4 | Email (SMTP) | **NOT CONFIGURED** | `JavaMailEmailProvider.kt` exists and is wired but runtime env has zero MAIL_* keys; password-reset tokens persist to `password_reset_tokens` with no delivery channel |
| 5 | SMS (Africa's Talking) | **NOT CONFIGURED** | `AfricaTalkingSmsProvider.kt` wired-inert; template keys only in `frontend/.env.local` (deployment reference), nothing at runtime |
| 6 | Storage (external R2/S3) | **NOT CONFIGURED** (external) / local disk works | Content upload stores on local disk (`content.file_path` → READY, id=6 today); `CLOUDFLARE_R2_*` template keys unused at runtime — R2 decision still open (Harry) |
| 7 | Notifications (in-app) | **FUNCTIONAL** | DB-backed `notifications` (12 seeded, +guardian message today); rendered on /notifications; no email/push delivery channels exist |
| 8 | Google OAuth | **NOT CONFIGURED** | `GOOGLE_CLIENT_ID/SECRET` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` exist only as config; no Google controller in backend, no Google button on /login — dead configuration |
| 9 | Observability (Langfuse/Sentry) | **NOT CONFIGURED** | AI boot log: "Langfuse client initialized without public_key → disabled"; Sentry DSNs template-only |
| 10 | Redis | **NOT CONFIGURED** (not required for pilot) | Template keys only; runtime uses DB + in-process state |

## Counts

- FUNCTIONAL: 3 / 10 (Database, AI, in-app Notifications)
- PARTIAL: 1 / 10 (M-Pesa — full chain in mock mode)
- NOT CONFIGURED: 6 / 10 (SMTP, SMS, external storage, Google OAuth, observability, Redis)
- BLOCKED on external credentials/devices: M-Pesa live, SMTP, Africa's Talking, R2 decision, DNS/TLS/hosting

## Key correction recorded

The AI service reads `AI_PROVIDER` + `AI_API_KEY` + `INTERNAL_SECRET` from `ai-elewa/.env`
(config.py:11-23). Earlier notes referring to `GROQ_API_KEY` in ai-elewa are inaccurate —
`GROQ_API_KEY` in `backend/.env` is a separate, backend-side value. Verified live by overriding
`AI_API_KEY` and watching Groq return 401 "Invalid API Key" (invalid-credential probe).
