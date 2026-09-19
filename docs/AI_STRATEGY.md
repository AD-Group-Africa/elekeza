# Elekeza — AI Strategy (12-Month Direction)
**Version:** v1.0 — pre-pilot draft  
**Review trigger:** Update after Month 1 pilot evidence  
**Author:** Alvin / AD Group Africa  

---

## Guiding Principle

Elekeza AI exists to help educators act and learners understand.
It does not replace teachers. It does not make high-stakes decisions
about learners. Every AI output is assistive and explainable — a teacher
or guardian can always see why something was flagged or suggested, and
they can always override it.

This principle is not a constraint imposed from outside. It is the right
design for African special education, where teacher relationships, parental
trust, and community accountability matter more than automation.

---

## What We Have Now (Pilot Baseline)

The v0.1.0 release ships with a functioning AI pipeline:

**Content pipeline** — a teacher uploads a lesson or pastes text.
The system simplifies it for the learner's cognitive profile (dyslexia,
ADHD, autism, intellectual disability, or comorbid combinations), verifies
the simplification did not lose meaning, measures readability against
profile-specific FK grade targets, auto-corrects sections that are
significantly outside the target range, standardises visual hints, and
attaches rhythm scores per section. The result is a structured lesson
JSON that Harrison's platform renders to the learner.

**Quiz pipeline** — generates profile-appropriate quiz questions from
the simplified lesson. Returns adaptive directives (easier/same/harder/
revisit) based on correctness and response latency. On wrong answers,
re-explains using a profile-keyed strategy and generates a new version
of the question.

**Tutor** — a conversational assistant the learner can talk to while
reading a lesson. Supports six actions: explain, practice, read aloud,
translate to Kiswahili, show a diagram description, summarise.
Returns a `fallback` flag when the AI provider is unavailable so the
frontend degrades gracefully.

**What this gives the pilot:**
Every learner gets content adapted to their cognitive profile. Every
wrong answer gets a re-explanation. Every learner has access to a
tutor. These are not features schools in Kenya currently have for
learners with special educational needs.

---

## The Four Phases

### Phase 1 — Tutor and Content Quality (Now — Month 3)
*Solidify what we have. Collect evidence. Fix what the pilot exposes.*

The Tutor is live but untested with real learners. The content pipeline
is tested against synthetic data but not real school curricula. Phase 1
is about finding out what actually happens when Victor uses the Tutor
and when a teacher uploads a real CBC lesson.

**Priorities:**
- Wire the Tutor into the frontend properly (currently a mock).
  Harrison connects `LearningCompanion.tsx` to `/ai/tutor/chat`.
- Collect Tutor usage logs from Langfuse from Day 1.
  Track: which actions learners use, which lessons generate the most
  Tutor requests, what questions get asked repeatedly.
- Collect wrong answer logs. Track: which concepts generate the most
  wrong answers, which re-explanations learners engage with vs skip.
- Collect readability correction trigger rate. If Stage 3b fires on
  more than 50% of lessons, the base prompts need improvement.
- Fix anything that breaks with real CBC content (Kenyan curriculum
  language patterns differ from the synthetic English used in testing).
- Do not add features. Observe and fix.

**Success signal for Phase 1:**
Tutor is used by at least 20% of learners without prompting.
Stage 3b trigger rate is below 40%.
No AI-generated content causes a teacher complaint.

---

### Phase 2 — Intelligence Signals (Month 1 — Month 6)
*Turn pilot data into actionable signals for teachers and guardians.*

By Month 1 the platform has real attendance records, real quiz scores,
real wrong answer patterns, and real Tutor usage. Phase 2 builds the
first intelligence layer on top of this data.

Intelligence in Elekeza means: a signal a teacher can act on today,
with an explanation they can understand, derived from data the platform
already has.

**Signals to build, in priority order:**

**Learner struggle signal**
When a learner answers the same concept wrong more than twice across
different quizzes, flag it to the teacher with the concept name and
the number of attempts. No AI needed — this is a database query.
Render it as: "Victor has answered questions about evaporation
incorrectly 3 times this week."

