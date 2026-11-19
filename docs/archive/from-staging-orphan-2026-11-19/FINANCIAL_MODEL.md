# Elekeza — Financial Model
**Version:** v1.0 — pre-pilot estimate  
**Currency:** KES (Kenya Shillings) and USD where noted  
**Exchange rate assumption:** 1 USD = 130 KES (update quarterly)  
**Review trigger:** Update after Month 1 pilot with real usage data  
**Author:** Alvin / AD Group Africa  

---

## Revenue Model

Elekeza charges schools, not learners or guardians.
Guardians never pay a platform fee. The school pays for the platform
and passes the value to learners.

### Pricing Tiers

**Tier 1 — Foundation (KES 3,500/school/month)**
For small SNE schools, 1–50 learners.
Includes: all core features (attendance, fees, assignments, guardian
digest, learner journeys), AI content simplification (up to 30 lessons/
month), AI quiz generation, Tutor for all learners, basic reporting.

**Tier 2 — Standard (KES 7,500/school/month)**
For medium schools, 51–200 learners.
Includes: everything in Foundation, unlimited lesson simplification,
intelligence signals (Phase 2), guardian digest with AI enhancement,
priority support response (48h).

**Tier 3 — Institution (KES 15,000/school/month)**
For large schools and institutional deployments (county government,
NGO networks managing multiple schools).
Includes: everything in Standard, school-level intelligence reports,
multi-school dashboard, dedicated onboarding, SLA support (24h),
API access for third-party integrations.

**Add-on — Device Programme (KES 1,200/device/month)**
For schools that need tablets for learners. Lease model.
Includes: device, case, school-managed MDM profile, Elekeza pre-installed.
School pays monthly, AD Group Africa manages device fleet.

### What is always free (never paywalled)
- Guardian access to their child's information
- Attendance records
- Fee balance visibility for guardians
- Emergency school communications
- Basic learner progress visibility

Core school safety and accountability features are never put behind
a premium tier. Monetisation is on intelligence and scale, not on
essential access.

---

## Unit Economics

### Infrastructure Cost Per School Per Month

| Item | Cost (KES) | Notes |
|---|---|---|
| Railway hosting (AI service) | 650 | Shared across all schools |
| Database (Supabase/Railway PostgreSQL) | 390 | Per school allocation |
| Spring Boot backend hosting | 520 | Shared across all schools |
| Frontend hosting (Vercel/Railway) | 130 | Shared across all schools |
| Domain + SSL | 65 | Amortised monthly |
| **Total infra per school** | **1,755** | At 10 schools |

At 25 schools, shared infrastructure costs drop to approximately
KES 910/school/month due to fixed cost spreading.
At 50 schools: KES 650/school/month.
At 100+ schools: KES 520/school/month.

### AI Cost Per School Per Month

From Deliverable B:
- Learner AI cost: ~$0.006/learner/month = KES 0.78/learner/month
- Simplification: ~KES 4/school/month (20 lessons, teacher-side)
- At 50 learners: KES 43/month
- At 150 learners: KES 121/month
- At 200 learners: KES 157/month

AI cost is negligible relative to subscription revenue.

### SMS / Communication Cost

