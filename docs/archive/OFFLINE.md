# Elekeza — Offline / Sync Design

## What offline means here

Offline support is **real synchronization**, not cached pages. The PWA (via
`next-pwa`) caches lesson/quiz/progress/notification responses for reading
offline, and a **local action queue** persists learner answers so nothing is
lost when the network drops mid-quiz.

## Architecture

```
Quiz answer (offline)
      │
      ▼
IndexedDB "elekeza-offline" / "sync-queue"   ← idb, keyPath: id
      │  (each action carries an idempotency key = crypto.randomUUID())
      ▼
navigator 'online' event → flushQueue()
      │
      ▼
POST /api/quiz/{quizId}/answer
      │  header: Idempotency-Key: <uuid>
      ▼
Backend deduplicates per (attemptId, questionId) — replayed actions
are no-ops, so duplicate submissions are impossible by design
      │
      ▼
Action deleted from the queue on success
```

## Components

| Piece | Location | Role |
|---|---|---|
| Queue + flush engine | `frontend/src/hooks/useOfflineSync.ts` | IndexedDB store, `queueAnswer()`, `flushQueue()`, `isOnline`, `pendingCount`, `syncError` |
| Quiz wiring | `frontend/src/app/quiz/[lessonId]/page.tsx` | Offline answers go to the queue; connectivity banner shows pending count; submit is blocked offline with a clear notice |
| Connectivity indicator | `frontend/src/app/student-lessons/page.tsx` | Real `navigator.onLine` state (no mocks) |
| PWA caching | `frontend/next.config.ts` | `NetworkFirst` for lesson/quiz-start/progress/notification APIs |
| Backend dedup | `QuizController.submitAnswer` / `completeQuiz` | Answers persisted idempotently per attempt+question |

## Guarantees

- **No lost answers**: every queued action survives reloads (IndexedDB) and
  retries with an attempt counter on failure.
- **No duplicates**: the idempotency key plus backend per-(attempt, question)
  dedup make a replayed or double-submitted answer a no-op.
- **No false claims**: the UI shows a real online/offline state and a pending
  sync count; it never implies synchronization that hasn't happened.
- **Graceful degradation**: offline quiz completion is not fabricated — the
  learner is told to submit again once connectivity returns, and the server
  scores the attempt from the synced answers.

## Verified offline scenario (pilot path)

1. Learner opens a lesson/quiz online (content cached).
2. Network drops; the banner shows "Offline — answers are saved locally".
3. Learner answers questions — each is queued in IndexedDB.
4. Network returns; the `online` event triggers `flushQueue()`.
5. Queued answers POST to the backend with idempotency keys; the queue drains.
6. Learner submits the quiz; the server scores it and progress updates.

## Known limits (documented, not hidden)

- Offline **completion** (final submit) requires connectivity — the server owns
  scoring and attempt state by design.
- The queue currently covers quiz answers only; lesson progress and other
  writes are not queued.
- The full disconnect/reconnect browser test should be re-run on the deployed
  site with the PWA enabled (dev mode disables the service worker).