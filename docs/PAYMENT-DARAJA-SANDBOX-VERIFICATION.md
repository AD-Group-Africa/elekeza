# Phase 2 — Daraja Sandbox Verification (M-Pesa STK Push Query)

**Date:** 2026-10-21 · **Sprint:** Payment Security Sprint 2
**Scope:** verify the live STK Push Query implementation (`LiveMpesaStatusVerifier`)
against the authorised Daraja sandbox, and map the 14 required checks.

**Headline verdict: `BLOCKED` for the live round-trip; `PASS` for protocol
conformance at the HTTP boundary (scripted, no network).**
No live sandbox transaction was performed. Nothing in this document claims a
sandbox round-trip that did not happen.

---

## 1. Why the live round-trip is BLOCKED (evidence, not assumption)

### 1.1 Credentials

```
$ env | grep -iE "^(MPESA|SAFARICOM|DARAJA)" | sed 's/=.*/=<set>/'
(no output)
```

No `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`,
`MPESA_SHORTCODE` or `MPESA_CALLBACK_URL` exists in this environment, and no
Daraja sandbox app is provisioned for it. The Sprint 2 mission allows only
"authorised sandbox credentials already provided for this environment" — none
are present, so a real STK push + query + callback cycle cannot be executed.

**Consequence:** any statement of the form "verified against the Daraja
sandbox" would be false. It is therefore recorded as `BLOCKED` and the
unblocking step is listed in §5.

### 1.2 Network reachability to the documented sandbox host (probe only)

The sandbox OAuth endpoint was probed **with a deliberately invalid, non-secret
placeholder credential** to establish routing/TLS and the provider's own
rejection semantics. No real credential was used, transmitted or stored.

```
$ curl -s -D - -o /tmp/mp_body.txt --max-time 25 \
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
    -H "Authorization: Basic $(printf 'not-a-real-key:not-a-real-secret' | base64 -w0)"
HTTP/1.1 400 Bad Request
content-type: text/plain
x-request-id: 02360bcf-5c93-432b-886d-01396a55f6fd
content-length: 0
Strict-Transport-Security: max-age=31536000
X-CDN: Imperva

--- BODY ---
(empty)

$ curl -s -o /dev/null -w "connect=%{time_connect}s tls=%{time_appconnect}s total=%{time_total}s http=%{http_code}\n" ...
connect=0.098053s tls=0.259934s total=0.585106s http=400
```

What this proves:

- The documented sandbox host **is reachable** from this environment: DNS
  resolves, TLS 1.x negotiates, and the request reaches Safaricom's edge
  (`X-CDN: Imperva`, `x-request-id` echoed).
- The provider answers an invalid Basic credential with **HTTP 400 and an
  empty body** — not 200, not 401. This is a **semantic finding the
  implementation must tolerate**: a non-2xx status must be treated as
  "verification unavailable" (fail closed), never as success.
- Timing: connect 0.098 s / TLS 0.260 s / total 0.585 s — well inside the
  client's timeout budget.

What this does **not** prove: that a correctly credentialed request returns
`access_token`, and nothing about the STK Push Query response contract for a
real transaction.

---

## 2. Protocol conformance — scripted at the HTTP boundary (PASS)

`backend/src/test/kotlin/com/elekeza/backend/payments/LiveMpesaStatusVerifierHttpTest.kt`
binds `MockRestServiceServer` to the **same `@Primary RestTemplate` the live
verifier uses**, so request construction, headers, URLs, auth and response
mapping are exercised as written — with no network and no credentials.

| # | Scripted provider behaviour | Expected outcome | Result |
|---|---|---|---|
| 1 | OAuth 200 `{"access_token":"…"}` then Query `ResultCode=0` | `Confirmed` | PASS |
| 2 | OAuth 401 | `Unavailable` (fail closed) | PASS |
| 3 | Query read timeout (`SocketTimeoutException`) | `Unavailable`, never success | PASS |
| 4 | Query in-flight error body `500.001.1001` | `Unavailable` (keep retrying) | PASS |
| 5 | Query `ResultCode=1032` (request cancelled) | `NotSuccessful` | PASS |
| 6 | Live mode with empty credentials | `Unavailable`, `isConfigured=false` | PASS |

Assertions also pin the request contract: `GET
https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`
and `POST https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query`, with
the documented body fields `BusinessShortCode`, `Password`, `Timestamp`,
`CheckoutRequestID` and `Authorization: Bearer <token>`.

**Scope limit (stated, not hidden):** these are *scripted* provider responses.
They prove the code reacts correctly to those response shapes; they are **not**
proof that Safaricom's sandbox returns those shapes for a real transaction.
That remains `NOT VERIFIED` until authorised credentials exist.

---

## 3. The 14 required checks — coverage map

Legend: **PASS** = proven by a test in this repository · **BLOCKED** = needs
authorised sandbox credentials + a public callback URL · **PASS (code)** =
proved by the state machine/unit tests without a provider.

