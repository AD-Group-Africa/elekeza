# Elekeza — Payment Security Remediation (2026-10-16)

**Sprint:** P0 payment-integrity remediation (Sprint 1)
**Branch:** `feat/elekeza-pilot-completion` @ `1299c5b` (starting and ending HEAD)
**Scope:** M-Pesa callback trust, duplicate-payment prevention, reconciliation and
recovery. No unrelated refactoring, no governance work, no deployment, no
real-money transactions.

Companion documents:
[INTEGRATION-READINESS-REPORT-2026-10-16.md](INTEGRATION-READINESS-REPORT-2026-10-16.md) ·
[PRIVILEGED-ACCESS-AUDIT-2026-10-16.md](PRIVILEGED-ACCESS-AUDIT-2026-10-16.md) ·
[RELEASE-ASSURANCE-REVIEW-2026-10-16.md](RELEASE-ASSURANCE-REVIEW-2026-10-16.md).

---

## 1. The real Daraja callback trust model (evidence)

Researched against Safaricom's published documentation and Safaricom-maintained
SDK samples, not third-party blogs:

| Question | Finding | Evidence |
|---|---|---|
| Does the STK callback carry a signature/HMAC/shared secret? | **No.** The public callback contract documents no signature or per-callback secret, and Safaricom's own sample callback parser extracts `ResultCode`/`CheckoutRequestID`/metadata with no signature-validation step. | [Safaricom PHP SDK `TransactionCallbacks.php`](https://github.com/safaricom/mpesa-php-sdk/blob/master/src/TransactionCallbacks.php), [Daraja M-Pesa Express](https://developer.safaricom.co.ke/apis/MpesaExpressSimulate) |
| Is source-IP allowlisting documented? | **Yes** — the official Getting Started page has a "Callback and IP Whitelisting" section. It is a network-level filter, **not** payload integrity. | [Daraja Getting Started](https://developer.safaricom.co.ke/apis/GettingStarted) |
| Independent outcome query? | **Yes** — STK Push Query `POST /mpesa/stkpushquery/v1/query` with `BusinessShortCode`, `Password`, `Timestamp`, `CheckoutRequestID`; `ResultCode = 0` ⇒ success. | Safaricom Java SDK `Mpesa.java`; Daraja M-Pesa Express page |
| Transaction Status API? | Exists (`/mpesa/transactionstatus/v1/query`, requires `Initiator` + encrypted `SecurityCredential`, returns the result to a `ResultURL`). | Safaricom C# SDK `TransactionStatus.cs`, [Daraja Transaction Status](https://developer.safaricom.co.ke/apis/TransactionStatus) |

**Conclusion — the honest limitation:** callback authenticity **cannot** be
established cryptographically for standard STK callbacks. Therefore this
remediation does **not** pretend to verify a signature. It treats the callback as
a *notification* and requires **independent provider verification** before any
money is credited, which is exactly the guidance the research supports.

## 2. What is implemented vs. unavailable

| Control | Status |
|---|---|
| Callback is treated as untrusted notification | **IMPLEMENTED** |
| Independent outcome verification (STK Push Query) before credit | **IMPLEMENTED** (`LiveMpesaStatusVerifier`) |
| Fail-closed when live mode lacks credentials | **IMPLEMENTED** (`Unavailable` ⇒ no credit) |
| Callback source-IP allowlisting | **NOT IMPLEMENTED** — operational/edge control. The published IP list must be applied at the network edge; it is deliberately **not** hardcoded in the application (lists change and copying unverified ranges is unsafe). |
| Callback cryptographic signature | **UNAVAILABLE** — the provider does not offer one for STK callbacks. |
| Transaction Status API reconciliation | **NOT IMPLEMENTED** (STK Push Query is used instead; Transaction Status needs an initiator `SecurityCredential` this deployment does not have configured). Documented as a future option when an initiator credential is provisioned. |

## 3. Payment state machine

`mpesa_transactions.status`:

```
PENDING ──(provider accepted)──▶ INITIATED ──(callback: resultCode != 0)──▶ FAILED (terminal)
   │                                 │
   │                                 ├──(callback: success claimed)──▶ verify ──Confirmed──▶ COMPLETED (terminal)
   │                                 │                                       ├─NotSuccessful─▶ FAILED (terminal)
   │                                 │                                       └─Unavailable──▶ AWAITING_VERIFICATION
   │                                 │                                                            │
   │                                 │                                     reconciliation ───────┘
   │                                 │                                     (Confirmed → COMPLETED; NotSuccessful → FAILED;
   │                                 │                                      attempts exhausted → REQUIRES_REVIEW)
   └──(no CheckoutRequestID stored)──┴────────────────────────────────────▶ REQUIRES_REVIEW (terminal, surfaced)
```

- **Terminal statuses** (`COMPLETED`, `FAILED`, `REQUIRES_REVIEW`) are never
  reopened: a replayed or forged success body cannot flip a `FAILED` row.
- A terminal status is reached **only** through
  `transitionNonTerminal`'s conditional UPDATE.
- `REQUIRES_REVIEW` is the explicit "unknown/conflicting — a human must look"
  state. It is never auto-credited.

## 4. Idempotency guarantees

1. **Provider ledger** — `mpesa_transactions.checkout_request_id` is **UNIQUE**
   (entity `@UniqueConstraint` + Flyway `V18`). One provider checkout id can back
   at most one provider transaction row.
2. **Financial ledger** — `payments.checkout_request_id` is **UNIQUE** (entity +
   `V18`). One provider checkout id can back at most one financial credit, even if
   a code path is added later that forgets the application-level check.
3. **Conditional state transition** — `transitionNonTerminal` returns the row
   count; only a caller that observes `1` proceeds to credit. Under concurrent
   duplicate callbacks the row lock serialises the two UPDATEs and exactly one
   wins. This is a **database** guarantee, not an in-memory lock.
4. **Application check** — `FinanceService.onMpesaSuccess` keeps its existing
   `checkoutRequestId`/`providerRef` pre-checks for the common replay case.
5. **NULL semantics** — both unique keys allow multiple `NULL`s (manual payments,
   durable intents before the provider assigns an id).
6. **Credit rollback** — if the credit throws, the transaction (including the
   status change) rolls back so the row stays non-terminal for reconciliation
   instead of silently losing the money.

`Payment` entity change: `@Table(uniqueConstraints = [ux_payment_checkout_request_id])`.
`MpesaTransaction` entity change: same for `ux_mpesa_tx_checkout_request_id`, plus
`verification_attempts`, `next_verification_at`, `last_verified_at`.

## 5. Reconciliation and failure handling

`MpesaReconciliationService` (scheduled, `@Scheduled`) + `MpesaReconciliationWorker`
(one transaction per row) + `MpesaPaymentFinalizer` (the single credit gate).

| Scenario | Handling |
|---|---|
| Provider accepted the request but local persistence failed | `stkPush` writes a **durable `PENDING` intent before** calling the provider; if the call fails/returns nothing usable, the row survives. Reconciliation escalates it to `REQUIRES_REVIEW` (nothing to query by) instead of losing it. |
| Provider answered without a `CheckoutRequestID` | Row moved straight to `REQUIRES_REVIEW`. |
| Missing or delayed callback | Stale non-terminal row is picked up after `stale-after-seconds` and resolved by provider query. |
| Provider timeout / uncertainty | `Unavailable` ⇒ **no status change**, attempt counted, next attempt scheduled with exponential backoff (capped 1h). Never marked failed merely because the provider timed out. |
| Callback arriving after a UI timeout | Same path: the row was non-terminal, so the later callback (or reconciliation) resolves it. |
| Repeated reconciliation attempts | `claimVerificationAttempt` increments atomically; after `max-attempts` (default 8) ⇒ `REQUIRES_REVIEW`. |
| Provider API down / rate limited | `Unavailable` ⇒ backoff and retry; escalation is bounded, never a false success. |
| Two workers racing the same row | The conditional claims (`transitionNonTerminal`, `claimVerificationAttempt`) mean only one wins; the other is a no-op. |
| **Mock/dev mode** | Reconciliation is a **no-op** unless `MpesaStatusVerifier.isLive` — it can never fabricate a completed payment. |

Operational visibility: `GET /api/payments/revenue` now also reports
`awaitingVerification` and `requiresReview` counts, and every state change logs
the checkout id (never credentials or tokens).

### Required operational configuration

| Setting | Default | Meaning |
|---|---|---|
| `fees.mpesa-mode` | `mock` | `live` enables real provider verification; `mock` never moves money. |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | empty | Required for `live`; without them live mode **fails closed**. |
| `MPESA_PASSKEY` | empty | Required for the STK query password. |
| `MPESA_SHORTCODE` | `174379` | Business short code. |
| `MPESA_CALLBACK_URL` | dev: localhost / prod: empty | Must be set in production (`stkPush` now refuses to send an empty one). |
| `MPESA_ENVIRONMENT` | `sandbox` / prod `production` | Selects the Daraja base URL. |
| `payments.reconciliation.*` | interval 300000 ms, initial delay 120000 ms, stale-after 300 s, max-attempts 8, base-backoff 30 s | Reconciliation policy. |
| **Edge** | — | **Allowlist the published Daraja callback IPs** (Getting Started page). This is operational and must be applied at the network edge. |

## 6. Test evidence

New/changed tests (all exercised against the real service, repositories and
database — not isolated helpers):

| File | Cases |
|---|---|
| `payments/MpesaCallbackVerificationTest.kt` | unverifiable success creates no credit and parks as `AWAITING_VERIFICATION`; provider "not successful" refuses the claim; confirmed success ⇒ `COMPLETED` + exactly one credit; replay idempotent; amount mismatch; unknown id; terminal row cannot be overwritten; provider-declared failure ⇒ `FAILED` |
| `payments/MpesaIdempotencyConcurrencyTest.kt` | **4 concurrent** duplicate callbacks (barrier-released) ⇒ exactly one `mpesa_transactions` row, one finance payment, one credit |
| `payments/PaymentUniquenessConstraintTest.kt` | duplicate `mpesa_transactions.checkout_request_id` rejected by the DB; duplicate `payments.checkout_request_id` rejected by the DB; multiple NULLs still allowed |
| `payments/MpesaReconciliationTest.kt` | recovery of a stale transaction to `COMPLETED`; provider decline ⇒ `FAILED`; unreachable provider ⇒ non-terminal + retry scheduled; repeated failures ⇒ `REQUIRES_REVIEW`; intent without checkout id ⇒ escalated, never credited; **no-op when verification is not live** |
| existing `MpesaCallbackTest`, `MpesaCallbackEndToEndTest`, `FinanceApiTest` | unchanged and still passing (mock-mode behaviour preserved) |

Command results are recorded in the final Git review section of the sprint report
(`RELEASE-ASSURANCE` addendum / this sprint's handover). Local, mock-backed tests
only.

## 7. Honest limitations

- **No sandbox or production verification.** No Daraja credentials, callback URL
  or network access exist in this environment. `LiveMpesaStatusVerifier`'s HTTP
  path is therefore **not verified against the real provider** — it is modelled on
  Safaricom's documented request/response and is exercised only through a
  scripted verifier in tests.
- **IP allowlisting is not enforced by the application.** Until the edge applies
  it, the callback endpoint remains reachable by anyone; the credit gate is what
  protects the ledger.
- **Irreducible window:** if the process dies *after* the provider accepts the STK
  request but *before* the durable intent's provider id is persisted, the row is
  escalated to `REQUIRES_REVIEW` — the money is not credited automatically and a
  human must reconcile. This cannot be fully closed without provider-side
  idempotency keys.
- **`V18` was not executed in this environment.** The test/dev profile sets
  `spring.flyway.enabled: false` with `ddl-auto: update`, so the test suite builds
  the schema from the JPA entities — that is why the unique constraints and new
  columns are declared on the entities as well as in the migration. `V18` is
  written for PostgreSQL (the production database) and is covered by a
  pre-flight query, but **it must be dry-run against a staging PostgreSQL
  instance before production**. A second source of truth (entity + migration) is
  a deliberate trade-off, not a claim that the migration was tested.
- **Existing duplicate rows** in a real database would make `V18` fail closed by
  design; the migration carries a pre-flight query and must not be applied until
  those rows are reconciled by hand.
- **Mock mode still credits on the callback** (by design — there is no provider to
  query). That mode must never be used for a live deployment.

---

## 8. Sprint 2 addendum (2026-10-21) — what changed about the limitations above

Sprint 2 validated and hardened this remediation; it did not rewrite it. The
"Honest limitations" in §7 stand as written for Sprint 1, except where
Sprint 2 produced new evidence. Full report:
`docs/PAYMENT-SECURITY-SPRINT-2-REPORT.md`.

| §7 limitation | Sprint 2 status | Evidence |
|---|---|---|
| "`V18` was not executed in this environment" | **RESOLVED** — V18 was executed against PostgreSQL 15.17: clean install V1→V18, upgrade V17→V18 with preserved historical rows, duplicate-key failure cases (fail closed, full rollback, no data loss), re-run idempotence, and a Hibernate `ddl-auto=validate` boot against the migrated schema. | `docs/PAYMENT-V18-POSTGRES-VALIDATION.md` |
| "No sandbox or production verification" | **STILL TRUE / BLOCKED** — no authorised Daraja sandbox credentials exist in this environment, so no live round-trip was performed. The HTTP semantics of `LiveMpesaStatusVerifier` are now proven at the request/response boundary by scripted provider responses (OAuth 200/401, query success, `ResultCode=1032`, in-flight `500.001.1001`, read timeout, unconfigured). The sandbox host is network-reachable and answers an invalid credential with HTTP 400 + empty body (treated as `Unavailable`, i.e. fail closed). | `docs/PAYMENT-DARAJA-SANDBOX-VERIFICATION.md` |
| "IP allowlisting is not enforced by the application" | **STILL TRUE for every environment** — the control is an edge control. A commented, placeholder-based `location = /api/payments/callback` block (with `allow`/`deny all`) is now in the nginx template; it ships inert and is documented with the deployment dependencies and the manual verification steps. No IP range is hardcoded, because no range was obtainable from an authorised Safaricom source in this environment. | `docs/PAYMENT-EDGE-ALLOWLIST-OPERATIONS.md`, `infrastructure/nginx/templates/nginx.conf.template` |
| "Mock mode still credits on the callback" | **Unchanged, by design** — mock mode must never be used for a live deployment. | §5 above |

Additional Sprint 2 hardening: 14 payment-lifecycle audit events now exist
(initiation, STK accept/review, callback accepted/unknown/duplicate/mismatch,
refused, awaiting-verification, credit applied, reconcile retry/reconciled/
escalated), asserted by tests, with redaction rules and the uncovered
transitions documented in `docs/PAYMENT-EVENT-AUDIT.md`.
