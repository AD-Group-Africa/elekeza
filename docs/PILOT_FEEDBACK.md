# PILOT FEEDBACK — Elekeza

Lightweight structure for capturing and classifying pilot feedback. Capture evidence
first; no feature request becomes engineering work without a signal.

## How feedback is collected

1. **Session notes** — coordinator observes the journey, writes what the user did
   and said (verbatim quotes are gold).
2. **Feedback sheet** — per session: what they tried / expected / what happened.
3. **Weekly interview** — 15 minutes per teacher/guardian; time-on-task questions.
4. **In-product signals** — usage events (completed lessons, attendance sessions,
   submissions, digest views) — real data, never fabricated.

## Classification (choose one primary label)

| Label | Meaning | Example |
| --- | --- | --- |
| `BUG` | System behaves contrary to spec | "Saving attendance creates duplicates" |
| `UX FRICTION` | Works, but confusing/slow/tiring | "Took me three taps to find the register" |
| `MISSING CAPABILITY` | A needed thing doesn't exist | "I can't attach a photo to the assignment" |
| `TRAINING ISSUE` | Product is fine; a demo fixes it | "I didn't know History was clickable" |
| `DATA ISSUE` | Wrong/inconsistent data | "My balance differs from the school ledger" |
| `PERFORMANCE ISSUE` | Too slow for context | "Register took 30s to load on the tablet" |
| `ACCESSIBILITY ISSUE` | Barrier for a real user | "Buttons too small for my student's motor control" |
| `FEATURE REQUEST` | Idea for later | "SMS me the digest" |

**Rule:** every `BUG` and `DATA ISSUE` gets reproduced before the next release
decision. `UX FRICTION` items are counted; the top 3 recurring ones go to the
product cycle. Everything else is logged, not acted on immediately.

## Weekly log template

```
Week: __  School: __  Sessions: __

Top frustrations (verbatim):
1.
2.
3.

Most-repeated requests:
1.
2.
3.

Things that worked well (keep doing):
1.
2.
```

## The two questions the pilot must answer

1. **What do real users struggle with?** (count friction points per journey)
2. **What do real users repeatedly ask for?** (count mentions per week)

If we can answer these two honestly after 3–4 weeks, the pilot succeeded —
regardless of how few bugs or how many, and regardless of feature counts.