Guardian Daily Digest delivery options:
- In-app (free — guardian opens the app)
- SMS fallback (KES 1.20/SMS via Africa's Talking)

Assumption: 60% of guardians use app, 40% receive SMS.
At 50 learners, 40% SMS, 22 school days/month:
50 × 0.4 × 22 × KES 1.20 = **KES 528/school/month**

This is a significant variable cost. Reduce it by:
- Encouraging app adoption aggressively in onboarding
- Batching digest messages (one SMS per guardian per day, not per event)
- WhatsApp Business API as alternative at KES 0.40/message (cheaper)

### M-Pesa Transaction Cost

Daraja API charges: 0–1.5% per transaction depending on amount band.
This cost is passed to the school (they pay it as part of fee collection).
Elekeza does not absorb M-Pesa transaction fees.

### Support and Onboarding Cost

| Activity | Time | Cost estimate (KES) |
|---|---|---|
| Initial onboarding (remote) | 3 hours | 4,500 |
| Training session (teachers + admin) | 2 hours | 3,000 |
| Month 1 check-in | 1 hour | 1,500 |
| Ongoing support (per month) | 0.5 hours avg | 750 |

One-time onboarding cost: KES 9,000/school
Ongoing support cost: KES 750/school/month

### Full Cost Per School Per Month (Ongoing, at 25 schools)

| Item | Foundation (50 learners) | Standard (150 learners) |
|---|---|---|
| Infrastructure | 910 | 910 |
| AI | 43 | 121 |
| SMS (40% fallback) | 528 | 1,584 |
| Support | 750 | 750 |
| **Total cost** | **2,231** | **3,365** |

### Gross Margin Per School Per Month

| Tier | Revenue | Cost | Gross Margin | Margin % |
|---|---|---|---|---|
| Foundation (50 learners) | 3,500 | 2,231 | 1,269 | 36% |
| Standard (150 learners) | 7,500 | 3,365 | 4,135 | 55% |
| Institution (200 learners) | 15,000 | 4,200 | 10,800 | 72% |

Margin improves significantly with learner count because infrastructure
and support are largely fixed. SMS is the most variable cost — reducing
SMS fallback rate from 40% to 20% improves Foundation margin to 52%.

---

## Break-Even Analysis

### Fixed Monthly Costs (AD Group Africa operations)

| Item | KES/month |
|---|---|
| Lead developer salary equivalent | 80,000 |
| Design / product | 25,000 |
| Business development | 20,000 |
| Legal / accounting | 8,000 |
| Miscellaneous | 5,000 |
| **Total fixed** | **138,000** |

### Break-Even School Count

At average revenue of KES 7,000/school/month (blend of Foundation
and Standard) and average gross margin of 48%:

Contribution per school = 7,000 × 0.48 = KES 3,360/school/month

Break-even = 138,000 / 3,360 = **41 schools**

At 41 schools, the platform covers its operating costs.
Beyond 41 schools, every additional school is profit.

### Break-Even Timeline

| Schools | Monthly revenue | Monthly cost | Monthly profit |
|---|---|---|---|
| 10 | 70,000 | 171,000 | -101,000 |
| 20 | 140,000 | 182,000 | -42,000 |
| 41 | 287,000 | 280,000 | +7,000 |
| 60 | 420,000 | 340,000 | +80,000 |
| 100 | 700,000 | 450,000 | +250,000 |

The platform needs 41 schools to break even. Reaching this within
18 months of the pilot is the target.

---

## Pilot Budget

The pilot covers the first controlled deployment.
Target: 1–3 schools, 50–150 learners, 3 months.

### One-Time Pilot Costs

| Item | KES |
|---|---|
| Railway hosting setup | 2,600 |
| Domain registration (elekeza.co.ke) | 1,300 |
| SSL certificate | Included in Railway |
| Safaricom Daraja sandbox to production | 0 (free registration) |
| Legal — terms of service, privacy policy | 15,000 |
| Onboarding 2 pilot schools | 18,000 |
| Printed materials (teacher guides) | 4,000 |
| **Total one-time** | **40,900** |

### Monthly Pilot Operating Costs (3 schools, 3 months)

| Item | KES/month |
|---|---|
| Railway hosting (AI + backend) | 5,200 |
| Database | 2,600 |
| AI (3 schools × 50 learners) | 120 |
| SMS (guardian digests, 40% fallback) | 1,584 |
| Support and monitoring | 3,000 |
| **Total monthly** | **12,504** |

**3-month pilot total operating cost: KES 37,512**

**Total pilot budget: KES 78,412 (~$603 USD)**

This is the cost of running the pilot before any revenue.
If pilot schools are paying (even at a reduced pilot rate of
KES 2,000/school/month), revenue offsets: 3 × 2,000 × 3 = KES 18,000.

**Net pilot cost: KES 60,412 (~$465 USD)**

---

## Payment and Finance Operating Model

### How Schools Configure Fees

1. School admin logs in and creates a fee period (e.g. Term 1 2026).
2. Within the period, admin creates fee structures (tuition, lunch,
   transport, activity) with amounts per learner group.
3. The system auto-generates charges for each enrolled learner based
   on their group.
4. Admin reviews and approves the charge run before it becomes visible
   to guardians.

### How Guardians Pay

1. Guardian receives notification (app or SMS) that fees are due.
2. Guardian sees their child's total balance and breakdown by fee type.
3. Guardian pays via M-Pesa (STK push or paybill).
4. Payment is confirmed in real time via Daraja callback.
5. Guardian receives a receipt immediately after payment confirmation.
6. Balance updates instantly.

### Reconciliation

School finance officer runs a reconciliation report at end of each month:
- Total charges raised
- Total payments received
- Outstanding balances by learner
- Payments received but not yet allocated (exception list)
- Receipts issued

All amounts are in DECIMAL(19,4) after the V13 migration.
Reconciliation reports display at 2 decimal places.

### Refunds and Adjustments

Version 1 does not support automated refunds.
Manual adjustment process:
1. Finance officer raises adjustment request in the system.
2. School admin approves.
3. System records adjustment against the learner's charge.
4. Adjusted balance is visible to guardian immediately.
5. Cash refund is handled outside the system (bank transfer or cash).

Automated refunds via Daraja B2C are a post-pilot feature.

---

## Future Revenue Opportunities

These are not in the current model but are real opportunities
once the platform has 40+ schools:

**Data insights for county education offices**
Aggregate (never individual) reports on SNE learner outcomes,
attendance patterns, and assessment performance across schools in
a county. County government pays for this intelligence.
Estimated: KES 50,000–150,000/county/year.

**Content marketplace**
Teachers who create high-quality simplified lessons can share them
across schools. AD Group Africa takes a small cut (10–15%) of any
paid content transaction.

**NGO and donor partnerships**
SNE-focused NGOs (CBM, Leonard Cheshire, Sense International) pay
for platform access for schools they support. Bulk pricing at 60%
of standard rate for NGO-managed deployments.

**Device leasing programme**
Already modelled above. At 500 devices across 50 schools, device
revenue is KES 600,000/month — comparable to subscription revenue.

**Government contract**
Kenya's National Council for Persons with Disabilities (NCPWD) and
the Ministry of Education have active SNE mandates. A county or
national government contract for 200+ schools changes the financial
model entirely. This is an 18–36 month target, not a pilot target.

---

## Financial Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schools cannot afford KES 3,500/month | Medium | High | Offer termly billing (KES 10,000/term) — easier budget cycle for schools |
| SMS costs exceed estimate | Medium | Medium | Push app adoption, WhatsApp fallback |
| Groq pricing increases | Low | Low | Provider abstraction — switch in one env variable |
| M-Pesa Daraja production approval delayed | Medium | High | Already in the gate — prioritise Daraja registration immediately |
| Pilot school drops out | Low | Medium | Start with 3 schools so one dropout does not end the pilot |
| AI quality complaints from teachers | Medium | High | Stage 3b readability correction and human review flow in Phase 1 |

---

## Key Financial Metrics to Track from Pilot Day 1

- Monthly Recurring Revenue (MRR) — target KES 6,000 by end of pilot
- Churn rate — target 0% during pilot (schools that start should finish)
- Cost per school per month — compare against model
- SMS cost as % of revenue — target below 15%
- AI cost as % of revenue — target below 5%
- Support hours per school per month — target below 1 hour
- Days to first payment per pilot school — target below 30 days