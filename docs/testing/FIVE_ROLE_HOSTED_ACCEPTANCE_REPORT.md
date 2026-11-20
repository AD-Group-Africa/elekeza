# FIVE-ROLE ACCEPTANCE REPORT

**Date:** 2026-11-20 · **Candidate:** `baed7f4` (`consolidation/2026-11-19`)

## Status in one line

**Local (localhost) acceptance: PASS. Hosted acceptance: BLOCKED — no staging environment exists.**
These are different claims and this document does not merge them.

---

## 1. What has actually been run

| Environment | Evidence | Result |
|---|---|---|
| **Local**, real Spring Boot jar + real Next dev server + real browser | Playwright suite, 46 specs, 1 worker, five roles | **46/46 passed**, exit 0 (2026-11-20, re-run after the security-header change — see §2) |
| **Hosted** (Render/Netlify) | — | **Not run.** No environment exists. |

Local runs prove the application works end-to-end when the frontend proxies `/api/*` to a backend on the same
machine. They do **not** prove: TLS, cross-origin cookies, CORS, proxy header handling, managed-database
behaviour, cold-start timing, or real network latency. Every one of those differs on a hosted origin.

---

## 2. Local evidence detail (2026-11-20 run)

Command: `cd frontend && npx playwright test` — boots `elekeza-backend-0.0.1-SNAPSHOT.jar` (dev profile,
port 8090) and `next dev` (port 3100) itself, so the environment is reproducible from a clean checkout.

| Area covered | What the specs assert |
|---|---|
| STUDENT | sign-in, lesson open, section progress, quiz start/answer/complete, progress view, replay guard returns **409** |
| TEACHER | sign-in, learner list scoped to own classes, attendance recording, assignment creation, progress review |
| GUARDIAN | sign-in, linked ward visible, ward progress, messaging, **a different learner's record is refused** |
| SCHOOL_ADMIN | sign-in, institution-scoped staff/learner views, attendance and finance surfaces |
| ADMIN | sign-in, platform-level pages reachable |
| Negative / role guards | learner blocked from an admin page **with no admin API call issued**; teacher blocked from guardian and finance surfaces; unauthenticated deep-link redirects to login |
| Accessibility | axe-core scan on key pages; keyboard focus order; labelled controls |
| Mobile viewport | responsive layout at phone width |
| Messaging | delivery between permitted roles, refusal between non-permitted ones |

Nothing in the suite asserts header values, so the header work is covered separately by
`SecurityHeadersTest` / `HstsHeaderTest` (7 backend tests).

---

## 3. Why hosted acceptance cannot run

| Prerequisite | State |
|---|---|
| A deployed frontend origin | does not exist |
| A deployed backend origin | does not exist |
| A managed PostgreSQL instance | does not exist |
| Synthetic accounts on that environment | cannot exist without the above |
| Account access / cost approval | pending Harrison |

Provisioning is blocked on credentials, not on engineering readiness — see
`docs/deployment/STAGING_DEPLOYMENT_REPORT_2026-11-20.md` §2.

**No URL has been promised to AT4D and none should be until the checklist in §6 passes.**

---

## 4. Synthetic demonstration accounts — the plan

Created on staging only, never in production, never reusing real people's details.

| Role | Suggested identity | Notes |
|---|---|---|
| STUDENT | `learner.demo@elekeza.test` | one linked guardian, one class, 2 lessons, 1 completed quiz |
| TEACHER | `teacher.demo@elekeza.test` | assigned to that class |
| GUARDIAN | `guardian.demo@elekeza.test` | linked **only** to the student above — the negative test depends on this |
| SCHOOL_ADMIN | `admin.demo@elekeza.test` | institution A |
| ADMIN | `platform.demo@elekeza.test` | platform level |
| _Second institution_ | `admin.demo2@elekeza.test` + one learner | **required** to prove cross-institution isolation |

Rules:
- Passwords are generated randomly, stored in the team password manager, and shared with AT4D reviewers through
  a channel Harrison controls — **never in chat, email bodies, git, or a document**.
- Platform ADMIN credentials are **not** issued to external stakeholders (Phase 8 requirement). Reviewers get
  the four role accounts that demonstrate the product; platform admin is demonstrated live by the team.
