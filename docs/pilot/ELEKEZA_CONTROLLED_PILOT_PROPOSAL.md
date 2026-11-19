# ELEKEZA — Controlled Pilot Proposal

**Status: DRAFT — NOT APPROVED FOR EXECUTION.** This proposal cannot be authorised while any P0 gate in §9 is open. No school has been contacted.

**Date:** 15 November 2026

---

## 1. What this is

A single-school, single-term, deliberately narrow pilot to test whether Elekeza improves guardian awareness of school dates and teacher assignment workflow, under real conditions, without exposing children's data to unmanaged risk.

It is **not** a launch, a rollout, a commercial engagement or a demonstration of every module.

## 2. Objectives

| # | Objective | Measured by |
|---|---|---|
| O1 | Guardians see school dates without chasing the school | % of participating guardians who viewed at least one date; their own reports |
| O2 | Teachers can assign and track reading without extra paperwork | Assignments created per week; teacher time delta |
| O3 | The system survives a real school term without data loss | Uptime; zero unplanned restores; backup success rate |
| O4 | Accessibility aids are usable by the learners who need them | Observed use; guardian/teacher report |
| O5 | We learn what to build next | Validated finding list, ranked |

## 3. Participating institution

| Field | Value |
|---|---|
| School | **to be named** (requires founder authorisation and school agreement) |
| Type / location | to be recorded from discovery |
| Coordinator | named teacher or deputy, agreed with the head teacher |

## 4. Users and scope

| Role | Number | Access |
|---|---|---|
| Guardians | 20–40 (one class) | own linked learners, school dates |
| Teachers | 2–4 | assigned classes, assignments, learner progress |
| Learners | one class (~30–40), supervised | content, own deadlines, accessibility settings |
| School admin | 1 | school-level records for that class only |
| Platform admin | Elekeza staff, named individuals | support access only, logged |

### In scope (pilot)
Guardian accounts and linking · guardian visibility of linked learners · school dates with county scoping · learner viewing of assigned content and deadlines · teacher assignment and progress viewing · accessibility settings (TTS, reading toolbar).

### Explicitly out of scope
Fee payments (`FEES_MPESA_MODE=mock`, no money moves) · SMS/WhatsApp broadcasts · AI tutor in front of children · exams, analytics dashboards, device management · multi-school administration · any marketing.

## 5. Duration and phases

| Phase | Length | Activity |
|---|---|---|
| P0 Onboarding | 1 week | staff accounts, training, guardian consent collection, data-protection sign-off |
| P1 Read-only | 2 weeks | dates and progress visible only; no learner data entered by us |
| P2 Active | 6 weeks | assignments, guardian engagement measured |
| P3 Review | 1 week | data export, findings, go/no-go for continuation |

## 6. Success measures

Quantitative: ≥60% of guardians view at least one date in a term; ≥70% of weekly assignments created in the system; ≥99% uptime during term time; 100% of nightly backups verified; zero cross-role data leaks (tested weekly).

Qualitative: guardians can name one thing the system told them they would otherwise have missed; teachers say it did not add work; no safeguarding incident attributable to the system.

**Failure is acceptable and must be reported**: if guardians do not use it, that is the finding.

## 7. Training and support

- 60-minute teacher session + one-page guide; 30-minute guardian session at the school.
- Named Elekeza support contact with a defined response window (proposed: same school day).
- Weekly 15-minute check-in with the coordinator.
- A printed one-page "who to call" card for staff.

## 8. Data governance

| Item | Position |
|---|---|
| Data minimisation | Name, class, guardian contact, progress events only — nothing more |
| Consent | Guardian consent captured **before** any learner record is created |
| Location of data | per the data-protection review (not yet done) |
| Access | school staff for their class; Elekeza staff only with logged support access |
| Retention | defined period after pilot end, then deletion (policy not yet written — P0) |
| Erasure | on request, with a verifiable process (not yet built — P0) |
| Exports | school owns its data; export on request at pilot end |

## 9. Approval gates (all must be closed before execution)

| Gate | Requirement | Status |
|---|---|---|
| G1 | Hosted staging/production-like environment with HTTPS | **BLOCKED** |
| G2 | Legal/DPIA review for children's data | **OPEN (P0)** |
| G3 | Consent capture implemented | **OPEN (P0)** |
| G4 | Erasure and retention implemented | **OPEN (P0)** |
| G5 | Scheduled, off-site, encrypted backups running | **OPEN (P0)** |
| G6 | Teacher and learner journeys demonstrated end to end | OPEN (P1) |
| G7 | Accessibility pass with assistive technology | OPEN (P1) |
| G8 | Penetration test or external security review | OPEN (P1) |
| G9 | School authorisation and named coordinator | NOT STARTED |
| G10 | Incident response and support rota documented | OPEN (P2) |
| G11 | Rollback rehearsed on the host | OPEN (P1) |

## 10. Incident response (draft)

1. **Detect**: teacher/guardian report, healthcheck, or error alert.
2. **Contain**: disable the affected feature flag or take the stack down (`docker compose down`); preserve logs.
3. **Assess**: does this involve personal data? If yes, notify the school within 24 hours and follow the DPA breach process (to be written with legal input).
4. **Recover**: restore from the last verified dump (`scripts/db-restore-drill.sh` proves it first).
5. **Review**: written post-incident note to the founder within one week.

## 11. Feedback cycles

Weekly: teacher check-in, guardian short survey (3 questions), usage review. Mid-pilot: one guardian session. End: validation summary per `ELEKEZA_SCHOOL_VALIDATION_PLAN.md` §6.3.

## 12. Exit and rollback

- **Exit trigger**: any P0 safety/privacy incident, school withdrawal, or two consecutive weeks of no usage.
- **Rollback**: restore the pre-pilot snapshot, export and hand over the school's data, delete hosting resources, confirm deletion in writing.
- **Data**: returned to the school and removed from Elekeza systems within the agreed retention window.

## 13. Decision requested

Approval to (a) complete the P0 gates and (b) begin discovery with **one named school**, not to start the pilot itself.

**Not approved at time of writing.** Every P0 gate is open and the hosting environment does not exist.