| # | Required check | Status | Where it is proven |
|---|---|---|---|
| 1 | OAuth token acquisition, expiry and error handling | PASS (code) / **PARTIAL — live BLOCKED** | `LiveMpesaStatusVerifierHttpTest` #1,#2,#6; token acquisition is per-call, failures → `Unavailable` |
| 2 | STK Push Query request construction + authentication | PASS (code) / live BLOCKED | `LiveMpesaStatusVerifierHttpTest` (URL, method, body fields, Bearer) |
| 3 | Successful provider verification, correct interpretation | PASS (code) / live BLOCKED | #1; `ResultCode=0` → `Confirmed` |
| 4 | Pending / incomplete transaction outcome | PASS (code) / live BLOCKED | #4 (`500.001.1001` → `Unavailable`, row stays non-terminal) |
| 5 | Explicit failed / rejected outcome | PASS (code) / live BLOCKED | #5 (`1032` → `NotSuccessful` → `FAILED`, no credit) |
| 6 | Invalid / unexpected response | PASS (code) | Non-`ResultCode` body → `Unavailable`; unknown fields ignored |
| 7 | Timeout, connection failure, throttling, auth failure | PASS (code) / live BLOCKED | #2,#3; any exception → `Unavailable`; **HTTP 400 with empty body (the provider's real answer to a bad credential) is also `Unavailable`** |
| 8 | Callback received before provider status conclusive | PASS | `MpesaCallbackVerificationTest` "unverifiable success … parks the transaction" → `AWAITING_VERIFICATION`, no credit |
| 9 | Duplicate callback delivery | PASS | `MpesaCallbackVerificationTest` "confirmed success is idempotent when the callback is replayed" + `MpesaIdempotencyConcurrencyTest` (4 concurrent callbacks ⇒ 1 payment) |
| 10 | Callback claims success but independent verification does not confirm | PASS | `MpesaCallbackVerificationTest` "provider says not successful so the callback claim is refused" → `FAILED`, no credit |
| 11 | Reconciliation retries, bounded attempts, escalation | PASS | `MpesaReconciliationTest` (retry scheduled, `REQUIRES_REVIEW` after max attempts, no-op when not live) |
| 12 | Provider accepted, initiation response lost | PASS (code) | Durable `PENDING` intent written **before** the provider call; `MpesaReconciliationTest` "intent without checkout id ⇒ escalated, never credited" |
| 13 | Restart/recovery while a payment is intermediate | PASS (code) | Reconciliation picks up stale non-terminal rows after restart; scheduler is `@Scheduled` and idempotent per row |
| 14 | Concurrent callbacks and reconciliation workers | PASS | `MpesaIdempotencyConcurrencyTest`; conditional-UPDATE claim (`transitionNonTerminal`, `claimVerificationAttempt`) — a second worker is a no-op |

**Financial invariants asserted in every one of these tests:** final payment
state, number of `payments` rows, number of financial credits (fee
allocations), and audit events. A callback body alone never authorises a
credit; an HTTP 200 alone is never read as success.

---

## 4. Security properties re-verified (code + tests)

- **A callback payload alone never authorises a credit.** Credit happens only
  after `VerificationOutcome.Confirmed` from the STK Push Query (live mode) or
  via the mock gateway (non-live, dev/test only).
- **HTTP 200 is not success.** Success requires the documented `ResultCode == 0`
  *inside* the JSON body; a 200 with an error body is `Unavailable`.
- **No double credit.** Unique indexes on `payments.checkout_request_id` and
  `mpesa_transactions.checkout_request_id` (V18, validated on PostgreSQL — see
  `docs/PAYMENT-V18-POSTGRES-VALIDATION.md`) plus conditional-UPDATE claims
  plus application-level pre-checks.
- **Terminal states are never reopened.** A replayed or forged success body
  cannot flip a `FAILED`/`COMPLETED` row (test: "a conflicting success callback
  cannot overwrite a terminal transaction").
- **No secrets in logs.** The verifier logs correlation ids and status names
  only; consumer key/secret, passkey and bearer tokens are never logged
  (`LiveMpesaStatusVerifier` reads them from configuration and passes them in
  headers only).

---

## 5. What is required to unblock the live sandbox round-trip

Owner-side (no code change needed):

1. Provision a Daraja **sandbox** app and provide `MPESA_CONSUMER_KEY`,
   `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` as environment
   variables (never committed, never pasted into chat).
2. Expose a public HTTPS `MPESA_CALLBACK_URL` reachable from Safaricom
   (Daraja rejects plain HTTP and self-signed certificates).
3. Set `fees.mpesa-mode=live` and `MPESA_ENVIRONMENT=sandbox`.

Then, and only then, execute and record:

- One sandbox STK push → provider callback → independent STK Push Query →
  exactly **one** `payments` row and **one** credit;
- A cancelled payment (`ResultCode=1032`) → `FAILED`, zero credits;
- A duplicate callback delivery → still one credit;
- A callback with no provider-originated transaction → rejected, no credit.

Until those four runs are recorded, this phase stays `BLOCKED` and the
release verdict must treat live Daraja as unverified.

## 6. Official-source note

Safaricom's developer portal is a JavaScript-rendered application fronted by
Imperva; its documentation bodies (Getting Started → "Callback and IP
Whitelisting", M-Pesa Express Query → result-code tables) could **not** be
extracted from this environment (page returns a shell; `read_url` timed out at
HTTP 408; the only "whitelist" string in the JS bundles is the Joi
validation library, not Safaricom content). The result-code semantics used by
the implementation (`0` success, `1032` user-cancelled, `500.001.1001`
in-flight) come from the SDK-maintained request/response shapes recorded in
`docs/PAYMENT-SECURITY-REMEDIATION-2026-10-16.md` §1 and are **not** verified
against a live provider response in this sprint.
