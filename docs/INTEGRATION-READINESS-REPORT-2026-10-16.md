# Elekeza — Integration Readiness Report (2026-10-16)

**Scope:** read-only configuration and code review plus local test execution. No
credentials were printed, no live/sandbox transactions attempted, no production
data touched. Branch `feat/elekeza-pilot-completion` @ `1299c5b`.

Companion documents:
[PRIVILEGED-ACCESS-AUDIT-2026-10-16.md](PRIVILEGED-ACCESS-AUDIT-2026-10-16.md) ·
[RELEASE-ASSURANCE-REVIEW-2026-10-16.md](RELEASE-ASSURANCE-REVIEW-2026-10-16.md).

---

## 0. Environment verification (why live tests were not run)

Environment variables checked for **presence only** (values never read or
printed):

| Variable | Present? |
|---|---|
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` | **unset** |
| `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` | **unset** |
| `AFRICA_TALKING_API_KEY` | **unset** |
| `EMAIL_PROVIDER`, `SMS_PROVIDER`, `STORAGE_PROVIDER`, `AI_CLIENT_TYPE` | **unset** |

**Consequence:** no Daraja sandbox or production call can be made from this
environment, and no real SMS/email/storage/AI call either. All M-Pesa results
below are therefore **local/mock** unless explicitly marked otherwise. Per the
brief, `HTTP 200` from a mock or a health check is **not** evidence of a working
external integration.

---

## 1. M-Pesa / Daraja lifecycle review

Controller: `payments/MpesaController.kt`; provider client:
`payments/MpesaService.kt`; fee gateway: `finance/MpesaGateway.kt`; finance
mapping: `finance/FinanceService.kt#L380`.

| # | Lifecycle stage | Implementation | Status |
|---|---|---|---|
| 1 | Initiate payment | `POST /api/payments/stkpush` (school) / `POST /api/finance/payments/mpesa/initiate` (fees) | IMPLEMENTED |
| 2 | Provider request + OAuth | `getAccessToken()` (Basic auth) + STK push body (Password, Timestamp, shortcode) | IMPLEMENTED |
| 3 | Callback correlation | `processCallback` → `findByCheckoutRequestId` | IMPLEMENTED |
| 4 | **Callback authentication** | **None** — no signature verification; endpoint is `permitAll` + CSRF-exempt | **NOT IMPLEMENTED** |
| 5 | Validate amount/id/status | Amount binding (tolerance 0.001), unknown-id rejection, ResultCode→terminal state | IMPLEMENTED |
| 6 | Persist transactionally | Transaction row saved, then finance `Payment` via listener (separate `@Transactional`) | PARTIAL (see 1.3) |
| 7 | Duplicate/retry handling | Terminal-state guard (COMPLETED/FAILED never reopened) | IMPLEMENTED (app-level) |
| 8 | Delayed/failed/ambiguous | FAILED recorded; **no reconciliation** of pending/ambiguous | **MISSING** |
| 9 | Reconciliation vs provider | `getTransactionStatus()` exists but has **no caller**; no scheduled job | **NOT IMPLEMENTED** |
| 10 | Status to frontend | Mode flag `GET /api/finance/payments/mpesa/mode`; STK response | PARTIAL |

### 1.1 Callback authenticity — **P0 finding**

- `POST /api/payments/callback` is **unauthenticated** (`permitAll`) and
  **CSRF-exempt** (`SecurityConfig`), with **no provider signature check**.
- The code itself documents the requirement without implementing it:
  > *"Deployments with real Daraja credentials MUST additionally enable provider
  > signature verification (Safaricom signs callbacks with their public key) at
  > the edge before this handler runs."* — `MpesaService.kt` L108–110.
- **Residual protection** (do not mistake for authentication): a callback is only
  accepted for an **existing initiated** `checkout_request_id` whose **amount
  matches**. This prevents creating money out of nothing for unknown ids, but a
  party who knows a real initiated checkout id (returned to the initiating
  client) could still POST a forged *success* for it.
