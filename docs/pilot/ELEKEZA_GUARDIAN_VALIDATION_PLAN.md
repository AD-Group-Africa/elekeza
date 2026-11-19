# ELEKEZA — Guardian Validation Plan

**Status:** prepared, **not executed**. No guardian has been contacted. Execution requires a participating school and explicit authorisation (§7).

**Date:** 15 November 2026

---

## 1. What we are validating

Not "do you like it" but: *can a Kenyan guardian, on their own phone, on their own data bundle, see the school information that matters about their own child — and do they trust it?*

## 2. Participants

- 5–8 guardians of learners in the pilot class, recruited **through the school**, never by us directly.
- Mix: smartphone and feature-phone-at-home, varying literacy confidence, at least one Kiswahili-first guardian, at least one guardian with a disability or a child with SNE needs.
- No guardian is paid for participating; no learner data is collected.

## 3. Session format (25 minutes, per guardian, at the school)

| Min | Step |
|---|---|
| 0–3 | Explain the purpose, that data is synthetic, that they can stop at any time |
| 3–8 | *Their* task, unassisted: log in, find their child's school dates |
| 8–15 | Observe silently. Note where they hesitate, what they tap, what they ask |
| 15–20 | Their expectations: notifications, language, what else they'd want |
| 20–25 | Trust and privacy questions (§5) |

The task must be performed by the guardian, not demonstrated to them. Hesitation is the data.

## 4. Feedback questionnaire

1. Before today, how did you learn about school dates and events? *(SMS / WhatsApp / child / notice board / nowhere)*
2. How did you find logging in? What was unclear?
3. Could you find your child's information without help? What slowed you down?
4. Is the language right? Would Kiswahili be better for any part?
5. What would you want to see that is not here?
6. How would you want to be told about a new date — SMS, WhatsApp, call, in-app?
7. Would you use this on your own phone data? How much data would you accept it using?
8. If the school used this, would it change how you prepare your child for school? How?
9. What would make you stop using it?

## 5. Trust and privacy questions (asked, not explained away)

1. Who can see your child's information?
2. What would you want the school to ask you before putting your child's name in a system?
3. Would you want to be able to remove your details? What should happen to them then?
4. How would you know the information is correct?
5. Would you want to know if someone else looked at your child's record?

Record answers verbatim. These answers define the consent and erasure features that must exist before real data — they are requirements, not sentiment.

## 6. What must be true before guardians see real data

| Precondition | Status |
|---|---|
| Guardian linking flow (school-approved, revocable, expiring) | VERIFIED technically — 37/37 contract incl. revoked and expired links |
| Guardian sees only linked learners | VERIFIED |
| School authorisation for the pilot | NOT OBTAINED |
| Guardian consent capture in the product | **ABSENT** — no consent feature exists |
| Erasure path | **ABSENT** |
| Retention policy | **ABSENT** |
| Data-protection review | **NOT DONE** |
| Hosted environment with HTTPS | **BLOCKED** |

The technical controls that protect guardians are in good shape; the legal and consent foundations are entirely missing. **No real guardian data may be entered until the last four rows are closed.**

## 7. Authorisation required

| Item | Who |
|---|---|
| Permission to speak with guardians | Founder + school |
| Recruitment through the school | School coordinator |
| Any collection of personal contact details | Not permitted in this phase |
| Real learner data in the product | Requires consent + legal review — not granted |

## 8. Accessibility feedback checklist (observed, not asked)

- [ ] Guardian could read the screen without zooming
- [ ] Text size adequate at default settings
- [ ] Contrast adequate outdoors / in daylight
- [ ] Touch targets reachable with one thumb
- [ ] Kiswahili labels understood without translation help
- [ ] Worked on the guardian's own device, not ours
- [ ] Usable on a slow connection (measured, not assumed)
- [ ] Errors explained in plain language
- [ ] Screen-reader path attempted where a participant uses one

## 9. Success criteria

1. At least half the guardians complete the task unassisted on their own device.
2. The top three confusions are named and fixable.
3. We know whether SMS/WhatsApp notification is expected at all — before building it.
4. We have the guardians' own words on consent and removal, to design against.

Failing this honestly is worth more than a friendly "it was nice".
