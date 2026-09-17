# M-Pesa PRODUCTION GO-LIVE CHECKLIST — Elekeza

Status: **PRODUCTION M-PESA NOT CONFIGURED** (honest state; mock/sandbox verified 2026-09-17)

Nothing in this document is done until the owner supplies real credentials and the
callback is verified end-to-end with Safaricom Daraja. Do not present mock or
sandbox as production in any demo material or stakeholder report.

## 1. Credentials to obtain (owner-side, Daraja portal)

| Item | Env var | Notes |
| --- | --- | --- |
| Production consumer key | `MPESA_CONSUMER_KEY` | From the **production** app on developer.safaricom.co.ke (not sandbox) |
| Production consumer secret | `MPESA_CONSUMER_SECRET` | Stored only in the deployment secret store — never in Git, never in Next.js env |
| Production passkey | `MPESA_PASSKEY` | Lipa Na M-Pesa Online passkey for the production shortcode |
| Paybill/Till shortcode | `MPESA_SHORTCODE` | The school's collected-funds account head |
| Callback URL | `MPESA_CALLBACK_URL` | Public **HTTPS** endpoint: `https://<backend-domain>/api/payments/callback` |
| Environment flag | `MPESA_ENVIRONMENT=production` | Backend fails safe to `sandbox`; the finance UI reports mode honestly |

## 2. Callback infrastructure prerequisites

1. Backend deployed on a public host with a valid TLS certificate (Let's Encrypt or provider cert). Daraja rejects plain HTTP and self-signed certs.
2. `POST /api/payments/callback` reachable from the internet; firewall/security-group allow-list Safaricom egress.
3. The callback endpoint authenticates by verifying the transaction exists in our `mpesa_transactions` ledger (created at STK-push time) — the listener then creates the finance `Payment` **idempotently** keyed on the provider transaction id. This is implemented and covered by `FinanceApiTest` (replay → one payment). What is NOT verifiable without production credentials: Daraja's real callback payload shape/signature at the edge — verify against the first real callback and, if Daraja signs callbacks, add edge signature verification before enabling real collections.
4. Idempotency + audit: every callback logs to the M-Pesa ledger before any finance mutation. Never create payments from frontend claims.

## 3. Verification procedure (after credentials exist)

1. Set the five env vars in the deployment secret store; restart backend with `MPESA_ENVIRONMENT=production`.
2. UI check: `/finance` and `/guardian/fees` must now show production mode (no "Production M-Pesa not configured" banner).
3. STK-push one real KES 1 payment from a guardian account → confirm the prompt arrives on the phone.
4. Complete the payment → verify in PostgreSQL: one `mpesa_transactions` row, ONE `payments` row (idempotency), allocation against the intended charge, derived balance reduced, receipt retrievable.
5. Replay safety: re-deliver the same callback (Safaricom retries on timeout) → assert still exactly one payment.
6. Failure path: cancel the prompt on the phone → no payment row, no allocation, charge balance unchanged.
7. Only after 1–6 pass: switch a pilot school on for real fee collection.

## 4. Rollback / incident

- To disable collections: unset `MPESA_CONSUMER_KEY` (or set `MPESA_ENVIRONMENT=sandbox`) and restart — the UI returns to the honest not-configured state; no code change needed.
- Manual payments remain available to authorized school admins regardless of M-Pesa state (cash/bank records with `recorded_by` audit).

## 5. Cross-references

- Domain model + idempotency evidence: `docs/RELEASE_TEST_MATRIX.md` (2026-09-17 section)
- Deployment env contract: `docs/DEPLOYMENT_RUNBOOK.md`
- Local one-command staging verification: `scripts/staging-gate.sh`
