# Elekeza — AI Cost Model
**Status:** Pre-pilot estimate — update with real usage data after Month 1  
**Pricing basis:** Groq API, September 2026 public pricing  
**Author:** Alvin / AD Group Africa  

---

## Model Strategy

Elekeza uses two model tiers deliberately:

| Role | Model | Why |
|---|---|---|
| Stage 2 — Simplification | `llama-3.3-70b-versatile` (large) | High-quality lesson rewriting requires the large model |
| Stage 3 — Verification | `llama-3.1-8b-instant` (fast) | Structural checks only — fast model is sufficient |
| Stage 3b — Readability correction | `llama-3.1-8b-instant` (fast) | Targeted rewrites — fast model, low latency |
| Quiz generation | `llama-3.1-8b-instant` (fast) | Structured JSON output — fast model handles this well |
| Adaptive response | `llama-3.1-8b-instant` (fast) | Simple directive + message — fast model only |
| Wrong answer re-explanation | Mixed: large for re-explain, fast for reattempt | Re-explanation quality matters; reattempt question does not |
| Tutor chat | `llama-3.1-8b-instant` (fast) | Conversational — fast model, low latency, lower cost |

This two-tier strategy means the expensive large model only runs once per
lesson simplification. Everything else uses the fast model.

---

## Groq Pricing (September 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| `llama-3.3-70b-versatile` | $0.59 | $0.79 |
| `llama-3.1-8b-instant` | $0.05 | $0.08 |

Groq free tier: 30 requests per minute, 6,000 requests per day.
Groq paid tier: required for pilot. Cost above. No minimum commitment.

---

## Token Estimates Per Operation

### Lesson Simplification (`/ai/simplify/text`)
Called once per lesson per learner per content upload.
A teacher uploads a lesson — it is simplified once and stored.
Learners read the stored result. This is NOT called per learner read.

| Stage | Model | Est. input tokens | Est. output tokens |
|---|---|---|---|
| Stage 2 — simplify | Large | 1,500 | 800 |
| Stage 3 — verify | Fast | 1,200 | 400 |
| Stage 3b — readability (fires ~30% of lessons) | Fast | 600 | 300 |

**Cost per simplification:**
- Stage 2: (1,500 × $0.59 + 800 × $0.79) / 1,000,000 = $0.00147
- Stage 3: (1,200 × $0.05 + 400 × $0.08) / 1,000,000 = $0.000092
- Stage 3b (30% chance): (600 × $0.05 + 300 × $0.08) / 1,000,000 × 0.3 = $0.0000117
- **Total per lesson: ~$0.0016**

This is a teacher-side cost, not a per-learner cost.
Assuming 20 lessons simplified per school per month:
**~$0.032 per school per month for simplification.**

---

### Quiz Generation (`/ai/quiz/generate`)
Called once per lesson per learner session (when the learner finishes a lesson).

| Model | Est. input tokens | Est. output tokens |
|---|---|---|
| Fast | 800 | 400 |

**Cost per quiz:** (800 × $0.05 + 400 × $0.08) / 1,000,000 = **$0.000072**

---

### Adaptive Response (`/ai/quiz/adaptive-response`)
Called once per quiz question answered.
Average quiz: 5 questions.

| Model | Est. input tokens | Est. output tokens |
|---|---|---|
| Fast | 300 | 100 |

**Cost per adaptive response:** (300 × $0.05 + 100 × $0.08) / 1,000,000 = **$0.000023**
**Cost per quiz (5 questions):** $0.000115

---

### Wrong Answer Re-explanation (`/ai/quiz/wrong-answer-flow`)
Called when a learner answers wrong. Estimated 40% of questions answered wrong.

| Stage | Model | Est. input tokens | Est. output tokens |
|---|---|---|---|
| Re-explanation | Large | 600 | 300 |
| Reattempt question | Fast | 400 | 150 |

**Cost per wrong answer flow:**
- Large: (600 × $0.59 + 300 × $0.79) / 1,000,000 = $0.000591
- Fast: (400 × $0.05 + 150 × $0.08) / 1,000,000 = $0.000032
- **Total: $0.000623**

**Cost per quiz (5 questions, 40% wrong):**
2 wrong answers × $0.000623 = **$0.00125**

---

### Tutor Chat (`/ai/tutor/chat`)
Called per tutor message. Not every learner uses the tutor.
Pilot assumption: 30% of learners use tutor, average 4 messages per session,
2 sessions per week.

| Model | Est. input tokens | Est. output tokens |
|---|---|---|
| Fast | 500 | 200 |

**Cost per tutor message:** (500 × $0.05 + 200 × $0.08) / 1,000,000 = **$0.000041**
**Cost per tutor session (4 messages):** $0.000164
**Cost per active tutor learner per month (8 sessions):** $0.00131

---

## Cost Per Learner Per Month