- All accounts are flagged demo/synthetic and are deleted when the review window closes.

---

## 5. Hosted acceptance procedure (execute the day staging exists)

For each row: capture the URL, the HTTP status and a screenshot. A row is only "pass" if the *hosted* origin
behaved, not if the same journey passed locally.

### 5.1 Positive journeys

| # | Role | Step | Expected |
|---|---|---|---|
| 1 | all | sign in with the role account | 200, `elekeza_access` + `elekeza_refresh` cookies set with `Secure; HttpOnly; SameSite` |
| 2 | STUDENT | open assigned lesson | lesson renders; no console errors |
| 3 | STUDENT | complete a section | progress persists after reload |
| 4 | STUDENT | take the quiz | questions load; submit returns a score |
| 5 | STUDENT | view progress + streaks/badges | numbers consistent with steps 3–4 |
| 6 | STUDENT | use TTS / calm theme / text scale | settings apply and persist across reload |
| 7 | TEACHER | view learners | only own-class learners listed |
| 8 | TEACHER | record attendance | saved; visible on re-open |
| 9 | TEACHER | assign material | appears for the student |
| 10 | TEACHER | review progress | matches the student's view |
| 11 | GUARDIAN | view linked ward | ward visible with permitted progress/fees |
| 12 | GUARDIAN | message the teacher | delivered, visible to the teacher |
| 13 | SCHOOL_ADMIN | manage institution info | saved and re-read correctly |
| 14 | SCHOOL_ADMIN | manage staff and learners | changes reflected in lists |
| 15 | SCHOOL_ADMIN | review attendance + finance | school-scoped totals only |
| 16 | ADMIN | reach platform controls | authorised surfaces load |
| 17 | ADMIN | review platform info | cross-institution data as designed |

### 5.2 Negative tests (these are the ones that matter)

| # | Attempt | Expected |
|---|---|---|
| N1 | STUDENT opens a school-admin URL directly | blocked client-side **and** `403` from the API if forced |
| N2 | TEACHER opens guardian pages | blocked; no guardian API call succeeds |
| N3 | GUARDIAN requests another guardian's ward id | `403`/`404`, **no data in the body** |
| N4 | SCHOOL_ADMIN of institution A requests institution B's learners | empty/`403`, never B's rows |
| N5 | request with an expired access cookie | `401 AUTH_REQUIRED`, frontend refreshes once, then re-login |
| N6 | request with a tampered/garbage token | `401`, no stack trace in the body |
| N7 | unauthenticated call to `/api/teacher/**` | `401`, not `403` (so the client can refresh) |
| N8 | forged `Origin` header on a state-changing call | rejected by CORS |
| N9 | state-changing call without the CSRF token | `403` |
| N10 | 6 rapid failed logins | `429` on the 6th, before any user lookup |
| N11 | response headers on the hosted origin | `strict-transport-security`, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` |
| N12 | request id echo | `X-Request-Id` present; the same value appears in the backend log line |

Automate N1–N4 and N11–N12 as a hosted Playwright project once the URLs exist; N5–N10 are best done by hand
once and then scripted.

---

## 6. Gate definition

Hosted acceptance is **PASS** only when:

- all of §5.1 passes on the hosted origin,
- all of §5.2 returns the expected refusal (a refusal is a pass),
- `X-Request-Id` from a failing request is findable in the backend logs,
- no learner data appears in any log line, response body or monitoring payload,
- the deployment SHA shown in the build log equals the SHA that passed the local suites.

Until then the correct status is **"engineering validated, hosted pilot not ready"**.

---

## 7. Honest limitations of the local evidence

1. The E2E suite runs against a **dev** Spring profile with an **H2-compatible** in-memory database, not
   PostgreSQL. Migration correctness is covered separately by the restore drill, not by E2E.
2. `secure-cookies=false` locally, so `Secure` cookie behaviour is **unproven** until hosted (N11, row 1).
3. CORS is exercised only same-origin through the Next proxy, so cross-origin behaviour is **unproven**
   until hosted (N8).
4. Rate limiting is configured at 100 attempts/60 s in the dev profile (so the suite can log in repeatedly);
   the production value of 5/60 s is verified by backend tests, not by E2E.
5. Android is not part of this acceptance at all — see `ANDROID_RELEASE_READINESS.md`.