- **Verdict: NOT VERIFIED / effectively unauthenticated.** HTTPS alone does not
  authenticate the caller.

### 1.2 Idempotency — implemented at application level only

- `processCallback` refuses to reopen a terminal row; `FinanceService.onMpesaSuccess`
  uses `findByCheckoutRequestId`/`findByProviderRef` as idempotency keys.
- **Database constraints are absent for the idempotency keys:**
  - `mpesa_transactions.checkout_request_id` — **no UNIQUE** (V1 L177–193).
  - `payments.checkout_request_id` — **index only, not UNIQUE** (V11).
  - `payments.payment_number` is UNIQUE, but it is **generated fresh** per call,
    so it does **not** prevent a second `Payment` for the same checkout.
- **Consequence:** two concurrent success callbacks for the same checkout id can
  both pass the check-then-act guard and create **two finance `Payment` rows**
  (double-crediting the learner's fees). No test exercises concurrency.

### 1.3 Failure between provider acceptance and local persistence

- In `stkPush`, the provider is called **before** `transactionRepo.save(...)`.
- If the save fails (crash/DB error) after Daraja accepted the STK, the local
  ledger has no row; the later callback is treated as an **unknown checkout id**
  and **dropped**. There is **no reconciliation job** to recover it.
- **Consequence:** silently lost payments with no recovery path.

### 1.4 Configuration

| Property (env) | Default | Note |
|---|---|---|
| `mpesa.consumer-key` (`MPESA_CONSUMER_KEY`) | empty | empty ⇒ `stkPush` returns **503** (honest) |
| `mpesa.consumer-secret` (`MPESA_CONSUMER_SECRET`) | empty | idem |
| `mpesa.passkey` (`MPESA_PASSKEY`) | empty | required for password |
| `mpesa.shortcode` (`MPESA_SHORTCODE`) | `174379` | sandbox default |
| `mpesa.callback-url` (`MPESA_CALLBACK_URL`) | empty | **if empty, STK push sends an empty CallBackURL** — set explicitly for live |
| `mpesa.environment` (`MPESA_ENVIRONMENT`) | `sandbox` (base yaml) / **`production`** (prod yaml) | chooses `api.safaricom.co.ke` |
| `fees.mpesa-mode` | `mock` | `live` requires credentials; else honest 503 |

### 1.5 Required tests — status

| Required scenario | Test | Result |
|---|---|---|
| Valid callback | `MpesaCallbackTest` / `MpesaCallbackEndToEndTest` | **PASS (local)** |
| Missing/malformed authentication evidence | — | **NO TEST — cannot exist, no auth implemented** |
| Duplicate callback | both tests | **PASS (local)** |
| **Concurrent** duplicate callbacks | — | **NO TEST (and no DB guard)** |
| Callback for unknown checkout | both tests | **PASS (local)** |
| Mismatched amount | both tests | **PASS (local)** |
| Failure between accept & persistence | — | **NO TEST (gap is in code)** |
| Provider timeout + retry | — | **NO TEST** |
| Delayed callback after UI timeout | — | **NO TEST** |
| Callback replay | both tests | **PASS (local)** |
| Reconciliation of uncertain outcome | — | **NO TEST / NOT IMPLEMENTED** |

**Coverage:** unit `Y`, integration-through-chain `Y`, **sandbox `N`, production
`N`**.

## 2. Other integrations

| Integration | Provider selection | Required env (names only) | Credentials present | Timeout/retry | Failure behaviour | Tests | Operational status |
|---|---|---|---|---|---|---|---|
| **SMS** | `sms.provider` (`mock` default; `africa_talking`) | `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` | **No** | RestTemplate default | `africa_talking` without key fails fast (honest) | `NotificationServiceTest` (config) | **NOT VERIFIED** (mock only) |
| **Email** | `email.provider` (`mock` default; `javamail`) | `MAIL_HOST/PORT/USERNAME/PASSWORD` | **No** | Spring Mail default | mock records in memory | `JavaMailEmailProviderTest` | **NOT VERIFIED** (mock only) |
| **Storage** | `storage.provider` (`mock` default; `cloudflare_r2`) | `CLOUDFLARE_R2_ACCOUNT_ID/BUCKET_NAME/ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `R2_ENDPOINT` | **No** | SDK default | mock/local fallback | — | **NOT VERIFIED** (mock only) |
| **AI service** | `ai.client.type` (`mock` default; `real`) | `AI_SERVICE_URL`, `AI_INTERNAL_SECRET` | **No** | 60–120 s (`ai.timeout-seconds`) | mock path; degraded-path handled | `MockAiClient`, quiz parser | **NOT VERIFIED** (mock only) |
| **DB migrations** | Flyway | `DB_URL/USER/PASSWORD` | H2 local | — | `validate-on-migrate` | exercised by suite | VERIFIED (local H2) |

> **Live-readiness note:** production yaml does **not** override
> `sms.provider`/`email.provider`/`storage.provider`, so a production boot
> without those env vars would run the **mock** providers. This is honest (mock
> is self-declared) but means the pilot must set them explicitly for real
> delivery.

## 3. Integration readiness matrix (summary)

| Integration | Implemented | Configured | Tested locally | Verified sandbox | Verified production | Blocker |
|---|---|---|---|---|---|---|
| M-Pesa STK push | Yes | No (no creds) | Yes (mock) | **NOT VERIFIED** | **NOT VERIFIED** | Credentials + callback URL; live mode off |
| M-Pesa callback auth | **No** | n/a | n/a | n/a | n/a | **P0: implement signature verification at edge** |
| M-Pesa idempotency | Partial | — | Yes (local) | NOT VERIFIED | NOT VERIFIED | No DB unique constraint → concurrency risk |
| M-Pesa reconciliation | No | — | No | n/a | n/a | No caller, no scheduled job |
| SMS | Yes | No | Yes (mock) | NOT VERIFIED | NOT VERIFIED | `AFRICA_TALKING_API_KEY` |
| Email | Yes | No | Yes (mock) | NOT VERIFIED | NOT VERIFIED | SMTP creds |
| Storage | Yes | No | Partial | NOT VERIFIED | NOT VERIFIED | R2 creds |
| AI service | Yes | No | Yes (mock) | NOT VERIFIED | NOT VERIFIED | `AI_SERVICE_URL`, `AI_INTERNAL_SECRET` |

## 4. Findings (prioritized)

- **P0 — Unauthenticated payment callback.** No provider signature verification;
  endpoint `permitAll` + CSRF-exempt. Code comments acknowledge it; not built.
- **P0 — No durable reconciliation.** `getTransactionStatus()` is dead code and
  there is no scheduled reconciliation; pending/ambiguous payments and
  provider-accepted-but-unsaved pushes are not recoverable.
- **P1 — Idempotency has no DB backstop.** Concurrent duplicate callbacks can
  create a duplicate finance `Payment` (double credit). Add a UNIQUE constraint
  on the idempotency keys and/or a transaction-safe state transition.
- **P1 — Provider call precedes local persistence** in `stkPush` (lost-payment
  window).
- **P1 — Empty default `MPESA_CALLBACK_URL`** would be sent to the provider if
  live credentials existed without the URL set.
- **P2 — Production still defaults to mock SMS/email/storage** unless env vars
  set; ensure the pilot sets them and that this is understood.

## 5. Honest limitations

- **No sandbox or production verification was performed** — no credentials,
  callback URL, or network access exists in this environment.
- All "PASS" results are **local, mock-backed** tests (H2 in-memory, mock
  providers). They prove the state machine and filter chain, **not** provider
  integration.
- No performance/throughput testing of the callback path was done.
