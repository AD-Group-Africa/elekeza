# Payment Security Sprint 2 — Final Report

**Date:** 2026-10-21 · **Repo:** Elekeza · **Branch:** `feat/elekeza-pilot-completion`
**HEAD at start and at finish:** `1299c5bebbc2bb0a82c072b4fde347e04a73a27b` (unchanged — nothing was committed, staged, pushed or deployed)
**Scope:** validation and targeted hardening of the Sprint 1 M-Pesa payment-security remediation. Not a rewrite.

---

## 1. Baseline and document references

| Document | Content |
|---|---|
| `docs/PAYMENT-SECURITY-SPRINT-2-BASELINE.md` | Phase 0 — verified starting state, pre-existing modifications, available infrastructure, blocked dependencies |
| `docs/PAYMENT-V18-POSTGRES-VALIDATION.md` | Phase 1 — V18 migration evidence against PostgreSQL 15.17 |
| `docs/PAYMENT-DARAJA-SANDBOX-VERIFICATION.md` | Phase 2 — Daraja sandbox status, 14-check coverage map |
| `docs/PAYMENT-EDGE-ALLOWLIST-OPERATIONS.md` | Phase 3 — edge allowlist operational enforcement report |
| `docs/PAYMENT-EVENT-AUDIT.md` | Phase 4 — event catalogue, schemas, redaction rules, uncovered transitions |
| `docs/PAYMENT-SECURITY-REMEDIATION-2026-10-16.md` | Sprint 1 remediation report, §8 addendum added by this sprint |
| `backend/flyway-validation/` | Reproducible Flyway/PostgreSQL runner used for Phase 1 (no application dependencies added) |

Baseline facts verified at sprint start (not assumed): HEAD `1299c5b`, branch
`feat/elekeza-pilot-completion`, 5 pre-existing modified tracked files and 16
untracked files (Sprint 1 payment work + governance documents), all preserved.

## 2. Results for Phases 2–5

| Phase | Result | Evidence |
|---|---|---|
| 0 — Baseline & inspection | **PASS** | `docs/PAYMENT-SECURITY-SPRINT-2-BASELINE.md` |
| 1 — V18 on PostgreSQL | **PASS** | `docs/PAYMENT-V18-POSTGRES-VALIDATION.md` |
| 2 — Daraja sandbox | **BLOCKED** (live round-trip) / **PASS** (protocol conformance) | `docs/PAYMENT-DARAJA-SANDBOX-VERIFICATION.md` |
| 3 — Edge callback allowlist | **NOT ENFORCED** (prepared + documented) | `docs/PAYMENT-EDGE-ALLOWLIST-OPERATIONS.md` |
| 4 — Payment lifecycle audit events | **PASS** | `docs/PAYMENT-EVENT-AUDIT.md` |
| 5 — Regression, Git review, verdict | **PASS** | this document |

### Phase 1 detail (summary)

PostgreSQL 15.17 on `localhost:5433`, isolated disposable databases, real
Flyway 9.22.3 + `org.postgresql:postgresql:42.6.2` (the versions Spring Boot
3.2.4 resolves), production migration configuration mirrored.

- Clean install V1→V18: **PASS** (18 applied, exactly one V18 history row,
  `VALIDATE OK`).
- Schema inspection: `ux_payment_checkout_request_id` and
  `ux_mpesa_tx_checkout_request_id` unique indexes present in
  `pg_indexes`; `verification_attempts integer NOT NULL DEFAULT 0`,
  `next_verification_at` / `last_verified_at` `timestamptz NULL`.
- Schema ↔ JPA model: packaged app booted against the migrated DB with
  `ddl-auto=validate` — Hibernate validation passed.
- Upgrade V17→V18 with historical rows: **PASS** (rows preserved, new
  columns defaulted, no data mutated).
