# Elewa AI Service

**FastAPI microservice powering the AI layer of the Elewa adaptive learning platform.**

Elewa means *"to understand"* in Swahili. This service transforms any educational text or image into a personalised, simplified lesson with interactive quizzes and adaptive feedback — tailored to four cognitive learning profiles: Dyslexia, ADHD, Autism Spectrum, and Intellectual Disability.

---

## Table of Contents

- [What This Service Does](#what-this-service-does)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Running Locally (Development)](#running-locally-development)
- [Running with Docker](#running-with-docker)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Cognitive Profiles](#cognitive-profiles)
- [The 4-Stage Pipeline](#the-4-stage-pipeline)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Observability](#observability)
- [Switching AI Providers](#switching-ai-providers)
- [Integration with Spring Boot](#integration-with-spring-boot)
- [Known Limitations](#known-limitations)

---

## What This Service Does

This service sits between Harrison's Spring Boot backend and the Groq AI models. It receives raw educational content, runs it through a 4-stage simplification pipeline, and returns structured JSON that Spring Boot stores and the Next.js frontend renders.

It never touches the database. It never calls Spring Boot back. It receives context, calls AI, and returns structured JSON.

**Endpoints:**

| Endpoint | What it does |
|---|---|
| `POST /ai/simplify/text` | Simplifies raw text into a profile-appropriate lesson |
| `POST /ai/simplify/image` | OCR + simplification from an uploaded image |
| `POST /ai/quiz/generate` | Generates a quiz from a lesson |
| `POST /ai/quiz/adaptive-response` | Returns feedback and difficulty directive after a quiz answer |
| `POST /ai/quiz/wrong-answer-flow` | Re-explains a concept and generates a new question (parallel) |
| `GET /health` | Health check — no auth required |

---

## Architecture Overview

```
Next.js Frontend
      │
      │  (all calls go through Spring Boot — never directly to this service)
      ▼
Spring Boot Backend  ──── PostgreSQL
      │
      │  X-Internal-Key header (shared secret)
      │  http://ai-service:8000 (inside Docker)
      ▼
┌─────────────────────────────────────────────────────┐
│              Elewa AI Service (FastAPI)              │
│                                                     │
│  Stage 1: Build system prompt (pure function)       │
│  Stage 2: Simplification  →  LessonJSON             │
│  Stage 3: Verification    →  Correction if needed   │
│  Stage 4: Concept extract →  Key terms              │
│                                                     │
│  Groq (primary) / OpenAI / Anthropic / Google       │
└─────────────────────────────────────────────────────┘
      │
      ▼
Langfuse (self-hosted observability)
```

---

## Project Structure

```
ai-elewa/
│
├── main.py                          # FastAPI app, lifespan, middleware, routers
├── config.py                        # Provider selection, model names, temperatures
├── ai_client.py                     # Normalised wrapper — only file that touches AI SDKs
├── langfuse_client.py               # Observability — all traces go through here
├── security.py                      # X-Internal-Key middleware
│
├── pipeline/
│   ├── stage1_profile.py            # Build system prompt from profile templates
│   ├── stage2_simplify.py           # AI simplification call → LessonJSON
│   ├── stage3_verify.py             # Verification pass (fires only for >500 words)
│   └── stage4_concepts.py           # Concept extraction (pure function)
│
├── endpoints/
│   ├── simplify.py                  # /ai/simplify/text and /ai/simplify/image
│   └── quiz.py                      # /ai/quiz/* endpoints
│
├── models/
│   ├── requests.py                  # All inbound Pydantic schemas
│   ├── responses.py                 # LessonJSON and all response schemas
│   └── errors.py                    # ErrorResponse + error code constants
│
├── prompts/
│   ├── dyslexia.txt                 # Prompt rules for Dyslexia profile
│   ├── adhd.txt                     # Prompt rules for ADHD profile
│   ├── autism.txt                   # Prompt rules for Autism Spectrum profile
│   ├── intellectual_disability.txt  # Prompt rules for ID profile
│   └── COMORBID_RULES.md            # Priority rules for all 6 comorbid pairings
│
├── utils/
│   ├── ocr.py                       # Tesseract OCR — image → text
│   ├── retry.py                     # Retry + backoff logic
│   └── error_handler.py             # Shared error → HTTP response mapping
│
├── tests/
│   ├── test_retry.py                # Retry logic unit tests
│   ├── test_stage1.py               # Stage 1 profile prompt unit tests
│   ├── test_stage3_4.py             # Stage 3/4 unit tests
│   ├── test_error_handling.py       # Error handling unit tests (requires live server)
│   ├── test_ocr.py                  # OCR unit tests
│   ├── test_edge_cases.py           # Edge case tests (requires live server)
│   └── test_full_pipeline.py        # Full pipeline integration tests (requires live server)
│
├── tools/
│   ├── performance_audit.py         # Latency benchmarking script
│   ├── prompt_review.py             # Prompt quality review script
│   ├── performance_audit.md         # Audit results
│   ├── prompt_review_notes.md       # Quality review findings
│   └── performance_notes.md         # Latency analysis and production expectations
│
├── .env                             # Real secrets — NEVER commit
├── .env.example                     # Template — commit this
├── .gitignore
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── pytest.ini
```

---

## Prerequisites

### Local development (Windows)

- Python 3.13
- [Tesseract OCR for Windows](https://github.com/UB-Mannheim/tesseract/wiki) — install the `.exe`, default path `C:\Program Files\Tesseract-OCR\tesseract.exe`
- Docker Desktop — for Langfuse and Postgres
- A Groq API key — free at [console.groq.com](https://console.groq.com)

### Docker (full stack)

- Docker Desktop
- A Groq API key

---

## Running Locally (Development)

The AI service runs on your machine with `uvicorn`. Langfuse and Postgres run in Docker.

### Step 1 — Set up virtual environment

```powershell
cd ai-elewa
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
```

### Step 2 — Configure `.env`

```powershell
copy .env.example .env
```

Open `.env` and fill in the required values:

```env
AI_PROVIDER=groq
AI_API_KEY=your_groq_api_key_here

INTERNAL_SECRET=any_long_random_string_shared_with_harrison

LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=http://localhost:3000

TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### Step 3 — Start Langfuse and Postgres

```powershell
docker compose up langfuse postgres -d
```

Wait about 30 seconds, then open `http://localhost:3000`. Create an account, go to Settings → API Keys, generate keys, and add them to your `.env`.

### Step 4 — Start the service

```powershell
uvicorn main:app --reload --port 8000
```

Expected startup output:
```
✅ Config loaded — provider: groq | stage2: llama-3.3-70b-versatile | stage3: llama-3.1-8b-instant
✅ Langfuse connected successfully
✅ Groq async client initialised
INFO:     Application startup complete.
```

### Step 5 — Verify

```powershell
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

Open `http://localhost:8000/docs` in your browser for the interactive Swagger UI — the easiest way to test every endpoint.

---

## Running with Docker

Use this before handing over to Harrison. This runs the full stack inside Docker so Harrison's service can reach `http://ai-service:8000`.

### Step 1 — Update `.env` for Docker

```env
LANGFUSE_HOST=http://langfuse:3000
TESSERACT_CMD=
```

Setting `TESSERACT_CMD` to empty causes the service to auto-detect Tesseract from the Linux container's system PATH (`/usr/bin/tesseract`).

> **Tip:** Keep both values in `.env` as comments so you can switch easily:
> ```env
> # Local development:
> # LANGFUSE_HOST=http://localhost:3000
> # TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
>
> # Docker:
> LANGFUSE_HOST=http://langfuse:3000
> TESSERACT_CMD=
> ```

### Step 2 — Build and start

```powershell
docker compose up --build -d
```

First build takes 3–5 minutes. Subsequent builds are fast.

### Step 3 — Watch startup logs

```powershell
docker compose logs ai-service -f
```

Wait for:
```
✅ Groq async client initialised
INFO:     Application startup complete.
```

### Step 4 — Verify

```powershell
docker compose ps
```

Expected:
```
NAME              STATUS
ai-service        Up (healthy)
elewa-postgres    Up (healthy)
langfuse          Up
```

```powershell
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

### Stopping

```powershell
docker compose down        # stop containers, keep Langfuse data
docker compose down -v     # stop containers, delete all data
```

### Switching between local and Docker

| Mode | `LANGFUSE_HOST` | `TESSERACT_CMD` |
|---|---|---|
| Local (`uvicorn`) | `http://localhost:3000` | `C:\Program Files\Tesseract-OCR\tesseract.exe` |
| Docker | `http://langfuse:3000` | *(empty)* |

The `docker-compose.yml` sets both overrides automatically via its `environment` block, so you only need to update `.env` when switching back to local.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | Yes | `groq` / `openai` / `anthropic` / `google` |
| `AI_API_KEY` | Yes | API key for the selected provider |
| `INTERNAL_SECRET` | Yes | Shared secret with Harrison's Spring Boot. Must match exactly on both sides. |
| `LANGFUSE_PUBLIC_KEY` | Yes | From Langfuse → Settings → API Keys |
| `LANGFUSE_SECRET_KEY` | Yes | From Langfuse → Settings → API Keys |
| `LANGFUSE_HOST` | Yes | `http://localhost:3000` (local) or `http://langfuse:3000` (Docker) |
| `TESSERACT_CMD` | No | Windows: full path to tesseract.exe. Docker/Linux: leave empty for auto-detect. |

**Security rules:**
- Never commit `.env` — it is in `.gitignore`
- Only commit `.env.example` with all keys listed but no values
- `INTERNAL_SECRET` should be a minimum 32-character random string
- Rotate `AI_API_KEY` if it is ever exposed in logs, chat, or a commit

---

## API Reference

### Authentication

Every endpoint except `GET /health` requires:

```
X-Internal-Key: <value of INTERNAL_SECRET>
```

Missing or wrong header → `HTTP 401 UNAUTHORISED`.

---

### POST /ai/simplify/text

Simplifies raw text into a profile-appropriate `LessonJSON`.

**Request:**
```json
{
  "learner_context": {
    "learner_id": "abc-123",
    "cognitive_profiles": ["dyslexia"],
    "language_level": 2,
    "content_difficulty": 2,
    "pathway_stage": "Foundation"
  },
  "raw_text": "The full text content to be simplified..."
}
```

**Response — LessonJSON:**
```json
{
  "title": "The Water Cycle",
  "sections": [
    {
      "heading": "Water Moves Up",
      "body": "The sun heats water. Water turns into vapour. Vapour rises into the sky.",
      "visual_hint": "diagram of water evaporating from a lake",
      "reading_level": 2
    }
  ],
  "key_terms": [
    {
      "term": "Evaporation",
      "definition": "When water gets warm and turns into vapour that goes into the sky."
    }
  ],
  "estimated_minutes": 5,
  "profile": "dyslexia",
  "stage_flags": {
    "verification_triggered": false,
    "correction_applied": false,
    "profile_merged": false
  }
}
```

**Field constraints:**

| Field | Valid values |
|---|---|
| `cognitive_profiles` | 1 or 2 items only: `dyslexia`, `adhd`, `autism`, `intellectual_disability` |
| `language_level` | `1`, `2`, or `3` |
| `content_difficulty` | `1`, `2`, or `3` |
| `pathway_stage` | `Foundation`, `Intermediate`, `Pre-vocational`, `Vocational` |
| `raw_text` | Non-empty string, max 5000 words |

---

### POST /ai/simplify/image

OCR extraction + simplification from a base64-encoded image. Returns the same `LessonJSON` shape as `/ai/simplify/text`. Spring Boot does not need to know OCR was used — the response is identical.

**Request:**
```json
{
  "learner_context": { "...same as above..." },
  "base64_image": "<base64 encoded image string>",
  "media_type": "image/jpeg"
}
```

`media_type` valid values: `image/jpeg`, `image/png`, `image/webp`

---

### POST /ai/quiz/generate

Generates multiple-choice questions from a lesson.

**Request:**
```json
{
  "learner_context": { "...LearnerContext..." },
  "lesson_json": { "...full LessonJSON from /ai/simplify/text..." },
  "num_questions": 5
}
```

`num_questions`: integer 1–10.

**Response:**
```json
{
  "questions": [
    {
      "id": "q1",
      "text": "What happens to water when the sun heats it?",
      "options": [
        { "id": "a", "text": "It turns to ice" },
        { "id": "b", "text": "It turns to vapour and rises" },
        { "id": "c", "text": "It disappears" },
        { "id": "d", "text": "It gets heavier" }
      ],
      "correct_id": "b",
      "explanation": "When water gets warm, it evaporates and rises into the sky as vapour."
    }
  ]
}
```

---

### POST /ai/quiz/adaptive-response

Returns profile-appropriate feedback and a difficulty directive after a quiz answer.

**Request:**
```json
{
  "learner_context": { "...LearnerContext..." },
  "question": "What happens to water when the sun heats it?",
  "selected_option": "It turns to ice",
  "is_correct": false,
  "latency_ms": 4200
}
```

`latency_ms` — milliseconds from question display to answer submission. Captured at render time, not click time.

**Response:**
```json
{
  "learner_message": "That was not right. Let us try again. Take your time.",
  "directive": "revisit"
}
```

`directive` is always exactly one of: `easier` | `same` | `harder` | `revisit`

Harrison uses `directive` to decide what question to serve next. `learner_message` is shown directly in the UI — Victor renders it as-is, no modification.

**Directive logic:**

| Outcome | Latency | Directive |
|---|---|---|
| Correct | Fast (≤5000ms) | `harder` |
| Correct | Slow (>5000ms) | `same` |
| Wrong | Normal (≤5000ms) | `revisit` |
| Wrong | Slow (>5000ms) | `easier` |

---

### POST /ai/quiz/wrong-answer-flow

Re-explains a concept and generates a new version of the question. Both AI calls run in parallel via `asyncio.gather` — never sequential.

**Request:**
```json
{
  "learner_context": { "...LearnerContext..." },
  "question": "What happens to water when the sun heats it?",
  "section_content": "The full text of the lesson section this question came from..."
}
```

**Response:**
```json
{
  "re_explanation": "Water evaporation is simple. When water gets warm, it turns into steam. The steam floats up into the sky.",
  "reattempt_question": "Water turns into steam when it gets — hot or cold?"
}
```

Both fields are always present. This endpoint always costs two AI calls — it is slightly slower than single-call endpoints but never slower than two sequential calls would be.

---

### GET /health

No authentication required. Used by Docker healthchecks and Harrison's uptime monitoring.

```json
{ "status": "ok" }
```

---

## Cognitive Profiles

### Single profiles

| Profile | Primary barrier | Key output rules | Reading target |
|---|---|---|---|
| **Dyslexia** | Decoding | Max 12 words/sentence, active voice only, short headings (≤4 words) | Age 10–12 |
| **ADHD** | Sustained attention | Hook opening per section, max 4 sentences/section, numbered steps for processes | Varied rhythm |
| **Autism** | Ambiguity and unpredictability | Literal language only — no idioms, no metaphors, factual statement headings, explicit cause-and-effect | Factual precision |
| **Intellectual Disability** | Both axes — vocabulary and comprehension | Max 8 words/sentence, max 3 sections, 1000 common words only, every section ends with "Remember: [one sentence]." | Age 8–10 |

### Comorbid profiles (two profiles)

Send two values in `cognitive_profiles: ["dyslexia", "adhd"]`. The system applies a rule-by-rule priority merge based on `prompts/COMORBID_RULES.md` — not a concatenation of both prompts. `stage_flags.profile_merged` will be `true`.

| Pairing | What takes priority |
|---|---|
| Dyslexia + ADHD | ADHD chunking and structure; Dyslexia vocabulary and reading level |
| Dyslexia + Autism | Autism literal language (non-negotiable); Dyslexia sentence length |
| Dyslexia + ID | ID is the stricter baseline — all ID rules apply; Dyslexia adds active voice |
| ADHD + Autism | Autism structure dominates; ADHD engagement (hooks, dynamic visuals) layered on top |
| ADHD + ID | ID vocabulary limits are non-negotiable; ADHD chunking applied within those limits |
| Autism + ID | Most restrictive combination — both profiles' strictest rules |

---

## The 4-Stage Pipeline

Every call to `/ai/simplify/text` or `/ai/simplify/image` runs through four stages:

```
Stage 1 — Context Build        pure function, no API call, ~0ms
  ├── Loads profile prompt file(s) from /prompts/
  ├── Applies comorbid merge rules if two profiles are given
  ├── Injects language_level, content_difficulty, pathway_stage
  └── Returns: complete system prompt string

Stage 2 — Simplification       large model (llama-3.3-70b-versatile), ~2–5s
  ├── Sends system prompt + raw content to the AI
  ├── Validates response as LessonJSON with Pydantic
  ├── Retries once on schema failure with correction note appended
  └── Returns: validated LessonJSON

Stage 3 — Verification         fast model (llama-3.1-8b-instant), ~1–2s
  ├── ONLY fires if len(raw_text.split()) > 500
  ├── Checks simplified lesson for meaning distortions against original
  ├── Runs targeted correction pass if issues found
  ├── Sets stage_flags.verification_triggered = true
  └── Sets stage_flags.correction_applied = true if corrections were made

Stage 4 — Concept Extraction   pure function, no API call, ~0ms
  ├── Deduplicates key_terms (case-insensitive)
  ├── Removes terms with empty text or definitions
  └── Returns: clean final LessonJSON
```

`stage_flags` in every response tells Harrison exactly what ran:

```json
"stage_flags": {
  "verification_triggered": true,    ← content was over 500 words, Stage 3 ran
  "correction_applied": false,        ← Stage 3 ran but found no meaning distortions
  "profile_merged": true              ← two cognitive profiles were merged
}
```

---

## Error Handling

Every failure returns a structured `ErrorResponse`. Stack traces never reach Spring Boot under any condition.

```json
{
  "error_code": "TIMEOUT",
  "message": "The AI model did not respond in time. Please retry.",
  "stage": "stage2_simplify",
  "retried": true
}
```

### All error codes

| error_code | HTTP Status | Cause | What Harrison should do |
|---|---|---|---|
| `TIMEOUT` | 504 | AI model did not respond in time | Retry once after 2s |
| `RATE_LIMIT` | 429 | Too many requests to AI provider | Back off 5s, retry |
| `SCHEMA_INVALID` | 422 | Model returned invalid output after retries | Log it, show user generic error |
| `EMPTY_CONTENT` | 422 | `raw_text` is empty or whitespace only | Validate on frontend before sending |
| `OVERSIZED` | 413 | Content exceeded 5000 words | Split into chunks, send separately |
| `NON_ENGLISH` | 422 | Content is non-English or gibberish | Show user a language error message |
| `OCR_FAILED` | 422 | Tesseract could not extract text from image | Ask user to upload a clearer image |
| `UNAUTHORISED` | 401 | `X-Internal-Key` header missing or wrong | Fix the header — never show to user |

### Automatic retry behaviour

The service retries internally before returning an error to Spring Boot:

| Failure type | Retry behaviour |
|---|---|
| Rate limit (429 from provider) | Wait 1s → retry. Wait 2s → retry. Then return `RATE_LIMIT`. |
| Timeout | Retry once immediately. Then return `TIMEOUT`. |
| Schema invalid | Retry once with correction note appended to prompt. Then return `SCHEMA_INVALID`. |
| Maximum retries | 2 retries total, regardless of cause |

---

## Testing

### Unit tests — no server, no API calls

```powershell
pytest tests/test_retry.py tests/test_stage1.py tests/test_stage3_4.py tests/test_ocr.py -v
```

Covers retry logic, Stage 1 profile building (all 4 profiles + 2 comorbid combos), Stage 3/4 functions, and OCR cleaning. ~50 tests, completes in under 10 seconds.

### Error handling tests — requires live server

```powershell
# Terminal 1
uvicorn main:app --port 8000

# Terminal 2
pytest tests/test_error_handling.py -v -s
```

11 tests covering security (401), Pydantic validation (422), and empty/oversized/non-English content.

### Edge case tests — requires live server

```powershell
pytest tests/test_edge_cases.py -v -s
```

31 tests covering every documented error case across all endpoints — empty strings, oversized content, blank images, invalid field values, missing fields, and security cases.

### Full pipeline integration tests — requires live server, burns API tokens

```powershell
pytest tests/test_full_pipeline.py -v -s --timeout=120
```

55 tests. Runs all 4 profiles × 5 text samples (20 combinations), Stage 3 fire/no-fire verification, comorbid profiles, quiz generation, adaptive response, and wrong-answer flow. Takes 3–5 minutes due to rate-limit-safe delays. Run deliberately — not on every change.

### Run only unit tests (safe for CI)

```powershell
pytest tests/ -v -m "not live" --timeout=30
```

### Prompt quality review — requires live server

```powershell
python tools/prompt_review.py
```

Runs 5 texts × 4 profiles (20 combinations), scores each output against profile rules, writes findings to `tools/prompt_review_notes.md`. Current score: **89/95 checks passing (94%)**.

### Performance audit — requires live server

```powershell
python tools/performance_audit.py
```

Times every endpoint across short/medium/long content (5 runs each). Writes results to `tools/performance_audit.md`. Includes concurrency verification for `wrong-answer-flow`.

---

## Observability

Langfuse dashboard: `http://localhost:3000`

Every AI call creates a trace with stage name, cognitive profile, model, provider, token counts, latency, and retry information.

**What to check:**

| Check | Where in Langfuse |
|---|---|
| All calls completing successfully | Traces tab — look for any without a response |
| Retry rate per profile | Filter by `retried: true` in metadata |
| Slowest stages | Sort by `latency_ms` descending |
| Concurrency confirmation | Find two `wrong_answer_reexplain` + `wrong_answer_reattempt` traces — their timestamps should overlap |
| Rate limit spikes | Filter for `retry_cause: RATE_LIMIT` |

---

## Switching AI Providers

Change `AI_PROVIDER` in `.env` and restart. Zero other changes required. The pipeline, prompts, endpoints, and error handling are identical regardless of provider.

```env
AI_PROVIDER=openai   # or anthropic, google
AI_API_KEY=your_new_key
```

Update model names in `config.py` if desired (defaults are already set for all four providers):

| Provider | Stage 2 model (large) | Stage 3 model (fast) |
|---|---|---|
| `groq` | llama-3.3-70b-versatile | llama-3.1-8b-instant |
| `openai` | gpt-4o | gpt-4o-mini |
| `anthropic` | claude-opus-4-6 | claude-haiku-4-5-20251001 |
| `google` | gemini-1.5-pro | gemini-1.5-flash |

---

## Integration with Spring Boot

### Docker networking

Harrison's Spring Boot service must be on the same Docker network. Add it to `docker-compose.yml`:

```yaml
services:
  spring-boot:
    image: elekeza-backend:latest
    networks:
      - elewa-network

networks:
  elewa-network:
    driver: bridge
```

| Context | AI service URL |
|---|---|
| Inside Docker (Harrison's service calling it) | `http://ai-service:8000` |
| Local machine testing | `http://localhost:8000` |

### Spring Boot WebClient config

```java
@Bean
public WebClient aiServiceClient() {
    return WebClient.builder()
        .baseUrl("http://ai-service:8000")
        .defaultHeader("X-Internal-Key", System.getenv("INTERNAL_SECRET"))
        .build();
}
```

### Shared `.env` values Harrison needs

```env
INTERNAL_SECRET=<exactly the same value as in ai-elewa .env>
```

### Recommended timeouts

| Environment | Recommended WebClient timeout |
|---|---|
| Development (Groq free tier) | 30 seconds |
| Production (Groq paid tier) | 10 seconds |

### How Harrison should handle each error code

```
TIMEOUT (504)        → Retry once after 2s. If still failing, show "Please try again later."
RATE_LIMIT (429)     → Wait 5s, retry once. If still failing, queue the request.
SCHEMA_INVALID (422) → Log the request. Show user: "Something went wrong. Please try again."
EMPTY_CONTENT (422)  → This should be caught on your side. Validate raw_text before sending.
OVERSIZED (413)      → Split content into chunks of ≤4000 words. Send each chunk separately.
NON_ENGLISH (422)    → Show user: "Please upload content in English."
OCR_FAILED (422)     → Show user: "We could not read that image. Please try a clearer photo."
UNAUTHORISED (401)   → The X-Internal-Key header is wrong. Fix it. Never show this to users.
```

---

## Known Limitations

**Latency on Groq free tier**
Simplification calls take 4–8s on the Groq free tier due to queue delays. On Groq paid tier, expect 1.5–3s. `adaptive-response` takes 3–4s on free tier — target is under 800ms on paid tier. This is provider infrastructure, not a code issue.

**Reading level enforcement**
`language_level` (1/2/3) is passed to the model as an instruction. The model follows it most of the time, but there is no automated measurement confirming the output actually meets the requested readability target. Readability validation (measuring Flesch-Kincaid scores against profile targets and triggering correction if off) is a planned improvement.

**English only**
The pipeline is English-only. The architecture supports additional languages — separate prompt files per language — but no non-English prompts exist yet. Swahili support is planned for a later phase.

**Stateless**
The service has no memory between requests. A chatbot feature would require Spring Boot to maintain conversation history and pass it in each request.

**Free tier rate limits**
Groq free tier is 30 requests per minute. Running the full integration test suite (55 tests back to back) will hit this limit. The tests include rate-limit-safe delays. In production, upgrade to Groq paid tier (600 RPM) before onboarding real users.

---

## Team

**Elewa — Team Digitalis — Nairobi, Kenya 2026**

| Role | Person | Owns |
|---|---|---|
| AI Service | Alvin | FastAPI · Groq · 4-stage pipeline · Prompt templates |
| Backend & DB | Harrison | Spring Boot · PostgreSQL · JWT auth · REST APIs · File extraction |
| Frontend | Victor | Next.js 14 · Tailwind CSS · Cognitive profile UI |

---

*Learn deeply. Understand fully.*