### Assumptions
- 4 lessons completed per learner per month
- 1 quiz per lesson (4 quizzes/month)
- 5 questions per quiz
- 40% wrong answer rate
- 30% of learners use tutor, 8 sessions/month per active tutor user

### Per learner per month breakdown

| Activity | Cost |
|---|---|
| Quiz generation (4) | 4 × $0.000072 = $0.000288 |
| Adaptive responses (20 questions) | 20 × $0.000023 = $0.00046 |
| Wrong answer flows (8 wrong answers) | 8 × $0.000623 = $0.004984 |
| Tutor (30% of learners, 8 sessions) | 0.3 × 8 × $0.000164 = $0.000394 |
| **Total per learner per month** | **~$0.006** |

Lesson simplification is a teacher cost, not per-learner. Excluded here.

**The AI cost per learner per month is approximately $0.006 — less than one US cent.**

---

## Scale Scenarios

| Learners | AI cost/month | AI cost/year |
|---|---|---|
| 100 | $0.60 | $7.20 |
| 500 | $3.00 | $36.00 |
| 1,000 | $6.00 | $72.00 |
| 5,000 | $30.00 | $360.00 |

Teacher-side simplification (20 lessons/school/month):

| Schools | Simplification cost/month |
|---|---|
| 5 schools | $0.16 |
| 25 schools | $0.80 |
| 50 schools | $1.60 |
| 250 schools | $8.00 |

**Combined total at 5,000 learners across 50 schools: ~$32/month.**

---

## Caching Opportunities

Several AI outputs are deterministic enough to cache:

| Output | Cache strategy | Saving |
|---|---|---|
| Simplified lesson | Cache by lesson hash + profile + level. Same lesson for same profile never re-simplifies. | ~80% reduction in simplification calls |
| Quiz for a lesson | Cache by lesson hash + profile + num_questions. Same quiz for same lesson until lesson changes. | ~60% reduction in quiz calls |
| Tutor common questions | Cache top 20 most-asked questions per lesson. Serve cached answer instantly. | ~20% reduction in tutor calls |

With caching, the $0.006 per learner per month estimate drops to roughly
$0.002–0.003 for active schools with stable lesson libraries.

---

## Deterministic Alternatives (No AI Cost)

Some features currently routed through AI can be made deterministic:

| Feature | Current | Alternative |
|---|---|---|
| `read_aloud` tutor action | AI generates a reading script | Return the lesson body text directly — the frontend uses TTS |
| `summarise` tutor action for short lessons | AI summarises | Extract first sentence of each section — sufficient for Level 1 learners |
| Readability score display | Computed locally via `textstat` | Already deterministic — zero AI cost |

Implementing these two alternatives removes roughly 15% of tutor AI calls
at no quality cost.

---

## Fallback Strategy

When the AI provider is unavailable or the API key is missing,
the service returns graceful fallbacks rather than failing.

| Endpoint | Fallback behaviour |
|---|---|
| `/ai/simplify/text` | Return error with profile-appropriate learner message. Teacher retries. |
| `/ai/quiz/generate` | Return error. Harrison serves a cached quiz if available, or shows "quiz unavailable" message. |
| `/ai/tutor/chat` | Return `fallback: true` with a static "I am not available right now" message. |
| `/ai/quiz/adaptive-response` | Return `directive: "same"` as a safe default — neither harder nor easier. |
| `/ai/quiz/wrong-answer-flow` | Return the original lesson section text as re-explanation. No reattempt question generated. |

The `fallback` field on `TutorChatResponse` exists precisely for this —
Harrison's frontend checks it and renders a static message rather than
displaying a blank response.

---

## Provider Abstraction

The service currently supports four providers via `config.py`:
`groq`, `openai`, `anthropic`, `google`.

Switch provider by changing `AI_PROVIDER` in the environment.
No code changes required. This means:

- If Groq pricing changes, switch to OpenAI in one environment variable.
- If a cheaper African-region provider emerges, add it to `ai_client.py`
  and switch.
- For the pilot: stay on Groq. It is the fastest and cheapest at this scale.

**OpenAI equivalent cost at 5,000 learners for comparison:**
GPT-4o-mini at $0.15/$0.60 per 1M tokens would cost approximately
$120/month vs Groq's $30/month — 4× more expensive for the same output
quality at this task type.

---

## Monitoring Requirements

Track these metrics from Langfuse from Day 1 of the pilot:

- Tokens per request per endpoint — catch prompt bloat early
- Cost per learner per week — alert if > $0.02 (3× estimate)
- Tutor usage rate — if > 60% of learners, tutor cost triples estimate
- Wrong answer rate — if > 60%, wrong-answer-flow cost doubles estimate
- Stage 3b trigger rate — if > 50% of lessons trigger correction, review prompt quality
- Fallback rate — if > 5% of requests return fallback, provider has reliability issues

Update this cost model after Month 1 of the pilot with real numbers.
All figures above are pre-pilot estimates.