**Lesson engagement signal**
Track which lessons generate Tutor requests. A lesson with high Tutor
usage is a lesson learners find difficult. Surface this to the teacher:
"Learners asked the Tutor 12 questions about the water cycle lesson.
Consider reviewing it with the class."

**Attendance and performance correlation**
When a learner misses more than 2 consecutive days and then scores
below 60% on the next quiz, flag this to the teacher. Not a diagnosis —
a prompt. "Victor missed Tuesday and Wednesday. His quiz score on
Thursday was 40%. You may want to check in."

**Guardian digest intelligence**
The Guardian Daily Digest already exists. Phase 2 makes it smarter.
Instead of a generic "Victor completed 2 lessons today", send:
"Victor completed the water cycle lesson and got 4 out of 5 quiz
questions right. He asked the tutor 3 questions about evaporation —
this might be worth reviewing at home."

**Class-level trend**
For teachers: "60% of your class answered the photosynthesis quiz
below 50% this week. The most common wrong answer was option B
(confusion between photosynthesis and respiration)."

**Design rules for all intelligence signals:**
- Every signal names a specific learner, lesson, or concept.
  No vague "learner may be struggling."
- Every signal includes the data behind it.
  "3 wrong answers" not "repeated errors."
- No signal makes a clinical or diagnostic claim.
  "Victor found this lesson difficult" not "Victor shows signs of X."
- Teachers can dismiss or act on signals — the platform never acts
  automatically on a learner's behalf.

---

### Phase 3 — Adaptive Learning (Month 4 — Month 9)
*Use pilot evidence to personalise the learning pathway.*

The adaptive quiz directive (easier/same/harder/revisit) already exists
at the question level. Phase 3 extends this to the lesson and pathway level.

**Lesson difficulty auto-detection**
Add a `POST /ai/content/difficulty` endpoint that analyses lesson text
and returns a difficulty score (1–3) for the learner's profile.
Harrison uses this to suggest the right lesson to a learner next —
not too hard, not too easy.

**Pathway stage progression signal**
When a learner consistently scores above 80% across 3 lessons at their
current pathway stage, generate a signal for the teacher:
"Victor may be ready to move from Foundation to Intermediate.
His last 3 quiz averages: 82%, 85%, 88%."
The teacher decides. The AI signals. No automatic progression.

**Content gap detection**
When a learner consistently scores low on lessons containing certain
vocabulary (identified by key_terms in the lesson JSON), flag the
vocabulary gap. "Victor has answered questions involving the word
'evaporation' incorrectly 5 times. This word appears in 4 upcoming
lessons."

**Kiswahili lesson support**
The Tutor already translates to Kiswahili on request. Phase 3 adds
the ability to simplify lesson content in Kiswahili for learners whose
primary language is not English. This requires a Kiswahili-capable
model evaluation — confirm quality before shipping.

---

### Phase 4 — Intervention Intelligence (Month 7 — Month 12)
*Give school administrators and support staff the signals they need.*

Phase 4 operates at school level, not learner level. It is for the
school principal, the SNE coordinator, and the guardian support worker —
not the classroom teacher.

**At-risk learner cohort signal**
Identify learners who meet three or more of: attendance below 70%,
quiz average below 50%, Tutor not used in 2+ weeks, no guardian
digest engagement. Surface this cohort to the SNE coordinator weekly.
Not a diagnosis. A list of learners who may need a check-in.

**School-level content quality report**
Monthly report for the school admin: which lessons have the highest
wrong answer rates, which lessons trigger the most Tutor requests,
which lessons required the most readability corrections. This is
feedback to the content team, not a report on learners.

**Teacher support signal**
When a teacher has not uploaded new content in 3+ weeks and learner
engagement is declining, send a support prompt to the school admin.
Not a performance management tool — a welfare check.

**Fundraising and impact intelligence**
For AD Group Africa and funders: aggregate (never individual) metrics
on learner engagement, content quality, and AI usage. How many lessons
simplified. How many quiz questions answered. What the wrong answer rate
was before and after re-explanation.