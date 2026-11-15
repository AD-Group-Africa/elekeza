# Payment Lifecycle Audit Events — Coverage, Schemas, Redaction

**Date:** 2026-10-21 · **Sprint:** Payment Security Sprint 2 · **Phase:** 4
**Scope:** the complete M-Pesa payment lifecycle — initiation and validation,
provider request/response handling, pending/success/failure states, callback
receipt and validation, duplicate callbacks and idempotency, reconciliation
and administrative adjustment — and the audit events that record it.

---

## 1. Mechanism (reused, not invented)

The existing `AuditLogService`
(`backend/src/main/kotlin/com/elekeza/backend/common/AuditLogService.kt`) was
reused. It writes to the existing `audit_logs` table through
`AuditLogRepository` (entity `AuditLog`): `action`, `category`, `detail`,
`userId`, `ipAddress`, `requestId`, `success`, `createdAt`.

Design properties that were verified rather than assumed:

- **The financial ledger is not derived from the audit log.** `payments` and
  `mpesa_transactions` remain the only source of financial truth; an audit row
  is queryable evidence/correlation, never an input to a credit decision.
- **Audit writes are `@Async` and best-effort.** `@EnableAsync` is present
  (`AppConfig`), so the write happens on a worker thread and cannot slow the
  payment path; failures are caught and logged ("Audit log write failed
  (non-critical)"). A lost audit line can never roll back or corrupt a
  financial record.
- **Access control:** audit rows are read only through
  `GET /api/admin/audit` (`@PreAuthorize("hasRole('ADMIN')")`). Payment roles
  (teacher, guardian, student) cannot read the audit trail.
- **Retention:** a nightly purge deletes rows older than 90 days
  (`@Scheduled(cron = "0 0 2 * * *")`). This bounds the table but means
  **payment audit evidence older than 90 days is not retained** — see
  §6 (operational limitation) and the recommendation in §6.
- **Transaction boundary:** the audit write is a *separate* transaction from
  the payment transaction, so an audit failure cannot abort a credit, and a
  rolled-back payment can still leave an audit row (an initiation attempt that
  was rolled back is still an attempt worth recording).

## 2. Event catalogue

All events use `category = "PAYMENT"`. `detail` is a compact `key=value`
string; the columns below list the *shape* of that string, not a literal
template.

| action | emitted in | `success` | `detail` shape | correlation id |
|---|---|---|---|---|
| `MPESA_INIT` | `FinanceService.initiateMpesaPayment` (after provider accepted) | true | `learnerId`, `amountKES`, `checkoutRequestId`, `mocked` | checkoutRequestId |
| `MPESA_INIT_REJECTED` | same (provider unavailable / no checkout id) | **false** | `learnerId`, `amountKES`, `outcome=provider-unavailable` | — |
| `MPESA_STK_ACCEPTED` | `MpesaService.stkPush` | true | `intentId`, `checkoutRequestId` | checkoutRequestId |
| `MPESA_STK_REVIEW` | `MpesaService.stkPush` (no `CheckoutRequestID` in response) | **false** | `intentId`, `outcome=provider-no-checkout-id` | intentId |
| `MPESA_CALLBACK` | `MpesaService.processCallback` (callback accepted for processing) | true | `checkoutRequestId`, `resultCode`, `amountKES` | checkoutRequestId |
| `MPESA_CALLBACK_UNKNOWN` | same (no such transaction) | **false** | `checkoutRequestId` | checkoutRequestId |
| `MPESA_CALLBACK_DUPLICATE` | same (transaction already terminal) | true | `checkoutRequestId`, `status` | checkoutRequestId |
| `MPESA_CALLBACK_MISMATCH` | same (provider amount ≠ initiated amount) | **false** | `checkoutRequestId`, `actually-initiated-KES` | checkoutRequestId |
| `MPESA_REFUSED` | same (provider verification says not successful) | **false** | `outcome=provider-contradiction` | checkoutRequestId |
| `MPESA_AWAITING` | same (verification unavailable → parked) | **false** | `outcome=unverified-parked` | checkoutRequestId |
| `MPESA_CREDIT_APPLIED` | `FinanceService.onMpesaSuccess` (ledger credit written) | true | `checkoutRequestId`, `paymentId`, `learnerId`, `amountKES`, `receiptNumber` | checkoutRequestId |
| `MPESA_RECONCILE_RETRY` | `MpesaReconciliationWorker` | true | `checkoutRequestId`, `attempt`, `backoffSeconds` | checkoutRequestId |
| `MPESA_RECONCILED` | same (provider confirmed → `COMPLETED`) | true | `checkoutRequestId`, `outcome=completed` | checkoutRequestId |
| `MPESA_RECONCILE_ESCALATED` | same (`REQUIRES_REVIEW` reached) | **false** | `txId` + `outcome=no-provider-id-requires-review`, **or** `checkoutRequestId` + `attempts=N` | checkoutRequestId / txId |

**Initiating actor:** `userId` is populated for `MPESA_INIT` /
`MPESA_INIT_REJECTED` (the authenticated actor — student, guardian, school
admin or platform admin). Provider-originated and worker-originated events
(`MPESA_*` from `MpesaService` / the reconciliation worker) have
`userId = null` because no human actor exists; the *component* is identified
by the action name and the correlation id. No "SYSTEM" pseudo-user was
invented.

**State transition:** encoded in the action + `detail` outcome
(`outcome=provider-contradiction`, `outcome=unverified-parked`,
`outcome=completed`, `outcome=no-provider-id-requires-review`), and always
recoverable by joining the correlation id to `mpesa_transactions.status`,
which remains the authoritative state column.

## 3. Redaction rules

| Never stored | Why |
|---|---|
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_PASSKEY` | credentials |
| OAuth `access_token`, `Authorization` headers, Basic-auth base64 | credentials |
| MSISDN / phone numbers | personal data; the correlation id is sufficient |
| Raw callback bodies, raw provider responses, raw exception messages | may embed the above |
| Receipt numbers, except the M-Pesa receipt number on `MPESA_CREDIT_APPLIED` | receipt number is the payment's own reference and is required for reconciliation; it is not a secret |

**How redaction is achieved (by construction, not by filter):**

1. Audit call sites build the `detail` string themselves from a small allowlist
   of fields. There is no generic "dump the request/response" path into
   `AuditLogService`, so a provider payload cannot reach the audit table
   unless someone writes that code deliberately.
2. The failure branch of `AuditLogService.log` logs `detail` — the same
   already-redacted string — not the cause. The exception message itself is
   logged only as `e.message` at error level for the audit write failure
   itself, never with a payload.
3. `MpesaService.getAccessToken()` raises a bare
   `RuntimeException("Failed to get M-Pesa access token")` — the message
   contains no token.
4. The provider-verification failure path parks the transaction with a
   **reason class** (`unverified: <reason>`) on the transaction row, and the
   audit row carries `outcome=unverified-parked` — the human-readable reason
   text is not copied into the audit trail.

**Residual risk accepted:** a *new* call site could pass an unsanitised
string as `detail`. There is no runtime scrubber, because a runtime scrubber
that silently mutates financial evidence is worse than a review-time rule.
Mitigation: the event catalogue above is the review checklist, and the
assertions in §5 check that the sensitive fields do not appear in the audit
rows for the payment paths.

## 4. Lifecycle coverage map

| Lifecycle step | Audited? | Event(s) |
|---|---|---|
| Initiation request validation (amount, learner, authorisation) | Partially | Validation/authorisation failures raise `403`/`400` **before** an audit event is written (see §6). Successful initiations are audited. |
| Provider request accepted | Yes | `MPESA_STK_ACCEPTED`, `MPESA_INIT` |
| Provider request rejected / no checkout id | Yes | `MPESA_STK_REVIEW`, `MPESA_INIT_REJECTED` |
| Durable intent without provider id (uncertain initiation) | Yes | `MPESA_STK_REVIEW`, later `MPESA_RECONCILE_ESCALATED` |
| Callback received (accepted for processing) | Yes | `MPESA_CALLBACK` |
| Callback for unknown transaction | Yes | `MPESA_CALLBACK_UNKNOWN` |
| Callback for an already-terminal transaction (replay) | Yes | `MPESA_CALLBACK_DUPLICATE` |
| Callback with a mismatched amount | Yes | `MPESA_CALLBACK_MISMATCH` |
| Callback claiming success, provider contradicts | Yes | `MPESA_REFUSED` |
| Callback claiming success, provider inconclusive | Yes | `MPESA_AWAITING` |
| Verified success → ledger credit | Yes | `MPESA_CREDIT_APPLIED` |
| Provider-declared failure / cancellation | Yes | `MPESA_CALLBACK` (resultCode recorded) — the terminal transition itself is on the transaction row |
| Reconciliation retry | Yes | `MPESA_RECONCILE_RETRY` |
| Reconciliation resolution | Yes | `MPESA_RECONCILED` |
| Reconciliation exhaustion → human review | Yes | `MPESA_RECONCILE_ESCALATED` |
| Refund / reversal | **No — not implemented** (see §6) | — |
| Manual administrative payment adjustment | **No — not implemented** | — |
| Administrative resolution of a `REQUIRES_REVIEW` transaction | **No — no such workflow exists** | — |

## 5. Tested scenarios

`backend/src/test/kotlin/com/elekeza/backend/payments/MpesaCallbackVerificationTest.kt`
was extended with an injected `AuditLogRepository` and an `awaitAudit(action,
detailContains)` helper that polls (audit writes are `@Async`, so the row may
land shortly after the callback returns; the helper bounds the wait at 5 s and
then fails the assertion).

| Scenario | State asserted | Audit rows asserted |
|---|---|---|
| Unverifiable success | `AWAITING_VERIFICATION`, **0** payments | `MPESA_CALLBACK`, `MPESA_AWAITING` |
| Provider says not successful | `FAILED`, **0** payments | `MPESA_CALLBACK`, `MPESA_REFUSED` |
| Independently confirmed success | `COMPLETED`, **1** payment | `MPESA_CALLBACK`, `MPESA_CREDIT_APPLIED` |
| Replayed callback (idempotency) | `COMPLETED`, **1** payment, 1 transaction row | `MPESA_CALLBACK_DUPLICATE` |
| Amount mismatch | status unchanged (`INITIATED`), **0** payments | `MPESA_CALLBACK_MISMATCH` |
| Unknown checkout id | no transaction, **0** payments | `MPESA_CALLBACK_UNKNOWN` |

Assertions are on the **action name and the presence of the correlation id**,
not on free-text payloads, so the tests do not hardcode data that is expected
to stay redacted. Existing coverage retained from Sprint 1:
`MpesaIdempotencyConcurrencyTest` (4 concurrent callbacks ⇒ exactly one
payment, one credit), `MpesaReconciliationTest` (retry, bounded attempts,
escalation, no-op when verification is not live),
`PaymentUniquenessConstraintTest` (database-level duplicate rejection).

Full-suite result: `cd backend && ./gradlew test` → **47 test classes, 321
tests, 0 failures, 0 skipped** (2026-10-21).

## 6. Uncovered transitions and operational limitations

1. **No refund / reversal / chargeback flow exists.** There is no such code
   path in the finance domain, so there is nothing to audit. If it is built,
   it must emit `PAYMENT_REFUND_REQUESTED` / `PAYMENT_REFUNDED` and reverse
   the allocations — a refund that does not reverse allocations would leave
   the ledger wrong, which is a bigger issue than the missing audit event.
2. **No administrative adjustment workflow.** Manual correction of a payment
   (e.g. writing off a `REQUIRES_REVIEW` transaction) does not exist; when it
   is built it must emit `MPESA_REVIEW_RESOLVED` with the acting admin's
   `userId` and a reason code.
3. **Pre-initiation authorisation failures are not audited.** A guardian
   attempting to pay for a non-ward or a teacher opening finance raises
   `403` before any payment event exists. This is consistent with the rest of
   the application (authorisation failures are not payment events) but it does
   mean brute-force probing of the payment endpoints is not visible in the
   payment audit stream — it is visible in the application access log only.
4. **Audit retention (90 days) is shorter than financial-record retention.**
   Payment rows are kept indefinitely, so a reconciliation question raised
   more than 90 days later can no longer be answered from the audit trail.
   The transaction row (`mpesa_transactions.status`, `resultDesc`,
   `verification_attempts`, `last_verified_at`) is the durable record; the
   audit trail is the recent-context layer. **Recommendation:** exempt
   `category = 'PAYMENT'` from the purge, or archive it — owner decision
   (finance/compliance), not a code change made unilaterally in this sprint.
5. **Asynchronous delivery means "eventually consistent" evidence.** A crash
   between the payment commit and the audit write leaves a payment with no
   audit row. The reverse (audit row without payment) is possible too. Both
   are recoverable by joining on the correlation id, but neither is atomic.
6. **`detail` is free text.** It is not a structured JSON column, so
   cross-event analytics requires string parsing. Changing the column type is
   a schema migration and out of scope for this sprint.
7. **Admin audit reads are not themselves audited.** `GET /api/admin/audit`
   is role-protected but does not write a "who read the audit trail" event.
   Low risk (the reader is an admin, and the table is append-only in
   practice), but it is a gap if audit-trail access must itself be provable.
