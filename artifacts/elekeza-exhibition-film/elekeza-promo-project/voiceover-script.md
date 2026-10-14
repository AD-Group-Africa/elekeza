# Voice-over script — Elekeza exhibition film

Final narration as heard in both cuts — `elekeza-exhibition-film.mp4` and
`elekeza-exhibition-film-vertical.mp4` (58.70 s each; their audio mixes are
byte-identical, so this script times both).

Voice used: **Microsoft Zira Desktop** (en-US), Windows SAPI, synthesised locally —
no cloud service, no credentials, no internet. This is a **scratch voice**: warm
enough to carry a first cut, but it is a synthetic read and should be replaced by a
human recording before the film is used publicly. Timing below is what a
replacement read must hit.

| # | Start | End | Len | Scene | Line |
|---|---|---|---|---|---|
| 1 | 0.50 | 5.84 | 5.34 s | opening | "Every learner is different. Every learner deserves the opportunity to thrive." |
| 2 | 6.33 | 11.26 | 4.93 s | brand | "Meet Elekeza. Inclusive learning and education infrastructure." |
| 3 | 12.13 | 19.03 | 6.90 s | product | "Learners get a clear daily path. Their lessons, their progress, all in one place." |
| 4 | 20.53 | 24.12 | 3.59 s | product | "And a reading mode shaped for the way each learner learns best." |
| 5 | 26.13 | 30.46 | 4.33 s | inclusive | "Accessibility settings shape how each learner experiences a lesson." |
| 6 | 33.03 | 39.00 | 5.96 s | inclusive | "Our vision: more accessible learning across different educational contexts and curricula." |
| 7 | 39.70 | 46.76 | 7.06 s | opportunity | "We're preparing to explore a proposed school pilot, working with educators to learn, validate and improve." |
| 8 | 52.60 | 56.33 | 3.73 s | closing | "Elekeza. Every learner deserves a way forward." |

Total spoken: 41.83 s across 8 lines. The last line ends 2.4 s before the picture
does, so the closing logo holds in silence — narration never runs over the logo.

## Full narration, unbroken

> Every learner is different. Every learner deserves the opportunity to thrive.
>
> Meet Elekeza. Inclusive learning and education infrastructure.
>
> Learners get a clear daily path. Their lessons, their progress, all in one place.
>
> And a reading mode shaped for the way each learner learns best.
>
> Accessibility settings shape how each learner experiences a lesson.
>
> Our vision: more accessible learning across different educational contexts and curricula.
>
> We're preparing to explore a proposed school pilot, working with educators to learn, validate and improve.
>
> Elekeza. Every learner deserves a way forward.

## Why it is worded this way

* **"By Afrika Digitalis" is not spoken** — it is already on screen under the logo.
  Saying it as well made the brand beat 1.3 s longer than it needed to be.
* **The accessibility categories are not listed aloud** (visual, focus, cognitive,
  audio, emotional). They are legible on the accessibility screen itself, and the
  caption underneath repeats them. Narrating them cost 4.5 s and said nothing the
  picture did not already say.
* **"Our vision"** is deliberate. It marks line 6 as an intention, not a shipped
  capability, which matches the honest-labelled state of this build.
* **"We're preparing to explore a proposed school pilot"** — proposed, not running.
  No deployment, no partner, no outcome and no testimonial is claimed anywhere in
  the film.
* The word **"all"** in line 3 refers only to a learner's own lessons, progress and
  assignments appearing in one product — not to curriculum coverage.

## Delivery notes for a re-record

* Warm, unhurried, confident. Roughly 120–135 wpm — the current read averages about
  120 wpm and the cut is timed to that.
* Line 1 is the emotional hook: give "deserves the opportunity to thrive" a little
  more weight than "Every learner is different."
* Lines 3–5 are the product walkthrough: keep them even and factual, no selling.
* Line 7 is the ask. Slow down slightly at "working with educators and partners".
* Line 8 is a signature, not a tagline: "Elekeza." then a real pause, then the rest.
* If a read comes in long, **do not clip it** — the timeline solver in
  `film_plan.resolve_timeline()` grows the owning scene instead. Re-run
  `make_voiceover.py` (or edit the durations) and re-render; the picture follows the
  voice.

## Replacing the voice

```bash
# 1. edit VO_LINES in film_plan.py, or drop your own assets/audio/vo-01..08.wav
# 2. regenerate the durations (reads your wavs if SAPI is skipped)
python make_voiceover.py
# 3. rebuild the music bed at the new length and re-render
python make_music.py
python assemble_film.py
```

If you supply your own recordings, keep them mono 44.1 kHz and trimmed to the
performance (the film trims nothing for you). Any length is fine — the timeline
absorbs it.
