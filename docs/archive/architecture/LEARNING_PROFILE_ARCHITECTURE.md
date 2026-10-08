# Learning Profile Architecture

## Overview

```
learner preference writes (EXPLICIT / TEACHER / GUARDIAN)
        │
        ▼
LearnerProfile.preferences["learning"]   (JSONB key/value + source metadata)
        │
        ▼
effective profile = resolve(EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM)
        │
        ▼
adaptation code (default)  ──►  content_adaptations cache (learner, content, code)
        │
        ▼
deterministic local transform  OR  AI transform → AdaptationSafety.validate
        │
        ▼
learner presentation   ◄── "Back to the original" always available
```

## Existing building blocks reused

The personalization stack deliberately extends what Elekeza already had
instead of replacing it:

* `LearnerProfile` (JPA entity, one per user) — its `preferences` JSONB column
  is the canonical store of the learning-presentation profile under the
  `"learning"` namespace.
* `Content` / `ContentRepository` and the existing lesson-view flow — the
  adaptation engine reads the same text the lesson page renders.
* `ContentAccessGuard` — the exact same authorization used for lesson reads is
  applied to adaptation reads, so adaptation can never widen access.
* `AiClient` / `SimplifyTextRequest` — the existing AI abstraction; when
  `ai.client.type=real` the engine sends only the learner id and content text
  (no PII, no labels) and validates output.
* Frontend lesson page, quiz flow, sidebar, teacher/guardian layouts.
* Workbox PWA service worker (`/api/content/*` and now
  `/api/learner/preferences` NetworkFirst caches).

## New components (backend)

| Component | File | Responsibility |
| --- | --- | --- |
| Preference model | `personalization/LearningPreferences.kt` | `Source` enum, value enums, `PreferenceEntry`, `LearningSignal`, `TextAdaptation` (deterministic transforms), `AdaptationSafety`, `SignalAccumulator` |
| Service | `personalization/PersonalizationService.kt` | read/write preferences, precedence resolution, observed-signal accumulation, teacher + guardian summaries |
| Adaptation | `personalization/ContentAdaptationService.kt` | variant selection, cache, generate/validate/fallback, feedback → signals, event recording |
| Entities | `personalization/PersonalizationEntities.kt` | `ContentAdaptation`, `AdaptationEvent` + repositories |
| Controllers | `personalization/PersonalizationControllers.kt` | learner, adaptation/feedback, teacher, guardian endpoints |

## Preference storage

`LearnerProfile.preferences` is a JSONB map. The `"learning"` namespace holds
one entry per preference key:

```json
{
  "learning": {
    "density":         { "v": "SPACIOUS",  "s": "EXPLICIT", "c": 1.0, "e": 0 },
    "explanationStyle":{ "v": "STEP_BY_STEP","s": "EXPLICIT","c": 1.0, "e": 0 },
    "exampleFrequency":{ "v": "HIGH",      "s": "EXPLICIT", "c": 1.0, "e": 0 },
    "textSize":        { "v": "LARGE",     "s": "TEACHER",  "c": 1.0, "e": 0 },
    "visualSupport":   { "v": "true",      "s": "EXPLICIT", "c": 1.0, "e": 0 },
    "readAloud":       { "v": "true",      "s": "EXPLICIT", "c": 1.0, "e": 0 }
  }
}
```

Compact keys keep the JSONB documents small; `s` records the source of every
value so nothing is ever presented as the learner's own choice unless it is.

**Resolution.** Missing keys resolve to `SYSTEM` defaults
(`CONCISE`, `MEDIUM`, …). Present keys resolve by source precedence:
`EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM`.

**Precedence enforcement.** Writes carry the source. A learner write is always
accepted (they can change their own mind). Teacher/guardian guidance is
rejected (`409 Conflict`) when the target key already holds an `EXPLICIT`
learner choice. Observed signals only become persistent preferences through
`SignalAccumulator` (≥ 3 events, confidence ≥ 0.6, with time decay).

## Adaptation caching

Table `content_adaptations` (Flyway V7):

* key: `(learner_id, content_id, adaptation_code)` — UNIQUE;
* `source_text_hash` guards against serving a stale variant when the source
  lesson changes;
* `adapted_text` is the rendered variant.

The cache key is learner-scoped, so Student A can never receive Student B's
adaptation: the lookup includes `learner_id`, and every adaptation endpoint
passes through `ContentAccessGuard` first. Integration tests assert
cross-learner and cross-institution adaptation reads return 403.

## Events / audit

Every important action writes an `adaptation_events` row
(`learner_id`, `content_id`, `event_type`, `detail`, `created_at`):

* `ADAPT_VIEW` — variant served (cached or not, logged in detail);
* `ADAPT_GENERATED` — new variant created (source LOCAL/AI);
* `FEEDBACK` — helpful/not, with the code.

These rows enable observability (which adaptations are requested, fallback
rates, cache hits, feedback) without storing sensitive content.

## Migration

`db/migration/V7__personalization.sql` creates the two tables plus indexes.
The migration is additive, `ddl-auto=validate`-safe, and validated on the
existing demo/schema baseline and on a clean database (see acceptance doc).

## API surface

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/learner/preferences` | learner | effective profile map |
| PUT | `/api/learner/preferences` | STUDENT | set own preference (`{key, value}`) |
| GET | `/api/content/lessons/{id}/adapted?code=` | lesson access | get a variant (`original`, `clearer`, `step_by_step`, `spaced`, `detailed`; empty = profile default) |
| POST | `/api/content/lessons/{id}/feedback` | lesson access | `{helpful, code}` feedback |
| GET | `/api/teacher/student/{studentId}/learning-support` | TEACHER/SCHOOL_ADMIN/ADMIN | support summary (institution-scoped) |
| POST | `/api/teacher/student/{studentId}/learning-preferences` | TEACHER/SCHOOL_ADMIN/ADMIN | teacher guidance (`{key, value}`); 409 if the learner chose that key |
| GET | `/api/guardian/wards/{wardId}/learning-support` | GUARDIAN/ADMIN | plain-language ward summary (linked ward only) |

All endpoints re-use the existing security rules; role guards and
institution/ownership checks are enforced server-side (never frontend-only).

## Security model

* Institution isolation: teacher/guardian summaries verify the target student
  belongs to the caller's institution or guardian link before returning data.
* Learners cannot read or write other learners' profiles (own-preferences
  endpoints resolve the caller from the authenticated principal).
* Adaptation endpoints enforce `ContentAccessGuard` (the same rule as lesson
  reads), so adaptation cannot expand content access.
* Every summary is filtered through the no-diagnostic-language rule — the
  phrase list lives in `TextAdaptation.AdaptationSafety` and is unit-tested.

## Privacy

* No unnecessary PII is sent to AI providers — only learner id + content text.
* Adaptation rows are keyed by learner id and never expose one learner's
  variants to another.
* No diagnostic terms are stored or derived by the personalization engine.
  The legacy `LearnerProfile.sneType` field (school-recorded SNE data from the
  pre-personalization model) is not read by any adaptation/summary path.
