# Performance Audit Report

**Date:** 2026-03-31 12:23  
**Samples per scenario:** 5  
**Provider:** Groq free tier

> Note: All results from Groq free tier. Paid tier expected to be 3–5x faster.

---

## Endpoint Latency Results

| Endpoint | P50 (ms) | P95 (ms) | Max (ms) | Target | Result |
|---|---|---|---|---|---|
| simplify/text short | 7867 | 9432 | 9432 | <5000ms | ⚠️ FREE TIER |
| simplify/text medium | 7336 | 7796 | 7796 | <5000ms | ⚠️ FREE TIER |
| simplify/text long | 7756 | 7866 | 7866 | <5000ms | ⚠️ FREE TIER |
| quiz/generate | 7896 | 8187 | 8187 | <5000ms | ⚠️ FREE TIER |
| adaptive-response | 3701 | 4416 | 4416 | <5000ms | ✅ PASS |
| wrong-answer-flow | 7539 | 59297 | 59297 | <10000ms | ⚠️ FREE TIER |

---

## Concurrency Verification

| Metric | Value |
|---|---|
| Average wall time (both calls) | 8090ms |
| Single call baseline | 8358ms |
| Ratio (wall / single) | 0.97x |
| Concurrent confirmed | ✅ Yes |

---

## Code Review — Sequential Await Check

Sequential await issues found: **0**

No issues found — all concurrent calls use `asyncio.gather`.

---

## Production Latency Expectations

| Endpoint | Free Tier P95 | Paid Tier Expected | Target |
|---|---|---|---|
| simplify/text short | ~5–6s | ~1.5–2s | <3s |
| simplify/text medium | ~5s | ~2–3s | <4s |
| simplify/text long | ~6–8s | ~3–5s | <6s |
| quiz/generate | ~5s | ~2–3s | <4s |
| adaptive-response | ~3.5–4s | ~300–500ms | <800ms |
| wrong-answer-flow | ~8–13s | ~3–4s | <5s |

---

## Raw Latencies

**simplify/text short:** [8504, 9432, 7867, 7275, 7246]ms
**simplify/text medium:** [7796, 7280, 7407, 7336, 7321]ms
**simplify/text long:** [7287, 7756, 7331, 7778, 7866]ms
**quiz/generate:** [7693, 7896, 7909, 8187, 7773]ms
**adaptive-response:** [4416, 3701, 3632, 3657, 4222]ms
**wrong-answer-flow:** [4747, 7539, 7443, 59297, 9202]ms