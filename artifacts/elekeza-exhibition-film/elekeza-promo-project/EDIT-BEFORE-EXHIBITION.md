# Before you screen this — checks and edits

Read the top section tonight; it is short. Everything below it is optional polish.

## 1. Must check tonight

1. **Watch it end to end once, on the screen you will actually use.** Play it from
   the MP4, not from the project. Confirm the narration is audible over the music
   at venue volume, and that nothing is cut off at the edges of the display — some
   projectors overscan, which would shave the orange progress line and the
   letterbox bars.
2. **Listen at venue volume.** The mix sits with speech about 12 dB above the bed.
   If the PA is mono or very small, the music may go muddy; if so re-render with
   `--no-music` (the narration still carries the film).
3. **Confirm the narration is acceptable as a scratch voice.** It is Microsoft
   Zira, a synthetic voice, warmed slightly. It is intelligible and even, but it is
   *not* a human read. If this screens to partners, consider recording the script
   in `voiceover-script.md` — 41.8 seconds of speech, timings in the table.
4. **Confirm the framing of the pilot claim is right for the room.** The film says
   *"We're preparing to explore a proposed school pilot"* and the on-screen card
   reads *"PROPOSED — NOT YET DEPLOYED."* If the room contains a school you have
   already agreed something concrete with, tell me and I will adjust the wording.
5. **Decide about the seeded learner name.** The guardian screen shows the ward
   **Juma Ali** from the demo seed data. If that matters for consent optics, say so
   and I will re-capture that beat with a school-supplied record.
6. **Confirm the closing card.** It ends on the logo, *"Every learner deserves a
   way forward"*, *"Let's explore a more inclusive future for learning"* and
   *"Afrika Digitalis"*. **No contact details, website or QR code appear** — none
   are verified anywhere in this repository, and inventing one was not an option.
   Give me a verified address or number and it is a two-line change.

## 2. Known limitations, stated plainly

* **The music is a placeholder.** There is no licensed track in the repository, so
  the bed is an original synthesis (`make_music.py`). It is deliberately plain.
  Replace it with a licensed track for a public launch — it is one file.
* **The typeface is not Inter.** Inter ships with neither this repository nor this
  machine, so the film uses Segoe UI (the product's own `system-ui` fallback).
  It looks clean, but dropping `Inter-*.ttf` into `assets/fonts/` and re-rendering
  would put the film on exactly the product's face.
* **One screenshot shows a thin demo dataset.** The teacher dashboard reads
  *Total Learners 1 · Active This Week 1*. It is honest — it is a seeded pilot
  database — but at exhibition size it can read as "tiny". The camera moves over
  that screen to favour the charts and quick actions, but a re-capture with a
  fuller class would be stronger.
* **Sidebar says "AI Tutor", docs say "Elekeza Assist".** The captured build labels
  the assistant *AI Tutor* while `docs/PRODUCT.md` calls it *Elekeza Assist*. This
  is a real version drift in the product, visible in the shots. Worth fixing in the
  product rather than in the film.
* **A `.png` named `scene-lesson-reading.png` in `assets/` is a duplicate** of the
  My Lessons screen, not a lesson. It is excluded from the film; the file is left
  in place because it is an original asset.
* **No school-administration screen appears.** It could not be captured — the demo
  `admin@` password is unknown in this build. See
  `artifacts/exhibition-qa/blockers.md` §1.

## 3. Optional improvements, best value first

1. **Add the quiz-feedback beat.** `assets/scene-quiz-result.png` is a genuine,
   warm screen ("Quiz Complete! Great effort! Keep up the good work."). It was left
   out because it also shows a **20 % score**, which reads badly at exhibition size.
   If you want the beat, the clean fix is to re-capture a quiz result after a good
   attempt rather than to crop the number out — cropping the score would be
   selective in a way that misrepresents the learner's result.
2. **Give the opening more air.** Scene 1 holds a dark stage for about 0.4 s before
   the first word appears. It reads as intentional, but if the room is noisy you
   may want the headline up sooner — set `seconds=5.6` on the `opening` scene.
3. **Add a second voice-over line in the product reel.** Lines 3 and 4 carry
   14.8 s of screen time. A short line over the My Lessons screen would even it out.
4. **Use the vertical cut on the venue's own screens.** The 9:16 render exists for
   a side display or social teaser. It is built from the same desktop screens, so it
   does not pretend to show a mobile build.
5. **Localise.** A Kiswahili narration would land better with a Kenyan school
   audience. Hand me the translated lines and the language toggle (which the
   product already has, as a partial) is not required for the film.

## 4. Rebuilding

```bash
cd artifacts/elekeza-exhibition-film/elekeza-promo-project

python make_voiceover.py        # narration (local SAPI) + measured durations
python make_music.py            # music bed, sized to the timeline
python film_plan.py             # print the resolved timeline before committing
python preview_frames.py        # 13 representative stills in a few seconds

python assemble_film.py                      # 1920x1080 primary
python assemble_film.py --vertical           # 1080x1920 secondary
python assemble_film.py --limit 42 --no-audio --out ../_inspect/smoke.mp4   # fast check
python assemble_film.py --no-music           # narration only

python make_contact_sheet.py    # storyboard of the rendered video (16:9)
python make_contact_sheet.py --video ../elekeza-exhibition-film-vertical.mp4 \
                             --out ../storyboard-contact-sheet-vertical.png
```

To watch the result before you screen it:

```bash
cd ..                            # artifacts/elekeza-exhibition-film
python serve_film.py             # then open http://127.0.0.1:8117/film-viewer.html
```

`serve_film.py` only exists so a browser can scrub the MP4 (the stdlib's
`http.server` refuses Range requests, which breaks seeking). It is not part of the
film — opening the MP4 directly from disk works just as well.

The fast check caps every beat at 42 frames — the crossfade is 21 frames, and a
scene shorter than twice that cannot refill the assembler's buffer. `--limit`
raises anything below the floor and says so rather than rendering a cut whose
length is wrong.

`film_plan.py` is the only file you need to touch for wording, screenshots, order
or timing. Narration is authoritative: lengthen the script and the scenes grow to
fit it rather than the read being clipped.
