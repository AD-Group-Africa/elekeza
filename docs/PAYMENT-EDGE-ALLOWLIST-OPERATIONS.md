# Phase 3 — M-Pesa Callback Source-IP Allowlisting: Operational Enforcement Report

**Date:** 2026-10-21 · **Sprint:** Payment Security Sprint 2
**Control:** allowlist the source IPs of Safaricom Daraja callbacks at the
trusted edge, so that the payment callback endpoint is not reachable by
arbitrary internet hosts.

**Enforcement status: `NOT ENFORCED IN ANY ENVIRONMENT` (configuration
prepared, deployment step outstanding, verification outstanding).**
No claim of operational allowlisting is made anywhere in this repository.

---

## 1. What the code does today

| Layer | State | Evidence |
|---|---|---|
| Application (Spring Boot) | **No IP allowlist.** The callback endpoint is `permitAll` by design — the provider cannot hold a session, so the request is unauthenticated by construction. | `SecurityConfig` (`/api/payments/callback` permitted) |
| Application (business logic) | **Independent verification is the real credit gate.** A callback body alone never authorises money: the transaction must exist, be non-terminal, the amount must match, and the provider must confirm the outcome via STK Push Query. | `MpesaService.processCallback`, `MpesaStatusVerifier`, `MpesaPaymentFinalizer` |
| Edge (nginx, this repo) | **Prepared but disabled.** A commented, placeholder-based `location = /api/payments/callback` block with `allow`/`deny all` is present in `infrastructure/nginx/templates/nginx.conf.template`. It ships inert. | template lines ~52-70 |

The control is therefore **defence-in-depth on top of** (not instead of) the
provider-verification gate.

## 2. Why no IP values are hardcoded in this repository

- The allowlist values must come from **Safaricom's authorised channel** for
  the specific Daraja app/environment, not from blog posts, code comments or
  memory. Third-party lists circulate and go stale; copying them into a
  production template is an unverified security control.
- Safaricom's developer portal (which carries the "Callback and IP
  Whitelisting" guidance) is a JavaScript-rendered application fronted by
  Imperva; its documentation body **could not be extracted from this
  environment** (shell page only; `read_url` → HTTP 408 timeout; the only
  "whitelist" string in the served JS bundles is the Joi validation library).
  The official text is therefore **NOT VERIFIED from source in this sprint**
  and no IP range is asserted here.

The template deliberately ships a **placeholder** (`203.0.113.x` — RFC 5737
documentation space, guaranteed not routable) so that the block cannot be
mistaken for a working allowlist.

## 3. Deployment dependencies (all must be true before enabling the block)

1. **Authorised IP source** — the Daraja callback source ranges for the
   deployment's environment, obtained from Safaricom (portal/support channel)
   and recorded in the deployment runbook (not in git).
2. **Edge placement** — the callback URL must terminate at an edge that
   implements the allowlist (the nginx template in this repo, or a managed
   WAF rule). A loopback-only or direct-to-app deployment cannot enforce it.
3. **Real client IP** — the allowlist must evaluate the true source address.
   The template sets `X-Real-IP $remote_addr` and
   `X-Forwarded-For $proxy_add_x_forwarded_for`; if the edge sits behind
   another proxy/CDN, the effective client address must be resolved from the
   chain the edge actually trusts (else the allowlist either blocks everything
   or, worse, trusts a spoofable header).
4. **Shared-secret/second factor** — an IP allowlist is a *network* filter,
   not payload authentication. The Daraja STK callback carries **no
   signature/HMAC** (see `docs/PAYMENT-SECURITY-REMEDIATION-2026-10-16.md` §1),
   so the allowlist must not be presented as the trust anchor. The
   application-level independent verification remains the trust anchor.
5. **Operational ownership** — a named owner must be able to add/remove a
   Safaricom range when the provider changes it, without a code release
   (that is why the values live in deployment configuration, not in the
   template).

## 4. Risks if the control is left unenforced

| Risk | Severity | Mitigation in place today |
|---|---|---|
| Anyone can POST a forged callback to the public endpoint | Medium | Forged bodies cannot create money: the checkout id must exist, the amount must match, and the provider must independently confirm. Unknown ids are rejected and audited. |
| Callback endpoint used for traffic amplification / log spam | Low | Unknown/duplicate callbacks are rejected early and audited (`MPESA_CALLBACK_UNKNOWN`, `MPESA_CALLBACK_DUPLICATE`). |
| Operator confidence in a control that is not actually enforced | **High (process risk)** | This report, the shipped-disabled template, and the release verdict all state `NOT ENFORCED` explicitly. |
| Accidental enablement with placeholder values | Medium | The block ships commented; a placeholder range is non-routable, so a careless enablement fails closed (403) rather than opening a hole. |

## 5. Steps to verify enforcement in the real environment (manual, owner-side)

Run against the **deployed** environment, not locally:

1. **Baseline — allowlisted source.** Trigger a real Daraja callback (or the
   provider's test callback) and confirm `2xx` and that the transaction
   progressed to the expected state.
2. **Negative — non-allowlisted source.** From a host outside the allowlist
   (e.g. a laptop on a different network) POST a minimal callback body to
   `https://<domain>/api/payments/callback` and confirm **HTTP 403** at the
   edge, with **no** application log line for the transaction (i.e. the
   request never reached the app) and **no** audit row.
3. **Positive — allowlisted source reaches the app.** Confirm from the app
   side that the request was received (audit row `MPESA_CALLBACK`), proving
   the block is a true allowlist and not a blanket 403.
4. **Spoofing check.** Send a request with a forged `X-Forwarded-For` /
   `X-Real-IP` header from a non-allowlisted address; it must still be
   rejected (403). This proves the edge does not trust client headers.
5. **Provider change drill.** Re-run 1–3 after any Safaricom IP change, and
   record the outcome in the runbook.

Evidence to file: the HTTP status codes, the timestamps, and the redacted edge
log lines for steps 1–4. Until steps 1–4 are recorded for a given
environment, that environment's allowlist status is `NOT VERIFIED`.

## 6. What this repository changed (Phase 3)

- `infrastructure/nginx/templates/nginx.conf.template` — added a **commented,
  placeholder-based** `location = /api/payments/callback` block with
  `allow`/`deny all`, `X-Real-IP`/`X-Forwarded-Proto` headers, a 30 s proxy
  read timeout, and an explicit comment that this is a network filter, not
  payload authentication, and that the IPs must be CONFIRMED from Safaricom's
  authorised channel.

**Not changed:** no application code, no security config, no test assertion
was weakened, and no allowlist is claimed to be active. The shipped block is
inert and self-documenting.
