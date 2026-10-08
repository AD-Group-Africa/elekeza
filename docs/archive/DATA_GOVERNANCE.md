# DATA_GOVERNANCE — Elekeza

Scope: how learner data is protected, collected and governed — separating **verified enforcement** from **policy/process**.

## Data categories (three different things, never conflated)

| Category | Definition | Current state |
| --- | --- | --- |
| **Product analytics** | Which features are used | Minimal; no third-party trackers in the learner app |
| **Learning analytics** | Learning patterns (scores, completion, streaks) | Collected in `analytics` domain; role-scoped access only |
| **Model-training datasets** | Approved, de-identified data for model development | **Does not exist.** No learner data is used for training by default |

## Verified protections (code + tests)

- **Tenant isolation**: institution-scoped access enforced server-side (`ContentAccessGuard`, `@PreAuthorize` on protected endpoints); cross-tenant access covered by `MultiTenantAuthorizationTest` (11 tests), `GuardianAnalyticsAuthorizationTest`, `ContentAuthorizationTest`, `SupportAuthorizationTest` (9 tests)
- **RBAC**: learner/guardian/teacher/admin/super-admin roles enforced server-side on every protected endpoint; foreign-guardian/ward and learner→teacher access attempts return 403 (verified in prior gates)
- **Secrets**: environment variables only; no hardcoded credentials; previously exposed Groq keys redacted (`docs/SECURITY_REMEDIATION.md`)
- **CSRF** on writes; explicit CORS (no wildcard origins); login rate limiting; BCrypt password hashing
- **Safe password recovery**: `/auth/forgot-password` never reveals account existence (regression-tested in `ForgotPasswordEndpointTest`)
- **Audit**: access through authorized, role-scoped controllers; structured logging (SLF4J); Sentry error reporting opt-in via env
- **No advertising use**: learner data is not and will not be treated as an advertising asset

## Children's-data rules

- AI interactions are guarded against exposing private learner information; AI output is validated (`AdaptationSafety`) before caching
- Do **not** use children's identifiable data as model-training data — model-training requires explicit, separately governed, de-identified datasets that currently do not exist
- Never sell learner data; never expose child-level analytics publicly
- Disability-related fields are support needs, not diagnoses; they are not surfaced to other learners, ever

## Policy-layer items (documented, process not code)

- `docs/privacy/DATA_CLASSIFICATION.md` and `DATA_FLOW_MAP.md` exist as classification/flow references
- Retention schedules, deletion-request workflow, consent records, backup encryption-at-rest attestation, and incident-response drill are **pilot-phase operational requirements** — documented, not yet exercised
- Guardian consent for minors' accounts: represented in the guardian relationship model, formal consent tracking is a pilot requirement

## Retention & deletion (current honest state)

- Deleting an institution cascades to its data (FK `ON DELETE CASCADE` in schema)
- Per-learner deletion workflow: **not yet implemented** — flagged as a MUST-HAVE before scale beyond one pilot cohort
