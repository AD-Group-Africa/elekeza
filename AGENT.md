# AGENT.md — Elekeza Engineering Operating Contract

Elekeza is an inclusive-education learning platform (Next.js frontend, Kotlin/Spring Boot backend, FastAPI AI service, PostgreSQL). Work on this repository as an engineer taking ownership, not as a code generator.

## Source of truth

1. The repository and its **runtime behaviour** are the source of truth.
2. Documentation, old reports and TODO files are historical evidence only. If docs conflict with code, **code wins**. If tests conflict with runtime behaviour, **runtime wins**.
3. Never claim something works because a button exists, a page renders, an endpoint returns 200, a mock exists, a test mocks the whole flow, or a README says so. Claim it only after you have run it.

## Workflow

- INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → VERIFY → RE-AUDIT.
- After any substantial change, re-run the relevant gate and re-scan for regressions. Do not trust the first audit.
- Make the smallest coherent change; prefer editing existing files; verify a library is already used before adding it.

## Hard rules

- **No fake completion.** Every feature is classified honestly:
  `VERIFIED` · `PARTIALLY VERIFIED` · `BLOCKED (external dependency)` · `MOCKED` · `NOT IMPLEMENTED`.
  Mock behaviour must be clearly labelled, never dressed up as real.
- **No secrets in the repository.** No real API keys, JWT secrets, DB passwords, M-Pesa/Africa's Talking/R2/cloud credentials — in source, tests, docs, logs or YAML. Use environment variables; keep `.env.example` as placeholders only. Before finishing, scan for secret-shaped strings and scrub history if any were committed.
- **AI must be genuinely wired or explicitly marked unavailable.** AI provider calls go through the backend (never straight from the browser); requests/responses are validated; failures degrade gracefully with honest messaging. A real provider key that returns 401 = BLOCKED, not broken code.
- **Security and tenancy first.** Authentication and role/institution/ownership checks belong on the backend for every object fetch by ID (IDOR). Check: unauthenticated access, wrong-role access, cross-user/cross-institution access, assignment/content/quiz-answer ownership, upload validation, CORS origins (never `*` with credentials), CSRF, and never log secrets.
- **PostgreSQL/Flyway integrity.** The DB is the system of record. Migrations must run cleanly from a fresh database and match JPA entities (`ddl-auto=validate` in prod). Additive schema changes go in new numbered migrations — never rewrite or delete applied migrations.
- **Real flows.** Teacher upload → storage → (AI adaptation) → learner lesson → quiz → durable evidence → progress → teacher intervention must read/write real persisted state through the documented API contract, end to end.
- **Do not run or claim tests you did not execute.** Record exact results.

## Environment & config

- Dev: Spring Boot on H2, `--spring.profiles.active=dev`; mock AI client by default; demo accounts seeded by `DataInitializer` (teacher/student/parent @elekeza.app, see README).
- Prod/docker: PostgreSQL via Flyway; every external provider (AI, SMS, email, R2 storage, M-Pesa) reads its credentials from the environment only. Required production variables missing → fail fast, never an insecure default.
- If a required external service/credential is unavailable locally, leave the code structurally correct, label the dependency, and record it in `ELEKEZA-AUDIT.md`.

## Deliverable

Keep `ELEKEZA-AUDIT.md` at the repository root current: executive status, architecture, verified vs blocked vs mocked features, security/database/config status, and an evidence-based acceptance matrix.