- Duplicate `payments.checkout_request_id`: migration **fails closed** —
  exit 1, SQLSTATE `23505`, `could not create unique index`, **entire V18
  statement batch rolled back** (PostgreSQL transactional DDL), no partial
  schema, data intact.
- Duplicate `mpesa_transactions.checkout_request_id`: identical safe failure.
- Re-run after success: `applied=0`, no schema mutation.
- Live constraint enforcement: duplicate insert rejected; multiple NULL keys
  allowed.
- **NOT VERIFIED:** concurrent duplicate callbacks on PostgreSQL (the app-level
  concurrency proof runs on H2) — recorded as such, not glossed over.

### Phase 2 detail (summary)

- **No authorised Daraja sandbox credentials exist in this environment** (no
  `MPESA_*` variables, no Daraja app), so **no live sandbox transaction was
  performed**. Reported as `BLOCKED`, not as "verified".
- Network probe with a deliberately invalid placeholder credential: the
  documented sandbox host **is reachable** (DNS + TLS + provider edge,
  `X-CDN: Imperva`, `x-request-id` echoed) and answers an invalid credential
  with **HTTP 400 and an empty body** — a finding the implementation must
  treat as `Unavailable` (fail closed), never as success.
- `LiveMpesaStatusVerifierHttpTest` (6 tests, scripted provider responses on
  the verifier's own `RestTemplate`): OAuth 200 → `Confirmed`; OAuth 401 →
  `Unavailable`; read timeout → `Unavailable`; in-flight `500.001.1001` →
  `Unavailable`; `ResultCode=1032` → `NotSuccessful`; unconfigured live mode →
  `Unavailable`. Request contract asserted (URLs, method, `BusinessShortCode`,
  `Password`, `Timestamp`, `CheckoutRequestID`, `Authorization: Bearer`).
- All 14 required checks are mapped to a proven test or explicitly marked
  `BLOCKED` in the Phase 2 document.

### Phase 3 detail (summary)

- Enforcement state: **not enforced in any environment**. The nginx template
  now carries a **commented, placeholder-based** `location =
  /api/payments/callback` block (`allow` / `deny all`, 30 s proxy timeout,
  `X-Real-IP`/`X-Forwarded-Proto`) that ships **inert**.
- No IP range is hardcoded: no authorised Safaricom source was obtainable in
  this environment (the developer portal is a JavaScript-rendered,
  Imperva-fronted app whose documentation body could not be extracted — page
  shell only, `read_url` → HTTP 408; the only "whitelist" string in the served
  bundles is the Joi validation library). The placeholder uses RFC 5737
  documentation space, so a careless enablement fails **closed** (403).
- The document states the deployment dependencies (authorised IP source, edge
  placement, true-client-IP resolution, non-allowlist as payload
  authentication, operational ownership) and the 5-step manual verification
  procedure to be run against the deployed environment.

### Phase 4 detail (summary)

- 14 distinct payment-lifecycle audit events, 15 call sites, all through the
  existing `AuditLogService` (category `PAYMENT`): `MPESA_INIT`,
  `MPESA_INIT_REJECTED`, `MPESA_STK_ACCEPTED`, `MPESA_STK_REVIEW`,
  `MPESA_CALLBACK`, `MPESA_CALLBACK_UNKNOWN`, `MPESA_CALLBACK_DUPLICATE`,
  `MPESA_CALLBACK_MISMATCH`, `MPESA_REFUSED`, `MPESA_AWAITING`,
  `MPESA_CREDIT_APPLIED`, `MPESA_RECONCILE_RETRY`, `MPESA_RECONCILED`,
  `MPESA_RECONCILE_ESCALATED`.
- Redaction is by construction (each call site builds an allow-listed
  `detail` string; no generic payload-dump path into the audit table; no
  tokens, keys, passkeys, phone numbers or raw provider bodies).
- Audit writes are `@Async` and best-effort: an audit failure can never roll
  back or lose a financial record; the ledger remains the only financial
  truth.
- New assertions added to `MpesaCallbackVerificationTest` (audit row present
  for each of: callback accepted, awaiting-verification, refused,
  credit-applied, duplicate, unknown-id, amount-mismatch) with a bounded poll
  helper because the write is asynchronous.

## 3. Changes implemented and their associated tests

Tracked files modified by this sprint (diff is against HEAD `1299c5b`, which
also contains Sprint 1's work in the same files):

| File | Sprint 2 change |
|---|---|
| `backend/src/main/kotlin/com/elekeza/backend/finance/FinanceService.kt` | audit events for initiation accepted / rejected and for the credit being applied |
| `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaService.kt` | audit events for STK accept / review and the full callback decision tree |
| `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaReconciliationService.kt` (untracked, Sprint 1 file) | audit events for reconcile retry / resolution / escalation |
| `infrastructure/nginx/templates/nginx.conf.template` | commented, placeholder-based callback allowlist block + operator guidance |
| `backend/src/test/kotlin/com/elekeza/backend/payments/MpesaCallbackVerificationTest.kt` (untracked, Sprint 1 file) | 9 new audit-event assertions across 6 scenarios + the `awaitAudit` polling helper |
| `docs/PAYMENT-SECURITY-REMEDIATION-2026-10-16.md` | §8 Sprint 2 addendum (what changed about the Sprint 1 limitations) |

New untracked deliverables: `docs/PAYMENT-SECURITY-SPRINT-2-BASELINE.md`,
`docs/PAYMENT-V18-POSTGRES-VALIDATION.md`,
`docs/PAYMENT-DARAJA-SANDBOX-VERIFICATION.md`,
`docs/PAYMENT-EDGE-ALLOWLIST-OPERATIONS.md`, `docs/PAYMENT-EVENT-AUDIT.md`,
`docs/PAYMENT-SECURITY-SPRINT-2-REPORT.md` (this file), and
`backend/flyway-validation/` (Phase 1 runner + logs).

**No application API, schema, or existing security control was weakened. No
financial record was modified, deleted or re-assigned at any point.**

## 4. Remaining security and operational gaps

| Gap | Severity | Status |
|---|---|---|
| Live Daraja round-trip unverified (no credentials) | **High** | Open — external, owner-side |
| Edge callback IP allowlist not enforced anywhere | **High** | Open — infrastructure change + manual verification steps documented |
| No refund / reversal / chargeback flow, therefore no audit events for one | Medium | Open — not implemented anywhere in the product |
| No administrative workflow to resolve a `REQUIRES_REVIEW` transaction | Medium | Open — flagged for design |
| Payment audit evidence purged after 90 days while payment rows are kept indefinitely | Medium | Open — needs a finance/compliance decision (exempt or archive `category='PAYMENT'`) |
| Pre-initiation authorisation failures are not in the payment audit stream | Low | Accepted (visible in access logs only) |
| Audit writes are asynchronous → "eventually consistent" evidence, not atomic with the payment | Low | Accepted by design (audit must not block or fail payments) |
| Audit-trail *reads* are not themselves audited | Low | Open |

## 5. Sandbox versus live-verification status

| Layer | Verified? | How |
|---|---|---|
| Business logic and state machine | **Yes** | Unit/integration tests against the real service and database |
| HTTP semantics of the live verifier | **Yes (scripted)** | `LiveMpesaStatusVerifierHttpTest` on the verifier's own `RestTemplate` |
| Network reachability of the sandbox host | **Yes (probe)** | HTTPS 400 + empty body for an invalid credential; TLS/connect timings recorded |
| **Live sandbox transaction (real STK push → callback → query → credit)** | **NO — BLOCKED** | No authorised credentials in this environment; not attempted, not simulated |
| **Production Daraja** | **NO — out of scope** | Never attempted; production credentials are forbidden for this work |

**Nothing in this sprint is evidence of a live provider round-trip.**

## 6. Actual edge-enforcement evidence

**There is none — enforcement does not exist in any environment.** What exists:

- a shipped-inert nginx block with a non-routable placeholder and explicit
  operator comments;
- a written procedure for obtaining authorised IPs, placing the edge, resolving
  the true client IP, and proving enforcement (5 steps: allowlisted source
  succeeds, non-allowlisted source gets 403 at the edge with no application
  log line, allowlisted source demonstrably reaches the app, spoofed
  `X-Forwarded-For` still rejected, provider-change drill).

A configuration variable plus a document is **not** allowlisting, and this
report does not claim otherwise.

## 7. Audit-event coverage and redaction results

- Coverage: initiation (accepted/rejected), provider request (accepted/review),
  callback (accepted/unknown/duplicate/mismatch/refused/awaiting), credit
  applied, reconciliation (retry/resolved/escalated) — 14 events.
- Uncovered: refunds/reversals (feature absent), manual adjustments (feature
  absent), administrative review resolution (feature absent),
  pre-initiation authorisation failures (by design).
- Redaction verified: no credentials, tokens, passkeys, phone numbers, raw
  provider bodies or raw exception payloads are written; the audit `detail`
  strings are built from an explicit field allowlist at each call site.
- Access: audit rows are readable only through `GET /api/admin/audit`
  (`hasRole('ADMIN')`).
- Retention: 90-day purge — flagged as a gap against indefinite payment-record
  retention.

## 8. Regression outcomes and Git preservation review

| Check | Command | Result |
|---|---|---|
| Backend compile | `cd backend && ./gradlew compileKotlin compileTestKotlin` | **PASS** (exit 0) |
| Backend full suite | `cd backend && ./gradlew test` | **PASS** — 47 test classes, **321 tests, 0 failures, 0 errors, 0 skipped**, `BUILD SUCCESSFUL in 4m 24s` |
| Focused payment suite | `./gradlew test --tests "…payments.Mpesa*" --tests "…finance.FinanceApiTest" --tests "…PaymentUniquenessConstraintTest"` | **PASS** (`BUILD SUCCESSFUL in 1m 26s`) |
| Audit-assertion suite | `./gradlew test --tests "…MpesaCallbackVerificationTest"` | **PASS** — 8 test cases, 0 failures |
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | **PASS** (exit 0) |
| Frontend tests | `cd frontend && npx vitest run` | **PASS** — 4 files / 20 tests passed (exit 0) |
| Frontend production build | `cd frontend && npx next build --webpack` | **PASS** (exit 0) |
| V18 on PostgreSQL 15.17 | see `docs/PAYMENT-V18-POSTGRES-VALIDATION.md` | **PASS** |

Git preservation review (`git status --short`, `git rev-parse HEAD`,
`git diff --cached --stat`):

- **HEAD unchanged** (`1299c5b`) — nothing committed, nothing pushed, nothing
  deployed.
- **Index empty** — nothing staged.
- Pre-existing Sprint 1 modifications (`FinanceEntities.kt`, `MpesaEntities.kt`,
  `MpesaService.kt`, `FinanceService.kt`) and pre-existing unrelated work
  (`docs/AUDIT_2026-10-15_FINAL_PILOT_READINESS.md`,
  `frontend/src/app/super-admin/page.tsx`) are **preserved and untouched** by
  this sprint's documentation work.
- All Sprint 1 untracked files remain untracked and intact; 24 untracked
  entries at sprint end (Sprint 1 + governance + this sprint's new docs and
  the Phase 1 runner).
- `frontend/public/sw.js` is regenerated by `next build` (build-id and chunk
  hashes change because `frontend/src/app/super-admin/page.tsx` is dirty in
  the worktree). It is a generated artefact; no hand-edited content was
  changed.
- One stale sprint-created artefact (`v18_app_pid.txt`, a PID file from the
  Phase 1 Hibernate-validate boot) was removed; the process it referenced is
  not running and the validation port (18999) is not listening. Pre-existing
  listeners on 8080 and 18080 belong to other processes and were not touched.
- **No** `git reset --hard`, `git clean`, `git checkout --`, or other
  destructive command was run at any point in this sprint.

## 9. Outstanding manual actions, dependencies and owners

| # | Action | Owner | Dependency |
|---|---|---|---|
| 1 | Provision a Daraja **sandbox** app; provide `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` as env vars (never in git/chat) | Product owner / ops | Safaricom account |
| 2 | Publish a public HTTPS `MPESA_CALLBACK_URL` reachable from Safaricom | Ops | Domain + TLS + ingress |
| 3 | Run the four sandbox scenarios (successful payment ⇒ exactly one payment + one credit; cancellation ⇒ FAILED + zero credits; duplicate callback ⇒ still one credit; unknown callback ⇒ rejected) and record the evidence | Backend + ops | 1, 2 |
| 4 | Obtain the authorised Daraja callback source ranges; fill the nginx allowlist block; deploy at the edge; run the 5-step enforcement verification | Ops | Safaricom support channel + edge deployment |
| 5 | Decide the audit-retention treatment for `category='PAYMENT'` (exempt from the 90-day purge / archive) | Finance / compliance owner | Policy decision |
| 6 | Design the administrative `REQUIRES_REVIEW` resolution workflow (must emit `MPESA_REVIEW_RESOLVED`) | Product + backend | Product decision |
| 7 | Decide the refund/reversal design (must reverse allocations and emit audit events) | Product + backend | Product decision |
| 8 | Re-run the Phase 1 PostgreSQL validation against a **staging** database copy before the production release | Ops + backend | Staging environment |

## 10. Final verdict

### Code correctness — **VERIFIED**
The payment integrity model is implemented and exercised by 321 passing backend
tests: callback trust (never credit on a payload alone), amount matching,
unknown-id rejection, terminal-state immutability, idempotency under
concurrency, bounded reconciliation with escalation, and database-level unique
constraints proven to exist in PostgreSQL.

### Integration verification — **NOT VERIFIED (BLOCKED)**
No live Daraja sandbox round-trip was performed. The HTTP contract is proven
only against scripted provider responses. The provider is reachable from this
environment, and its rejection semantics are known, but no payment was
executed.

### Operational security — **NOT ENFORCED**
The callback endpoint is reachable by arbitrary sources in every environment
(the allowlist is prepared and inert). The credit gate limits the damage, but
the network control does not exist. The Daraja callback carries no signature,
so the allowlist is the only available source filter and it is not deployed.

### Release readiness — **CONDITIONALLY READY FOR CONTROLLED TESTING**
The code is sound enough for a supervised, non-production trial of the payment
journey in **mock mode** (which the UI already labels honestly) and for a
staging pilot in which the V18 migration has been re-validated against a
staging database.

It is **NOT READY for production payments** while the two open High items
remain: (a) the live Daraja round-trip is unverified, and (b) the edge
allowlist is unenforced. Both are owner-side infrastructure/credential
dependencies, not code work; the code paths that would satisfy them are
implemented, tested and documented.

**Recommended next milestone:** execute outstanding actions 1–4 and record the
evidence. When a single successful sandbox payment, a cancelled payment, a
duplicate callback and a 403-from-a-foreign-source edge test are all filed,
this verdict can be upgraded to **READY FOR THE SPECIFIC VERIFIED RELEASE
SCOPE** (sandbox M-Pesa with edge allowlisting enabled) — and only then.

**No overall completion percentage is quoted**, because a percentage computed
against an undefined feature inventory would be theatre. The verifiable
statements are the ones above: 321/321 backend tests, 20/20 frontend tests,
clean typecheck, successful production build, V18 proven on PostgreSQL
15.17, 14 payment lifecycle audit events implemented and asserted — and two
named, unproven, external dependencies.
