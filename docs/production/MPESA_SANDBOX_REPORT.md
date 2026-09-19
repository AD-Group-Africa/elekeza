# M-Pesa Sandbox Report

Date: 2026-09-06 · Verdict: **CODE PATH VERIFIED — SANDBOX PENDING EXTERNAL ACTIVATION**

## 1. Configuration status

| Item | Status |
| ---- | ------ |
| Daraja consumer key / secret | **Not configured** — no credentials available in this environment |
| Environment adapter (`MPESA_ENV=sandbox\|production`) | Implemented; validates required vars at startup when enabled |
| Mock/test mode (default without credentials) | Implemented — used by all automated tests |
| Callback base URL | `MPESA_CALLBACK_BASE_URL` env var; server-to-server endpoint `/api/payments/callback` |

No real credentials exist in source control (verified by repo-wide secret sweep). Activation is configuration-only.

## 2. Code-path verification (evidence)

The full callback lifecycle is covered by **12 automated tests** and **1 live probe**:

**Unit / service-level (`MpesaServiceTest`, 6 tests)**
- STK-push initiation request shape and payload validation
- Amount binding: callback amount ≠ expected amount → **REJECTED, no entitlement**
- Duplicate callback: same transaction id processed twice → **single credit, idempotent**
- Invalid/untrusted callback payloads → rejected + audit event, no state change
- Failure callbacks → payment transitions `INITIATED → FAILED`, user notified, no entitlement
- Pending-payment reconciliation: safe retry, no duplicate payment rows

**End-to-end through the real security chain (`MpesaCallbackEndToEndTest`, 6 tests)** — these tests issue real HTTP requests through Spring Security, so they exercise exactly what Safaricom's servers will hit:
- valid callback → 200, payment `SUCCESS`
- duplicate callback → 200, no double credit
- wrong amount → rejected, no entitlement
- invalid payload → rejected + audit
- failure callback → `FAILED` transition
- unauthenticated-but-exempt endpoint accepts server-to-server POST without browser cookies

**Defect found and fixed during rehearsal (P1):** `/api/payments/callback` was authentication-permitted but **not CSRF-exempt** — Safaricom's server-to-server POST can never carry a CSRF token, so every real callback would have been rejected with 403. The endpoint was added to the CSRF ignore list in `SecurityConfig` and the 6 chain tests were added to pin the behavior. Live probe after restart: callback POST → **200** (previously 403).

## 3. Transaction lifecycle (implemented state machine)

```text
STK push initiated → INITIATED → PROCESSING/PENDING
  ├─ callback success + amount match + first delivery → SUCCESS (+ entitlement)
  ├─ callback failure → FAILED (user notified, retry/re-initiation possible)
  ├─ wrong amount / untrusted payload → REJECTED + audit event (state unchanged)
  └─ duplicate delivery → no-op (idempotent by provider transaction id)
```

## 4. Sandbox verification (blocked on credentials)

Once Daraja sandbox credentials exist, run the 10-step activation checklist in
`docs/production/external-integrations.md` (§ M-Pesa): configure env → start → sandbox STK push →
confirm callback → duplicate-callback probe → wrong-amount probe → invalid-signature probe →
reconciliation sweep → audit-trail review → record result here.

**Until then this must be reported as `M-PESA SANDBOX: PENDING EXTERNAL ACTIVATION` — never as live-verified.**
