# AD GROUP — PORTFOLIO BRIEF

September 2026 · Source: portfolio strategy session · Companion: `EXECUTIVE-SUMMARY.md`, `PCEA-ENTRY-STRATEGY.md`

## Executive picture

Too many potentially valuable products for available execution capacity. The opportunity is not more ideas — it is turning 2–4 of the strongest systems into sellable, deployable products while keeping the rest as strategic IP.

Common theme across the portfolio:

> **Kenya/Africa-native operational software: payments + records + workflows + intelligence.**

Market signals: CBK's January 2026 CEO survey found 86% of surveyed firms automated processes in the prior year (cloud, sales analytics, operational monitoring, billing/payments, compliance among top adoption areas). Mastercard reports 95% of Kenyan SMEs accept mobile money and 70% cite better data/insights as a growth requirement.

## Portfolio at a glance

| Product | What it is | Current position | Revenue potential | Priority |
| ------- | ---------- | ---------------- | ----------------- | -------- |
| DukaPro / Freebuff | SME POS + inventory + business ERP | Closest to commercial deployment | 🔥🔥🔥🔥🔥 | #1 |
| ClinIQ | Clinic/hospital operations platform | Strong technical foundation (JWT rotation, Redis blacklist, rate limiting, M-Pesa callback security, 46 tests) | 🔥🔥🔥🔥🔥 | #1 |
| Elekeza | Inclusive education + school ERP/learning OS | Advanced prototype/pilot stage — demo-ready (see `docs/production/DEMO_READINESS_REPORT.md`) | 🔥🔥🔥🔥 | #1 / Demo |
| PCEA Connect / Works | PCEA institutional/church operating platform | Strong feature foundation (ministry framework, V048 migrations, 23 tests) | 🔥🔥🔥 | #2 |
| AgriGrid / ShambaOS | Agriculture + climate intelligence | Concept/validation/build | 🔥🔥🔥🔥 | #2 |
| TrustMark | Product authenticity/traceability | Hackathon/MVP direction | 🔥🔥🔥 | #3 |
| MADAI | Accountability/complaints workflow ("every complaint gets a clock") | Idea/MVP | 🔥🔥🔥 | #3 |
| NestIQ | Property/rental management | ~78% feature completeness, ~75% production readiness; OTP logging + hardcoded JWT secrets previously flagged | 🔥🔥🔥 | Hold/monetize later |
| LexOps | Legal operations | Early/strategic | 🔥🔥 | Hold |
| WildGuard OS | Conservation/wildlife operations | Early/strategic | 🔥🔥 | Hold |
| Mwananchi OS | Civic/public-service infrastructure | Early/strategic | 🔥🔥🔥 | Hold |
| Church Connect | Church digital infrastructure | Evolving into PCEA Connect | 🔥🔥🔥 | Consolidate |

## 1. DukaPro / Freebuff — strongest immediate commercial opportunity

**Idea:** Kenyan SME operating system beginning with POS: Sales → Stock → Purchasing → Suppliers → Customers → Payments → Expenses → Profit → Branches → Management dashboard. Eventually POS + Inventory + CRM + Procurement + Accounting + HR + Analytics + AI.

**Market fit:** Kenyan ERP demand centers on M-Pesa, eTIMS, inventory, POS, multi-branch, customer/supplier ledgers, payroll, reporting, offline capability, mobile-first. SMEs want focused systems, not enterprise suites. Local implementation pricing: ~KES 60k+ (open-source ERP implementation) to KES 500k+ (custom ERP) — businesses already pay meaningful amounts.

**Already built:** POS, product/catalogue, stock, scanner/wedge work, transaction handling, pending payments, restocking, dashboards, client monitoring direction, pricing direction, production architecture, integration testing/hardening.

**What's left — the gap is PRODUCT → DEPLOYMENT → CUSTOMERS → REVENUE:**
production deployment · M-Pesa production integration · eTIMS · onboarding · tenant/client isolation · billing/subscriptions · admin/client monitoring · backups · audit logs · support tooling · offline reliability · demo data · sales materials · **first 5–10 paying businesses**.

**Revenue model:** Starter KES 500–1,000/mo · Business KES 1,500–3,000/mo · Growth KES 4,000–8,000/mo · Enterprise custom. Plus setup fee, hardware/scanner deployment, data migration, training, custom reports, integrations, support. Sell "we digitize your entire shop operation" — makes implementation revenue possible.

**Resources:** You + frontend + sales/onboarding. Eventually: 1 backend engineer, 1 frontend/mobile engineer, 1 implementation/support person, sales/onboarding, cloud/DevOps capacity. **Actively sell now.**

## 2. ClinIQ — strongest specialized B2B SaaS

**Idea:** Clinic operating system: Patients → appointments → consultations → prescriptions → pharmacy → laboratory → billing → payments → records → reporting.

