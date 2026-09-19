# AI / Groq Integration — Elekeza

## Overview

The application uses a **provider abstraction** pattern for AI services, supporting both a real Groq provider and a mock provider for offline development/testing.

The abstraction is already fully implemented. No new code is needed — the following components exist:

| Component | File | Conditional |
| --- | --- | --- |
| **AiClient interface** | `common/ai/AiClient.kt` | — |
| **RealAiClient** (Groq) | `common/ai/RealAiClient.kt` | `@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "real")` |
| **MockAiClient** | `common/ai/MockAiClient.kt` | `@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "mock")` |

---

## 1. Provider Abstraction

The `AiClient` interface defines the contract:

```kotlin
interface AiClient {
    fun simplifyText(request: SimplifyTextRequest): LessonJSON
    fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}
```

### Implementations

| Provider | Class | Activation |
| --- | --- | --- |
| **Real** (Groq API) | `RealAiClient` | `ai.client.type=real` (default) |
| **Mock** (offline) | `MockAiClient` | `ai.client.type=mock` |

---

## 2. Real Provider (Groq)

**Activation:** Set `AI_CLIENT_TYPE=real` (default in `application.yaml`).

**Environment Variables** (from `application.yaml` / `application-dev.yaml`):

| Variable | Description | Default |
| --- | --- | --- |
| `ai.base-url` | API base URL | `http://ai-service:8000` |
| `ai.internal-secret` | Internal auth key for the Python AI service | (required) |
| `ai.timeout-seconds` | Request timeout in seconds | `60` |

**Endpoints Called** (via internal Python AI service at `ai.base-url`):

| Method | Path | Purpose |
| --- | --- | --- |
| `POST /ai/simplify/text` | Simplify raw text into a lesson |
| `POST /ai/simplify/image` | Describe an image for a lesson |
| `POST /ai/quiz/generate` | Generate quiz questions from lesson content |
| `POST /ai/quiz/adaptive-response` | Provide feedback on a learner's answer |
| `POST /ai/quiz/wrong-answer-flow` | Provide re-explanation when learner gets a question wrong |

**Behavior:**

- Uses **OpenAI-compatible** JSON request/response format.
- **Timeout:** 60 seconds (configurable via `ai.timeout-seconds`).
- **Error handling:** On HTTP error, logs a warning and falls back to the request text (does not crash the app).
- **Circuit Breaker:** Integrated via `CircuitBreakerRegistry` — after 5 failures, the circuit opens and calls fail fast with "Service temporarily unavailable" for 30 seconds, then moves to HALF-OPEN to test recovery.
- **Retry:** `RetryUtil.withRetry()` with exponential backoff (1s, 2s, 4s) for transient failures.

**Production Requirements:**

- **Groq API key** — required for real AI calls. Obtain from [Groq Console](https://console.groq.com/).
- **AI Internal Secret** — the Python AI service (`ai-service`) must be configured with this secret to authenticate with Groq.
- **Model** — Groq model name (e.g., `mixtral-8x7b-32768`, `llama3-8b-8192`).

**If Groq credentials are unavailable:** switch to `ai.client.type=mock` (see below). The app boots and all features work without real AI.

---

## 3. Mock Provider (Offline / Development)

**Activation:** Set `AI_CLIENT_TYPE=mock`.

**Behavior:**

- `simplifyText()` returns a `LessonJSON` with title "Mock Lesson", a single section, a mock key term, and the cognitive profile from the request (or "dyslexia" as default).
- `simplifyImage()` returns a `LessonJSON` with title "Mock Image Lesson", a single section, and the cognitive profile.
- `generateQuiz()` returns a `QuizJSON` with one placeholder question ("What is the main idea?") and 4 options.
- `adaptiveResponse()` returns a generic encouragement message.
- `wrongAnswerFlow()` returns a re-explanation and empty reattempt question.

**Use Cases:**

- Development and testing without external credentials.
- Offline-first mode — the app functions fully without internet.
- CI/CD test suites — no API keys needed.
- Fallback when Groq API is rate-limited or unavailable.

**Configuration:**

```yaml
ai:
  client:
    type: mock
```

---

## 4. Circuit Breaker & Retry

The circuit breaker pattern is integrated to prevent cascading failures:

| State | Trigger | Behavior |
| --- | --- | --- |
| **CLOSED** | Normal | Requests flow through. Failures are counted (threshold: 5). |
| **OPEN** | Tripped (5+ failures) | Requests fail fast immediately — no waiting. AI service gets 30s breathing room. |
| **HALF-OPEN** | After reset timeout (30s) | One request allowed through to test recovery. If successful, CLOSED. If failed, back to OPEN. |

**Retry Utility:** `RetryUtil.withRetry()` provides exponential backoff (1s, 2s, 4s) for transient failures. Used by the circuit breaker on HALF-OPEN transition.

---

## 5. Fallback Strategy

| Scenario | Action |
| --- | --- |
| Groq API key missing | App boots with warning: "Groq API key not configured — AI features disabled. Switch to mock mode." |
| Groq API error (429 rate limit) | Circuit breaker opens; requests fail fast. Retry after 30s. |
| Groq API timeout (>60s) | Circuit breaker counts failure; after 5 timeouts, circuit opens. |
| Groq API returns empty/invalid response | Logs warning; falls back to request text / placeholder response. |
| AI service (Python) down | Circuit breaker opens; frontend shows "AI service temporarily unavailable". |

**Key Point:** The abstraction allows switching between real and mock providers simply by changing `ai.client.type`. No code changes are needed.

---

## 6. API Key Security

- **Groq API key** must NOT be exposed to frontend code.
- The key is used only on the **backend** (RealAiClient).
- Environment variable: `AI_INTERNAL_SECRET` (for internal service auth) and Groq key stored in `.env` or Render secrets.
- **Never commit real keys.** `.env.example` uses placeholder: `<replace-with-valid-groq-api-key>`.

---

## 7. Production Checklist

| Item | Status |
| --- | --- |
| Groq account | ⏳ Required (obtain from console) |
| Groq API key | ⏳ Required (store as env var) |
| AI internal secret | ⏳ Required (for Python service auth) |
| Model configured | ⏳ e.g., `mixtral-8x7b-32768` |
| Circuit breaker thresholds | ✅ Default: 5 failures, 30s reset |
| Fallback to mock | ✅ `ai.client.type=mock` |
| Rate limit handling | ✅ Exponential backoff (1s, 2s, 4s) |
| Production monitoring | ⏳ Langfuse / Sentry for AI traces |

---

## 8. Local Development

```bash
# Use mock mode (no credentials needed)
export AI_CLIENT_TYPE=mock

# Or use real mode with a Groq key (not recommended for committed repos)
export GROQ_API_KEY=your-key-here
export AI_CLIENT_TYPE=real
```

```bash
# Verify the provider is active
./gradlew bootRun -Dai.client.type=mock
# AI calls will use MockAiClient → no network requests
```