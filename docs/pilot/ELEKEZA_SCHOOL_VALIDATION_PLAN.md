# ELEKEZA — School Validation Plan

**Status:** prepared, **not executed**. No school has been contacted; no message has been sent. Execution requires founder authorisation and a named partner school (see §8).

**Date:** 15 November 2026

---

## 1. Purpose

Find out whether Elekeza solves a problem a Kenyan school actually has, in the conditions that school actually works in — before asking it to change anything. This is discovery and validation, not sales.

## 2. Preconditions

| Requirement | Status |
|---|---|
| Hosted staging environment (HTTPS) available for demonstrations | **BLOCKED** — not provisioned |
| Demonstration data is synthetic | READY — fixtures and gate identities are synthetic |
| Founder authorisation to approach a named school | **NOT GIVEN** |
| Introduction route (existing relationship, referral, or formal letter) | Not established |
| Data protection position explained honestly to the school | Drafted (§7) |

Until staging exists, only a **synthetic-data walkthrough** on a laptop can be offered. Do not promise a live URL that does not exist.

## 3. Discovery: what we need to learn

Asked of the school leadership, not assumed:

1. School type (public/private/faith-based/SNE unit), location, learner population, age range.
2. Which classes would take part, and how many learners per class.
3. Existing systems: registry, exams, fees, communication (SMS? WhatsApp? paper?).
4. Devices available to teachers and learners: number, type, age, Android version.
5. Connectivity: is there Wi-Fi? Whose data do teachers/guardians use? Cost sensitivity?
6. How guardians are contacted today, and in what language.
7. Accessibility needs in the learner population (visual, hearing, cognitive, physical).
8. The three biggest administrative pain points this term.
9. Who decides (head teacher? board? sponsor?) and what would make them say no.
10. Whether a pilot would need approval from a county education office.

**Do not** collect names, phone numbers or learner records during discovery.

## 4. Demonstration script (30 minutes, synthetic data only)

| Min | Segment | What we show | What we listen for |
|---|---|---|---|
| 0–3 | Context | Why Elekeza exists; that this is a validation visit, not a sale | Their framing of the problem |
| 3–8 | Guardian view | A guardian logging in and seeing **only** their own child's school dates | "How would our parents get this?" |
| 8–13 | County-scoped dates | A Nairobi date appearing to a Nairobi guardian and not to a Kisumu one | Whether county scoping matters to them |
| 13–18 | Teacher view | A teacher assigning reading to a class, viewing progress | Whether the workflow matches their day |
| 18–23 | Learner view + accessibility | Reading toolbar and text-to-speech on a phone-sized screen | Whether it would work for their SNE learners |
| 23–27 | Offline/low-bandwidth | What happens on a weak connection | Their real connectivity constraints |
| 27–30 | Honest limits | What is **not** built yet (fees, messaging, AI in front of children) | Whether the gaps are disqualifying |

Rules for the session: never show real learner data; never claim a feature that is not demonstrated; if a question cannot be answered, say so and record it.

## 5. Questionnaires

### 5.1 School discovery questionnaire (leadership, ~20 min)
1. How many learners, and across which grades?
2. Which of these do you do on paper today: attendance, assignments, school dates, fee reminders, guardian communication?
3. What breaks most often in a term?
4. How do guardians currently learn about school dates? How many miss them?
5. Do you have reliable internet? Where?
6. What devices could a teacher use in class? What could a learner use at home?
7. What would a pilot need to prove for you to continue after one term?
8. Who else must approve a pilot, and what would they ask?
9. Are there learners with accessibility needs we must design for? Which?
10. Is there anything about learner data you would not allow to leave the school?

### 5.2 Teacher workflow questionnaire (~20 min, 2–3 teachers)
1. Walk me through yesterday: what did you do that a system could have done?
2. How do you assign reading or homework now? How do you know who did it?
3. How long does marking/recording take per week?
4. What device would you use, and for how long in a day?
5. What would make you stop using this after two weeks?
6. What would you need to see to trust the learner progress numbers?
7. How do you communicate with guardians now, and in what language?
8. Which of your learners would need the reading aids most, and would they use them?

## 6. Issue reporting and notes

### 6.1 Issue template
```
ID:            SCH-<nnn>
Observed:      <what happened>
Expected:      <what should happen>
Severity:      blocker | major | minor | cosmetic
Context:       role / device / network / screen
Synthetic data used: yes/no
Evidence:      screenshot or note reference
Owner / status:
```

### 6.2 Meeting notes template
```
Date / school / attendees (roles, not personal data):
Purpose:
What we demonstrated:
What they told us (verbatim quotes, attributed by role):
Surprises / contradictions:
Blockers they named:
Next step and owner:
```

### 6.3 Validation summary template
```
School (type, size, location — no learner identities):
Sessions held:
Problems confirmed:
Problems we assumed but did not confirm:
Features they need that we do not have:
Features we have that they do not want:
Accessibility observations:
Connectivity reality:
Decision-maker and next gate:
Go / no-go recommendation (engineering view):
```

## 7. Data protection position to state to the school

Say this plainly, in these terms:

- Any demonstration uses **synthetic** learners and guardians. No real learner information is entered.
- A pilot would require the school's written authorisation and guardian consent, and a data-protection review before any real learner record is created.
- **That review has not been completed yet**, so no real learner data may be collected at this stage.
- Any learner-level data would be limited to what the pilot needs, held for a defined period, and removable on request.

Do not improvise beyond this. Do not say data is "secure" or "compliant" — no assessment supports that claim.

## 8. Authorisation required

| Item | Who |
|---|---|
| Permission to approach a specific school | Founder |
| Named contact and introduction route | Founder / existing relationship |
| Staging environment for the demo | Engineering (blocked on provider approval) |
| Approval to collect any real data | Not granted; requires legal review first |

## 9. Success criteria for this plan

The plan has succeeded when we can answer, with the school's own words and not our assumptions:

1. Which problem they will judge us on.
2. Whether our proven journeys (guardian visibility, school dates, teacher assignment) map onto their term.
3. Whether their devices and connectivity can carry it.
4. What accessibility work is non-negotiable.
5. Who must approve, and what they will ask.

A "no" from a school that names its reason is a successful validation. An enthusiastic "yes" without a named problem is not.
