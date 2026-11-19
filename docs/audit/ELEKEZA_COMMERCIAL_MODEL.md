# ELEKEZA — COMMERCIAL MODEL & UNIT ECONOMICS

**Date:** 14 Nov 2026
**Status:** analysis only. **No payment configuration was created, modified or activated.** No real transaction was initiated.

> **How to read the numbers.** Every figure below is a **modelling assumption**, not a quoted price or a measured cost. Provider prices change and must be confirmed against current published rates before any commitment. The point of this document is the *structure* of the economics — which costs scale per learner, which scale per school, and where the free tier breaks — not the exact shilling amounts.

---

## 1. What actually costs money

Ranked by how much they threaten a free tier, based on the architecture:

| Cost driver | Scales with | Why it dominates |
|---|---|---|
| **AI inference** (tutor, quiz generation, simplify, verify) | per learner *turn*, multiplied by 4 pipeline stages | The only cost that grows every time a child asks a question. `ai-elewa` runs a 4-stage pipeline (profile → simplify → verify → concepts); a single tutor interaction can be 3–4 provider calls. |
| **Document processing** (PDF/OCR/extraction) | per upload, plus storage | `pdfbox`/`poi`/OCR in-process; large files are CPU-heavy. |
| **Compute** (backend + frontend + Postgres + Redis + AI container) | per school/large step, not per learner | A 4 GB VPS serves a pilot cohort; it does not scale per child. |
| **Object storage** (R2) | per document, per learner | Small per unit, unbounded in aggregate, and currently **not even wired** (uploads land on local disk — SEC-P1-04). |
| **SMS** (`AFRICA_TALKING`) | per message | Kenyan SMS is a real per-unit cost; guardian notifications must be metered. |
| **Email** (SMTP) | per message | Cheap, but password resets and invites add up at onboarding spikes. |
| **M-Pesa** (Daraja) | per transaction | Transaction fees on collections; also the reconciliation burden. |

**The critical asymmetry:** compute is roughly *flat per school*, while AI is *linear per learner-turn*. Any model where a school pays a flat fee but learners use the tutor freely has a cost curve that eventually crosses revenue. That is the design constraint for every tier below.

---

## 2. The four delivery models

### A. Free access (essential learning)
- **Includes:** subject browsing, lesson reading, practice quizzes with feedback, progress view, guardian read-only progress.
- **Excludes:** AI tutor beyond a small monthly allowance, document upload, teacher/class tooling.
- **Cost per active learner:** dominated by hosting + storage; AI limited to a fixed allowance (e.g. N tutor turns/month) so cost is bounded by design.
- **Why it must exist:** it is the mission. A learner with no money must still be able to *learn*, not just see a paywall.

### B. Freemium
- **Free tier:** as A, plus a metered AI allowance (e.g. 20–30 tutor exchanges/month — enough to try, not enough to run a term).
- **Premium:** unlimited-ish tutor within fair-use, document upload + tutor-over-document, exam practice packs, advanced reports.
- **Conversion trigger:** the moment a learner hits the allowance mid-homework. That is the honest paywall — it happens when value is already proven.
- **Risk:** the metered allowance is the whole business model. It must be enforced (see gap: **no quotas exist today** — `TutorController`/`ai-elewa` have no per-user limit).

### C. Individual / household subscription
- **Shape:** monthly or per-term, parent-funded.
- **Multi-child pricing:** marginal cost per extra child is low (the expensive part is AI turns), so a household plan should price child 2+ at a fraction of child 1. This is the strongest lever for affordability.
- **Payment channels:** M-Pesa STK push is already implemented (`/payments/stkpush`) with an honest mock/live mode — the correct rail for Kenya. Add card only if the diaspora segment justifies it.
- **Per-term billing** matches how Kenyan families already pay for school; monthly matches cash flow. Offering both costs little.

### D. Institutional & sponsored access
- **School subscription:** per-school, banded by learner count. School pays for compute + a pooled AI allowance across its learners.
- **Government / county sponsorship:** the natural fit for the `/government` role that does not exist yet. Sponsored cohorts need only aggregate reporting, which is cheaper and safer than per-child oversight.
- **NGO / donor / CSR:** fund named learner cohorts; requires a sponsor-facing impact report that is honest about what is and is not measured.
- **Sponsored learner accounts:** a flagged account class where the sponsor pays and the learner experiences the premium tier with no payment surface at all. **This is the mechanism that makes "affordable for those who cannot pay" real rather than rhetorical.**

