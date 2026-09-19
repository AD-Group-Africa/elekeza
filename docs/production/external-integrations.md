# Elekeza — External Integrations

Status legend: **IMPLEMENTED** (code complete, active) · **READY FOR ACTIVATION** (code + config boundary complete; needs credentials) · **PENDING CREDENTIALS** (verified against mock; real provider never exercised).

## Summary matrix

| Integration | Status | Where | Activation step |
| --- | --- | --- | --- |
| SMS (Africa's Talking) | READY FOR ACTIVATION | `AfricaTalkingSmsProvider` | Set `SMS_PROVIDER=africa_talking` + `AFRICA_TALKING_API_KEY` |
| Email (SMTP) | READY FOR ACTIVATION | `JavaMailEmailProvider` | Set `EMAIL_PROVIDER=javamail` + `MAIL_*` |
| Object storage (Cloudflare R2) | READY FOR ACTIVATION | `CloudflareR2Provider` | Set `STORAGE_PROVIDER=cloudflare_r2` + `CLOUDFLARE_R2_*` |
| AI provider (Groq et al.) | PENDING CREDENTIALS | AI service + `AI_PROVIDER` | Provision key; verify output-validation + fallback path live |
| M-Pesa (Daraja STK push) | PENDING CREDENTIALS | `MpesaService` + callback | Provision Daraja app; register `MPESA_CALLBACK_URL`; run sandbox first |
| Google OAuth | DORMANT | config placeholders | Not enabled for pilot |

## Design guarantees (provider-independent)

- Every provider sits behind an interface with a **safe mock**: when credentials are absent the app degrades (SMS/email logged, uploads local) — the learning platform never hard-fails because an optional provider is down.
- AI unavailability never blocks learning: the personalization engine serves deterministic adaptations and falls back to original content; AI failures are counted, not fatal.
- M-Pesa callback is authenticated by transaction-binding rules (state machine, amount match, known CheckoutRequestID) — never by trusting the caller.

## Verification obligations before flipping each provider to live

1. SMS/Email: send one real message to a test number/inbox; confirm delivery logs. Note: guardian onboarding never depends on email — import results surface one-time guardian credentials in-app, so the school can deliver them even with the mock provider.
2. R2: upload + download one file through the app; confirm the object key and ACL.
3. AI: run one adaptation with a real key; confirm latency, validation, and fallback under an invalid key.
4. M-Pesa: full sandbox STK push → callback → entitlement; then one real 1-unit transaction.

## Demo-day posture

For the Tuesday demo all integrations stay in mock mode; the product is fully
functional locally. Show integration status if asked — never simulate a real
provider response. Activation status: see the matrix above and
`docs/demo/DEMO-TROUBLESHOOTING.md`.
