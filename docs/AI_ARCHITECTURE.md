# ELEKEZA — AI ARCHITECTURE

> Canonical AI reference. Chain: **Next.js → backend `AiClient` → ai-elewa FastAPI → LLM provider**.

## 1. Components

| Layer | File(s) | Behaviour |
|---|---|---|
| Backend abstraction | `common/ai/AiClient.kt` | `simplifyText`, `simplifyImage`, `generateQuiz`, `adaptiveResponse`, `wrongAnswerFlow` |
| Real client | `RealAiClient.kt` (`ai.client.type=real`) | HTTP to ai-elewa; schema-validates responses (`LessonJSON`/`QuizJSON`); 60 s timeout |
| Mock client | `MockAiClient.kt` (`ai.client.type=mock`) | deterministic, clearly labelled (“Mock Lesson”); same code paths in CI |
| AI service | `ai-elewa/` FastAPI | auth `X-Internal-Key`; 4-stage pipeline: **stage1 profile → stage2 simplify (retry-with-correction) → stage3 verify → stage4 concept extraction**; models pinned via live catalog reconciliation (HEAD commit: Groq model IDs reconciled) |
| Provider | Groq/OpenAI/Anthropic/Google | selected by `AI_PROVIDER`; fails fast at boot on non-real provider |

## 2. Request/response contract

- Endpoints: `/ai/simplify/text`, `/ai/simplify/image`, `/ai/quiz/generate`,
  `/ai/quiz/adaptive-response`, `/ai/quiz/wrong-answer-flow` (see API.md).
- Auth: `X-Internal-Key` must equal ai-elewa `INTERNAL_SECRET` ↔ backend `AI_INTERNAL_SECRET`.
- Errors: structured (`SCHEMA_INVALID` etc.) with **learner-safe messages** (“Something went wrong.
  Please try again.”); no internal leakage; no fake success at any layer.

## 3. What AI is allowed to do (capability contract)

| Capability | Allowed | Guard |
|---|---|---|
| Explain/simplify a lesson | ✅ | curriculum preserved: all source sentences survive deterministic path; AI path validated for key-term preservation + length floor |
| Present step-by-step / spaced / clearer / detailed | ✅ | internal codes never shown; friendly labels only |
| Read aloud | ✅ | Web Speech TTS on device (not AI); gated by learner preference |
| Learning hints / tutor feedback | ✅ | `/ai/quiz/adaptive-response`, `wrong-answer-flow` |
| Help teacher understand progress | ✅ | summaries computed from stored data, not AI invention |
| Help guardian understand learning | ✅ | plain-language card from stored profile + progress |
| Diagnose, infer disability, grade clinically | ❌ | `AdaptationSafety` diagnostic-phrase blacklist; no diagnosis anywhere |
| Invent learner performance | ❌ | every insight originates from actual stored data |

## 4. Resilience (verified behaviour)

- Provider failure → structured error → backend falls back to raw text + honest message
  (acceptance journey AI-degradation 6/6).
- Retry-with-correction inside stage2 (schema-invalid output retried, bounded); circuit breaker on
  backend client (5 failures → fail-fast 30 s → half-open); exponential backoff 1/2/4 s.
- ai-elewa fails fast at boot if provider is mock/unset — **mock can never silently ship to prod**.
  *(Historic exception — the P0 internal-secret fail-open — was fixed + live-verified 2026-10-03;
  see §8.)*

## 5. Privacy & PII

- Personalization AI path: **neutral learner context + content text only** — no SNE labels, no PII
  beyond teacher-authored content; output screened before caching/display.
- Legacy content/quiz pipeline forwards the school-recorded SNE profile in real mode — documented
  deployment hardening item for r3+.
- No tenant data stored by the AI service; requests are stateless.
- Teacher guidance to anonymize lesson text is part of onboarding docs.

## 6. Observability & cost

- Optional Langfuse (`LANGFUSE_*`) for traces; adaptation cache prevents regeneration
  (unique learner+content+code + source-text hash); `adaptation_events` give attributable usage
  (view/generated/feedback) without logging sensitive content.
- Deterministic local transform is always available (offline-safe) — AI is an enhancement, never a
  dependency for learning.

## 7. Open items

| Item | Priority | Owner |
|---|---|---|
| ~~P0: `ai-elewa/security.py:10` `INTERNAL_SECRET` default `""` → fail-open~~ **FIXED 2026-10-03** (fail-closed, live-verified both directions; backend `dev-secret` fallbacks also removed from `RealAiClient.kt:18` + `AiWebClientConfig.kt:15`) | shipped in repo | remaining: AI r3 release authorization (Harry) |
| Real-provider E2E with production key (latency, quality thresholds) | P1 | after Groq credential provisioned |
| Legacy SNE forwarding removal in real mode | P2 | r3 hardening |
| AI evaluation dataset + acceptance thresholds | P2 | post-pilot |