---

## 3. Unit economics — the shape that matters

Model per **active learner per month**, with AI as the only truly variable line:

```
cost_learner_month ≈ (tutor_turns × avg_tokens_per_turn × price_per_token × pipeline_stages)
                   + (documents × avg_MB × storage_price)
                   + (sms_messages × sms_price)
                   + shared_compute / active_learners
```

| Line | Behaviour | Control lever |
|---|---|---|
| Tutor turns | Linear, unbounded today | **Hard monthly allowance per tier** — the single most important control |
| Tokens per turn | Linear within a turn | Cap context: send the current lesson/section, not the whole document history |
| Pipeline stages | ×3–4 on the same content | Cache stage outputs per (content, profile) pair; a lesson simplified for a dyslexia profile should not be recomputed for the next dyslexia learner |
| Documents | Linear, per upload | Per-learner quota + max size + retention |
| SMS | Linear, per message | Prefer in-app + email; reserve SMS for high-value alerts, or let the guardian opt in |
| Shared compute | Inverse to cohort size | One VPS serves a pilot; do not container-per-school |

**Break-even logic (structural, not numeric):** a free learner is sustainable **only if** their AI turns are capped and their documents are quota-limited. A free learner with unlimited AI is a loss proportional to their enthusiasm — and enthusiastic learners are exactly the ones you want, so the cap must be generous enough to feel fair and firm enough to survive.

**Three numbers to establish before pricing is set** (none exist today):
1. Median **tutor turns per active learner per month** (instrument it — the data does not exist).
2. Median **tokens per turn** and the **cache hit rate** for stage reuse.
3. **Cost per 1,000 active learners per month** on the chosen host shape.

Without 1–3, any price is a guess. Instrumenting them is cheap and should precede pricing.

---

## 4. Pricing scenarios (illustrative, to be validated)

| Scenario | Who pays | What they get | Structural risk |
|---|---|---|---|
| **School pilot, sponsored** | Elekeza / donor | Full teacher+learner+guardian, capped AI | Cost is known and bounded; proves the product, not the market |
| **School subscription, banded** | School | Pooled AI allowance, staff tooling, finance, attendance | A school that uses the tutor heavily can outrun a flat fee → band by learner count and cap the pool |
| **Household term plan** | Parent | Premium for 1–3 children, all subjects | Churn at term boundaries; needs a strong "resume where you left off" story (J5 is only PARTIAL today) |
| **Free tier** | Nobody | Core learning, metered AI | The AI meter must actually work, or the free tier is an unbounded liability |

**Affordability principle to state publicly and honour:** the free tier must remain genuinely useful, not a demo. The moment "free" means "read-only", the equal-access mission is marketing.

---

## 5. Blocking commercial gaps (technical)

| Gap | Severity | Consequence for pricing |
|---|---|---|
| **No AI usage quotas or metering anywhere** | **P1** | Not one of these models is enforceable. A free tier cannot exist. |
| **No subscription/billing model for individuals** — billing exists for institutions (`/api/billing/**` is `SCHOOL_ADMIN`/`ADMIN` only) | **P1** | Household plans cannot be sold |
| **Payments are for school fees**, not Elekeza subscriptions (`MpesaController`/`finance` are the fee-collection domain) | **P1** | The subscription rail does not exist; do not repurpose the school-fee ledger |
| Uploads stored on local disk, not R2 | P1 | Storage cost cannot be attributed per tenant; data is lost on redeploy |
| No per-tenant usage reporting | P2 | Cannot invoice by usage or show a sponsor their cohort's impact |
| No dunning / failed-payment handling | P2 | Term renewals will silently lapse |

**Recommendation:** treat *metering* as the first commercial engineering task, before any pricing page. Metering is also a security control (SEC-P2-05) and a cost control — it is the same work.

---

## 6. What must not happen

- Do not enable `FEES_MPESA_MODE=live` or any real Daraja credentials until the callback IP allowlist (SEC-P3-03) and reconciliation are signed off.
- Do not reuse the school-fee payment ledger for platform subscriptions; they have different reconciliation, refund and reporting semantics.
- Do not publish pricing, partnership claims, impact statistics or government endorsement anywhere until they are true.
- Do not build a paywall in front of the free learning loop. It converts an education mission into a funnel, and it is the fastest way to lose the schools who would have championed the pilot.