**Already built (technically strong):** JWT auth, refresh-token rotation, Redis token blacklisting, rate limiting, M-Pesa callback security, production config validation, CORS hardening, restricted actuator, pharmacy, consultations, laboratory, integration tests, Flyway migrations, 46 tests passing after security/domain expansion.

**What's left (commercialization + operational completeness):** polished frontend · clinic onboarding · production deployment · M-Pesa · SMS/notifications · billing workflows · reports · backups · audit trails · permissions · subscription/billing · deployment automation · real clinic pilot · regulatory/privacy review · support.

**Revenue:** small clinic KES 2,000–5,000/mo · medium KES 5,000–15,000/mo · larger facility KES 15,000–50,000+/mo. Plus implementation, migration, hardware, support, integrations, custom modules. Higher ARPU than DukaPro. **Do not turn it into a generic ERP — specialize for healthcare.**

## 3. Elekeza — flagship education/inclusion product

**Idea:** Inclusive School ERP + learning + SNE support platform. Layers: Student → Parent/Guardian → Teacher → School → Learning → Assessment → Support → Payments → Administration. Differentiation is the inclusive/SNE layer, not "another school management system."

**Position:** AI learning, CBC content, quizzes, personalization, SNE, parent/caregiver/teacher access, school administration, M-Pesa, security, testing, production hardening — now demo-ready with the multi-guardian relationship model (PARENT/CAREGIVER/OLDER_SIBLING/LEGAL_GUARDIAN/OTHER).

**What's left:** Demo completeness > feature expansion (all access paths, guardian roles, onboarding, auth, content, assessments, personalization, payments sandbox, safety/security, analytics, demo data, failure states, final integration tests — largely done; see `TUESDAY_DEMO_RUNBOOK.md`).

**After demo — school ERP expansion:** admissions · student records · fees · attendance · timetable · exams · CBC assessment · staff · communication · parent portal · transport · inventory · procurement · reporting.

**Revenue:** parents low-cost subscription · schools institutional subscription · NGOs program licensing · government/partners deployment contracts · assessment/content premium. The larger opportunity: **school contracts + institutional deployments + partnerships**, not KES 500/month from parents.

## 4. AgriGrid / ShambaOS — agriculture intelligence

Farmer → farm → weather → soil → crop → market → finance → logistics → recommendations. Future: farmer management, cooperatives, inputs, crop monitoring, weather intelligence, disease detection, market info, financing, insurance, traceability.

Strategically attractive but resource-heavy (datasets, field validation, partnerships, AI/ML, offline mobile, farmer onboarding, possibly IoT). Revenue better as B2B/B2G/B2B2C: agribusinesses, cooperatives, NGOs, insurers, lenders, county governments, development orgs, input companies — contracts + per-farmer licensing + analytics + API/data services.

**Recommendation: don't build the whole ecosystem now — build one killer workflow.**

## 5. PCEA Connect / Works — institutional opportunity

Direction: **PCEA Digital Operating System**, not a "church app." Existing: ministry framework (YPCMF, Guild, Youth, Sunday School, Catechism), ministry dashboards, ministry authorization, role/ministry/scope permissions, events, announcements, projects, PostgreSQL migrations through V048, 23 tests/0 failures.

Revenue: congregation subscription + implementation, migration, SMS, payment processing, premium reporting, institutional support. Large institutional contract potential but slow sales cycles — **keep developing toward a credible PCEA deployment; not the short-term cash engine.** Full entry strategy: `PCEA-ENTRY-STRATEGY.md`.

## 6–8. NestIQ · TrustMark · MADAI

- **NestIQ** (property/rental): ~78% features, ~75% production-ready. Previously flagged: OTP logging, hardcoded JWT secrets, source secrets, frontend token storage. **Don't rebuild — finish security + deployment only if a real customer appears; otherwise hold.** Potential: landlords, property managers, estates, agencies; KES 1k–10k+/mo by portfolio size.
- **TrustMark** (authenticity/traceability: Manufacturer → Product → Batch → QR → Consumer → Verification; counterfeit detection, batch tracking, warranty, SMS/USSD): excellent hackathon/validation concept; enterprise manufacturing sales are much harder than SME POS. **MVP + validation only, no big engineering investment yet.**
- **MADAI** ("Make Accountability Move" — every complaint gets a clock: Complaint → assignment → SLA → escalation → resolution → evidence): strong civic/institutional concept for counties, universities, NGOs, estates, customer-service departments. **Keep lean — the killer feature is accountability with measurable deadlines, not complaints software.**

## THE BIG ERP OPPORTUNITY — shared AD Core

Don't build one giant ERP. Build a shared platform underneath the verticals:

```text
                 AD CORE
                    │
       ┌────────────┼────────────┐
       │            │            │
     USERS       PAYMENTS      AUDIT
       │            │            │
   WORKFLOWS     BILLING      REPORTS
       │            │            │
   NOTIFICATIONS  DOCUMENTS    AI
       │
       ▼
 ┌─────────┬─────────┬─────────┬─────────┐
 │ DukaPro │ ClinIQ  │Elekeza  │ PCEA    │
 │   ERP   │ Health  │ School  │ Connect │
 └─────────┴─────────┴─────────┴─────────┘
```

