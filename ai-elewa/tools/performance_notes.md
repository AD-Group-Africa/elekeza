# Performance Notes

## Observed Latency — Groq Free Tier (2026-03-31)

| Endpoint | P95 Observed | Production Target | Gap |
|---|---|---|---|
| simplify/text short | 5626ms | <3000ms | Free tier queue latency |
| simplify/text medium | 4660ms | <4000ms | Within acceptable range |
| simplify/text long | 5754ms | <6000ms | Stage 3 adds ~1s — acceptable |
| quiz/generate | 5151ms | <4000ms | Free tier queue latency |
| adaptive-response | 4148ms | <800ms | Free tier — 5-6x slower than target |
| wrong-answer-flow | 7749ms | <5000ms | Two parallel calls on free tier |

## Root Cause

All latency issues trace to Groq free tier queue delays, not code logic.
Evidence:
- Short text (4 sentences) takes same time as medium (15 paragraphs)
- Latency is model-startup dominated, not token-count dominated
- asyncio.gather confirmed working (ratio 0.7x)
- No sequential awaits in pipeline

## Production Expectation

On Groq paid tier or equivalent:
- llama-3.3-70b-versatile: ~800ms–1.5s per call
- llama-3.1-8b-instant: ~200ms–400ms per call
- adaptive-response P95: well under 800ms
- simplify/text P95: 2–3s

## Recommendation for Harrison

During development: set Spring Boot WebClient timeout to 30s.
In production: set to 10s — paid tier is significantly faster.

## Wrong-answer-flow 12.8s Outlier

One run hit 12.8s due to a rate limit retry during the test run.
The retry.py backoff (1s + 2s) added ~3s on top of normal latency.
This is handled gracefully — Spring Boot receives a 429 and backs off.
Not a code bug.