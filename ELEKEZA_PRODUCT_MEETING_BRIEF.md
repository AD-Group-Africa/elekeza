# ELEKEZA — PRODUCT & DEVELOPMENT MEETING BRIEF

**Date:** 19 November 2026 · **Launch target:** 30 November 2026 · **Prepared for:** Harrison (owner), product, development

---

## The one paragraph everyone needs

Elekeza is **one product with one repository, not several competing copies**. The three services — backend, AI service, frontend — all exist, all build, and **1,034 automated checks pass** when run the way our CI runs them. What we do *not* have is a single agreed branch to deploy from, a working deployment, or any verified third-party integration. The engineering is roughly **three-quarters done**; the *delivery* work is roughly **one-quarter done**. Nothing in the last month was wasted — it is sitting on two different branches that have simply never been joined.

---

## 1. What the team probably believes vs. what is true

| Belief | Reality (verified today) |
|---|---|
| "Victor uploaded a second copy of the project." | **No second repository exists.** One repo, zero forks. Victor's (CarribeanVickie's) work is a **branch that was merged on 15 November** into `feat/elekeza-pilot-completion`. That merge is *the newest thing we have* and it is not lost. |
| "The latest branch is the best one." | The newest branch (15 Nov) is the best **frontend**. The backend's newest work (privacy, county deadlines, V20/V21 migrations) is on an older branch and **not yet committed**. "Newest" and "most complete" are different branches. |
| "Production is on `main`." | `main` is the **June MVP commit**. GitHub's default branch is `staging`, which is missing 50 commits that `main` has. Deploying from either would ship the wrong product. |
| "We had hundreds of passing tests, so we're fine." | Still true — **but re-measured today**, not inherited: backend 397/397, AI 603/603, frontend 34/34. The one red gate is frontend lint (17 errors). |
| "The Android app is nearly ready." | It is a **web wrapper** (Capacitor), with a test APK from **July**. No native code, no signing configuration. It is a *distribution* task, not a *product* task. |

---

## 2. Status in plain terms

| Area | Plain-English status |
|---|---|
| **Student, teacher, guardian, school admin, platform admin** | All five roles exist in the backend with real permissions and real data, and were exercised by the automated suite. The screens for all five roles exist in the newest frontend (61 pages). |
| **Guardians seeing their children** | **Fixed and verified in code.** Parent, older-sibling and caregiver accounts are now explicitly linked to learners in the demo data, and tests cover the "unlinked guardian gets 403" case. This was the concern raised previously — it holds. |
| **AI tutor** | Working, multi-provider, age-aware, Kiswahili + English. **Not yet proven against the real AI provider** because no live key was available today. This one needs a 10-minute test with a key, not more development. |
| **Payments (M-Pesa)** | Code exists; **no credentials, no callback verification, no live test**. Recommend: launch with fees *visible* but payment *deferred*. |
| **SMS / email / storage** | Adapters written; all default to safe mock behaviour. Real providers need keys and one end-to-end test each. |
| **Error monitoring** | Frontend only. Backend and AI have **no error reporting at all** — if production breaks, nobody is told. |
| **Deployment** | **Nothing is deployed.** No URL, no health check, no rollback rehearsal. |

---

## 3. The decision we need from Harrison today

**We need permission to join two branches into one.** That is the whole critical path.

Today, valuable work lives in three places that have never met:

1. `sprint-3-safe-config` — the backend's newest work (**plus 42 uncommitted files** — one mistake away from loss).
2. `feat/elekeza-pilot-completion` — the frontend revamp merged on 15 November.
3. `staging` — two commits ("Phase 1 AI improvements + Tutor endpoint") that exist **nowhere else**.

I simulated the merge: **379 files change, and there is exactly one conflict** — one guardian messaging page that one branch moved and the other edited. That is a two-hour job, not a rebuild. The result becomes `develop`; `main` follows it; `staging` becomes the release candidate. One platform, one source of truth.

**Why we cannot just do it:** it requires pushing to the shared repository and repointing `main` — a remote change that affects every contributor. That is Harrison's call, not an agent's.

---

## 4. Can we make 30 November?

**Yes — for a real, usable, hosted platform.** Realistic sequence:

| Days | Work | Outcome |
|---|---|---|
| 1 | Commit the uncommitted work; merge the two branches; reconcile the `staging`-only commits; fix 17 lint errors | **One branch that actually contains everything** |
| 2 | Repoint `main`, set `develop`, protect branches, refresh README/CI | **One obvious source of truth on GitHub** |
| 3–4 | Render (backend + AI) and Netlify (frontend) with real secrets; health checks; first sign-in on production URLs | **A live platform** |
| 5 | One real AI-provider run; one SMS/email send; M-Pesa sandbox callback | **Integrations proven, not assumed** |
| 6 | Five-role acceptance pass against the hosted stack; rollback rehearsal | **Launch evidence** |
| 7 | Buffer | — |

**What should NOT be promised for 30 November:**
- Live M-Pesa money movement (needs Daraja production approval + callback hardening).
- Play Store release (needs signing, policy review, store listing).
- Guaranteed AI availability on a Render **free** instance — cold starts will exceed the 120-second timeout path. The AI service needs a paid, always-on instance.

Those are schedule decisions for Harrison, not engineering failures.

---

## 5. What changed in how we work

- **Three permanent branches only:** `main` (production), `develop` (integration), `staging` (release candidate). Everything else is a short-lived feature branch.
- **No more "which repo?"** — there is one, and after this week there will be one obvious branch.
- **Every release claim needs a log file.** Today's numbers are in `artifacts/audit-2026-11-19/`; the report set is under `docs/`.
- **No demo data with real learners.** Seeding is gated off in production by default (`DEMO_SEED_ENABLED=FALSE`) — keep it that way on any public URL.

---

## 6. Three questions for the room

1. **Scope:** is M-Pesa live before 1 December a launch requirement, or a fast-follow? (Recommendation: fast-follow.)
2. **Budget:** is one paid Render instance for the AI service approved? (Free tier will make the tutor feel broken.)
3. **Ownership:** who owns the Render and Netlify accounts, and who holds the provider keys? The engineering is blocked on access, not on code.