Build once, reuse everywhere: authentication, organizations, roles, permissions, subscriptions, payments, notifications, audit logs, files, reporting, dashboards, AI, tenant management. Each vertical keeps its own domain model.

**Positioning:** don't enter saying "we built another ERP." Say: DukaPro — *the operating system for Kenyan shops*. ClinIQ — *the operating system for clinics*. Elekeza — *the operating system for inclusive schools*. PCEA Connect — *the digital operating system for PCEA*. ShambaOS — *the operating system for data-driven agriculture*.

## REVENUE MAP — three layers

**Layer 1 — Fast cash (productized services).** ERP setup, POS deployment, website/app development, M-Pesa integrations, eTIMS integrations, dashboards, data migration, automation, custom software, maintenance. Projects KES tens-of-thousands to hundreds-of-thousands (market: ~KES 60k open-source ERP implementation, KES 500k+ custom ERP). **This finances the company while SaaS matures.**

**Layer 2 — Recurring revenue (targets, not forecasts):**

```text
DukaPro   100 customers × KES 2,000   = KES 200,000 MRR
ClinIQ     30 clinics  × KES 7,500    = KES 225,000 MRR
Elekeza    20 schools  × KES 10,000   = KES 200,000 MRR
PCEA       20 congregations × KES 5,000 = KES 100,000 MRR
─────────────────────────────────────────────────────────
                                    KES 725,000 MRR ≈ KES 8.7M ARR
```

(before implementation fees, integrations, hardware, enterprise contracts)

**Layer 3 — Large contracts (the real upside):** schools, clinic groups, churches, NGOs, county programs, agribusinesses, enterprises, government, development organizations → KES 300k → millions per contract.

## WHAT YOU NEED NOW

Biggest constraint: **execution bandwidth + sales + deployment capacity** — not ideas.

**Technology:** shared infrastructure (auth, RBAC, tenancy, organizations, billing, payments, notifications, audit, files, analytics, AI gateway, logging, monitoring, backups, CI/CD) + production infrastructure (domains, cloud, PostgreSQL, Redis where required, object storage, monitoring, backups, secrets management, deployment pipelines, staging, production, disaster recovery).

**People:** AD Group today = You (backend/CTO/product) + Alvin (AI/ML) + Victor (frontend/UX). Enough to build; not enough to commercialize 10 products. **Next hires should NOT primarily be more engineers:**

1. **Sales / Business Development** — prospect, call, arrange demos, follow up, close, collect requirements, manage CRM.
2. **Implementation / Customer Success** — onboard customers, import data, train staff, configure systems, first-line support.
3. **Eventually DevOps/Platform** — once deployments multiply.

**Resource allocation if money is limited:**

| Area | Priority |
| ---- | -------- |
| Customer acquisition | 🔴 25% |
| Product completion | 🔴 25% |
| Cloud/infrastructure | 🟠 15% |
| Integrations/compliance | 🟠 10% |
| Sales/marketing materials | 🟠 10% |
| Support/onboarding | 🟡 10% |
| Experiments/new ideas | 🟢 5% |

The dangerous move: spending 90% of resources on engineering while nobody is selling.

## TARGET PORTFOLIO SHAPE

```text
                         AD GROUP
                            │
             ┌──────────────┴──────────────┐
             │                             │
       AD CORE PLATFORM             SERVICES / CONTRACTS
             │                             │
      ┌──────┼──────┐                 Integration
      │      │      │                 Development
      ▼      ▼      ▼                 ERP setup
   DukaPro ClinIQ Elekeza             Automation
      │      │      │                 Support
      └──────┼──────┘
             │
       Commercial SaaS
             │
      ┌──────┴──────────┐
      ▼                 ▼
 PCEA Connect       ShambaOS
      │                 │
 Institutional       Agriculture
```

Everything else stays in **AD Labs / IP portfolio** until there's evidence of demand.

## THE 90-DAY OBJECTIVE

Don't aim to "finish all projects." Aim: **3 products deployed + paying customers.**

| Product | Goal |
| ------- | ---- |
| DukaPro | 5–20 paying businesses |
| ClinIQ | 1–5 pilot clinics |
| Elekeza | successful demo → pilot school(s) → institutional partnership |

Then: PCEA Connect → institutional deployment · ShambaOS → validation/partnership · everything else → controlled maintenance.

## The five questions every project must answer

1. Who pays?
2. What painful problem are they paying to solve?
3. What is the minimum deployable version?
4. How do we acquire the first 10 customers?
5. What does it cost AD Group to support each customer?

If a project can't answer these, it shouldn't consume significant engineering time yet.

**Bottom line:** you don't need another idea. You need DukaPro commercialized, ClinIQ piloted, Elekeza demo-ready and converted into a school pilot, while building a reusable AD Core underneath them. Best balance of near-term cash + recurring revenue + defensible IP + large-contract upside.
