# ELEKEZA — PILOT

> Canonical pilot operations reference. Merged from PILOT_PLAN, PILOT_RUNBOOK, role guides,
> pilot-launch, DEMO-ACCOUNTS and the pilot-decision record.

## 1. Objective & timing

The pilot is for **learning, not vanity numbers**: one school, 1–2 classes, 5–15 learners (incl.
2–4 with documented support needs, guardian consent on file), 2–3 teachers, 5–10 guardians,
2 subjects (Mathematics, Science), intermittent connectivity assumed (offline caching from day 1).
Timing: October 2026 usage window; December observe/learn; January 2027 evidence review.

## 2. Pre-launch gate

| # | Gate | Status |
|---|---|---|
| 1 | Backend suite green | ✅ 278/278 |
| 2 | Frontend typecheck/lint/build green | ✅ |
| 3 | Live walkthrough of full learner→guardian→teacher loop on pilot build | ✅ acceptance journey PASS |
| 4 | PostgreSQL staging deployed + smoke-tested | ⬜ blocked on host (B2) |
| 5 | Seed accounts + guardian consent records prepared | ⬜ school-side |
| 6 | AI mode decided and labelled | ✅ honest-labelled mode; real key post-r3 |
| 7 | Backup taken + restore tested once | ✅ drill PASSED |
| 8 | Teacher/guardian orientation delivered | ⬜ week 0 |

## 3. Deployment shape & daily ops

Pilot stack: HTTPS → nginx → Next.js (`next start`) → Spring Boot (prod profile, boot JAR) →
PostgreSQL 15/16 (Flyway). `DEMO_SEED_ENABLED` unset. Real users created via school onboarding +
CSV import + staff management — **not** via demo accounts (those exist only in dev profile /
`DataInitializer`; prod boots with users=0).

Boot order: PostgreSQL → backend JAR → frontend. Health: `GET /actuator/health`.
Backups: nightly `pg_dump` + before every migration day. Logs: stdout + `audit_log` table.

## 4. Escalation map

| Symptom | First check | Escalation |
|---|---|---|
| Login 429 | rate limiter 5/60s per email+IP — expected under shared NAT | infra (allowlist) |
| “M-Pesa is not configured” | expected in mock mode — do not “fix” with prod keys without checklist | owner |
| Blank page after deploy | hard refresh (stale chunk); verify `NEXT_PUBLIC_API_URL` baked into build | release eng |
| Slow first load | dev-mode on-demand compile — use the production build | infra |
| Data looks wrong | check the logged-in account's institution boundary first (tenant scoping) | eng |

## 5. Role quick-guides (merged)

**Guardian (≈20 min first session):** log in with school-registered account → Guardian Dashboard →
child page **Today at a glance** (lessons done, attendance, classwork, fees balance) → progress
history. Fees sidebar during pilot shows test-mode M-Pesa (“Test mode: payment request created
locally” — no real money). Support moves: read a lesson together, ask about past-due classwork,
praise specifics from teacher feedback.

**Learner:** log in → home shows level/stars → **Continue learning** → Next section at own pace →
My Assignments (answer, resubmit to improve — teacher sees best) → quizzes/exams when teacher says.
If something is hard: **How I Learn** (text size, spacing, colours), **Read aloud** buttons; ask the
teacher — it's never your fault when something breaks.

**Teacher (≈30 min first session):** daily — Attendance (pick class/date, mark
Present/Absent/Late/Excused, save; same-day re-save updates, never duplicates; History per learner).
Weekly — Classwork (create with title/instructions/due/points; view submissions; score + feedback;
learner sees both). Honest pilot notes: M-Pesa mock; assignment submissions text-only.

## 6. What we measure (learning questions)

- Learner: comprehension, independent navigation, which accessibility modes help, drop-off,
  offline-queue frequency → completed lessons, quiz scores/attempts, adaptation usage, session length.
- Teacher: dashboard saves time? who needs attention? → support-signal usage, interventions, interviews.
- Guardian: comprehension + usefulness → notification open rates, guardian logins, summary interviews.
- Product: per-lesson funnel, preference-vs-completion correlation, sync-failure rates.

## 7. Privacy rules during pilot

Guardian consent on file for every learner; child-level data visible only to that learner's
teachers/guardians (enforced + tested); pilot reports aggregate only; **no model training on pilot
data**; formal consent tracking + retention workflow are pilot-phase operational requirements.

## 8. Honest known limitations at launch

- AI in clearly-labelled mode (real provider after r3 ships the now-fixed + verified fail-closed auth and the key is provisioned)
- M-Pesa/email/SMS in mock unless credentials provisioned (UI says so)
- Class creation missing (EL-F-007) — classes via seed until decided
- Guardian↔teacher messages stored sender-only (EL-NEW-02) — fix tracked
- Mastery/competency engine not built — progress is lesson/quiz-based
- Accessibility validated by automation + code review; real-user feedback is a primary pilot
  deliverable

## 9. Decision record (pilot gate)

Frozen release `v0.1.0-pilot-r2` (AI release frozen at r2). Decision table and full evidence:
`ELEKEZA_PILOT_DECISION.md` (release-evidence copy). Verdict: **GO for controlled pilot** behind
the PRODUCTION_READINESS.md conditions; Safiri explicitly out of scope for this pilot.
