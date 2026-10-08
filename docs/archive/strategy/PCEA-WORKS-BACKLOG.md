# PCEA WORKS / PCEA CONNECT — SEPARATE WORKSTREAM BACKLOG

**Rule: nothing in this file may be implemented inside the Elekeza repository.** Elekeza is education-only. This backlog exists so PCEA opportunities are captured without scope-creeping the school platform.

| # | Opportunity | Proposed product | User | Workflow | Required integration | Status | Next action |
| - | ----------- | ---------------- | ---- | -------- | -------------------- | ------ | ----------- |
| P1 | Official church communication (vs WhatsApp forwarding, fake circulars) | PCEA Communication Hub — authenticated announcements with issuing office, reference number, verification status | Head Office → Presbytery → Parish → Members | Directive → targeted delivery → acknowledgement → archive | PCEA member directory; SMS/email providers | Not started | Include as Offer A in PCEA Digital Transformation Proposal |
| P2 | Administrative coordination ("who is responsible?") | Admin & Workflow Pilot — directive → assignment → evidence → verification | Head Office, Presbytery clerks, Parish Session | Communication converted into accountable workflow | RBAC + org hierarchy (AD Core candidates) | Not started | Include as Offer B in proposal |
| P3 | Milele operational visibility (hotel group: Nairobi/Beach/Nakuru) | Milele OS / Digital Operations Audit — bookings → revenue → reporting visibility for management | Milele management, PCEA institutional leadership | Audit → dashboard → operations integration | Hotel PMS/POS export or replacement; M-Pesa | Not started | Include as Offer C in proposal — audit-first, deliberately outside the ownership/governance dispute |
| P4 | Ministry administration (YPCMF, Guild, Youth, Sunday School, Catechism) | Ministry OS modules inside Connect | Ministry leaders | Members, events, attendance, projects, reports | Extends existing PCEA Connect prototype (separate repo/codebase) | Prototype exists in PCEA Connect codebase, NOT Elekeza | Consolidate into Connect when funded |
| P5 | Meetings → minutes → actions (institutional memory) | Meeting/workflow module | Sessions, boards, committees | Agenda → minutes → resolution → action → evidence | Documents + notifications | Not started | Phase with Connect pilot |
| P6 | Resilient/offline communication for rural congregations & events | AirHop (mesh/offline layer) | Rural congregations, missions, conferences | Offline-first messaging when connectivity fails | Standalone mesh protocol | Concept only — clarify which "AirHop" is ours | NOT in first PCEA pitch; revisit after Connect lands |
| P7 | Institutional ERP (hospitals, schools owned by PCEA) | PCEA Group ERP | Institutional leadership | Consolidated multi-entity dashboard | Separate verticals (ClinIQ, Elekeza) federated at group level | Concept | Long-term; requires AD Core maturity |

**Entry strategy reference:** `docs/strategy/PCEA-ENTRY-STRATEGY.md` (phased: Diagnostic → Quick win → Connect pilot → Milele → Group platform).
