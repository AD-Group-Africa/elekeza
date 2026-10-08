# TASK 5 — AI INTEGRATION EVIDENCE (from the real frontend)

All probes executed through the browser UI (Playwright) against FE :3100 → BE :8097 → AI :8001.
Screenshots in this directory (A00–A03); network/console captured per journey.

## Scenario matrix

| Scenario | API seen by browser | UI behaviour | Verdict |
|---|---|---|---|
| AI UP (released config) | `POST /api/tutor` 200; `POST /api/content/upload/text` 200 | Tutor renders grounded explanation; upload shows "AI has simplified your lesson. Review below." | FUNCTIONAL (live Groq) |
| AI DOWN (connection refused) | both 200 | Tutor: deterministic lesson-grounded fallback ("Here is the idea behind 'Understanding Fractions'…"); upload: **"AI service unavailable (Connection refused: …:8001) — content stored as-is"**; content saved READY with raw text | GRACEFUL DEGRADATION ✓ |
| INVALID provider credentials (`AI_API_KEY` overridden) | both 200 | Tutor: deterministic fallback after backend retries; upload: **structured error** `"error_code":"SCHEMA_INVALID","stage":"stage2_simplify","retried":true,"learner_message":"Something went wrong. Please try again."` + "content stored as-is" | STRUCTURED ERRORS ✓ |
| AI restored (released config) | both 200 | Tutor live response; upload "AI has simplified your lesson" again | RECOVERY ✓ |

## Observed retry behaviour (AI service log, invalid-key run)

- `tutor_chat`: 401 "Invalid API Key" → retry with correction note (attempt 1) → 401 → retry (attempt 2) → deterministic fallback served.
- `stage2_simplify`: 401 → retry (attempt 1) → structured SCHEMA_INVALID surfaced to backend.
- Healthy-key run earlier showed **provider Retry-After honored** (`Rate limit hit on quiz_generate — honoring provider Retry-After: 3.0s`).

## Secret exposure

- Browser content + localStorage + cookies scanned during invalid-key probe: **no key material / `INTERNAL_SECRET` / `sk-`-style tokens exposed** (`SECRET_EXPOSED_IN_BROWSER: false`).
- The internal AI endpoint is never called from the browser (network logs show only FE→BE `/api/*`; the X-Internal-Key lives server-side only).
- LOW note: degradation messages surface the internal AI host:port (`localhost:8001`) and the provider error type to the teacher UI. Honest and useful locally; consider suppressing in production builds (EL-NEW-03).

## Adaptive/learner-side AI evidence

- Quiz answers return server-marked correctness with `learnerMessage` + `Tip:` directive (adaptive coaching) — visible in learner journey screenshots.
- `/learner/preferences` effective sources rendered ("Chosen by you" / "Standard setting").
- `/dashboard/settings` mirrors `ttsEnabled` into the server accessibility profile (DB-verified).

## Files

- A00-tutor-down.png, A01-upload-down.png (AI down)
- A02-tutor-badkey.png, A03-upload-badkey.png (invalid provider key)
- down-observations.json, recovery-observations.json (captured UI text + API statuses)
- AI service logs (repo root): `ai-elewa-badkey.log`, `ai-elewa-badkey2.log`, `ai-elewa-recovery.log`, `ai-elewa-recovered.log`
