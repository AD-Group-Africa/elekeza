# Asset manifest — Elekeza exhibition film

Every image in this film is a **genuine screenshot of the running Elekeza product**.
Nothing is redrawn, mocked up, generated or re-typed. No screen has been edited to
change what it shows; the only treatment applied is a cinematic crop, a slow camera
move and a darkening gradient for caption legibility.

## Where the images come from

| | |
|---|---|
| Capture date | 2026-10-12 |
| Branch / commit | `feat/elekeza-pilot-completion` @ `bab0ba2` |
| Stack under capture | Next.js :3100 · Spring Boot :8097 · AI :8001 · PostgreSQL :5433 |
| Working copies used by the film | `elekeza-promo-project/assets/scene-*.png` (1920×1079) |
| Provenance-tracked capture set | `artifacts/exhibition-qa/` (1366×900, 19 viewport + 24 full-page + 5 mobile) |
| Capture method | standalone Playwright driver against the live stack — see `artifacts/exhibition-qa/e2e-summary.md` |

Corroboration that these are real product screens and not mockups: the learner
views show the seeded CBC content (`AgriGrid_Africa_Phase_One.pdf`,
`Understanding Fractions`, `The Water Cycle`) and the guardian view shows the
seeded ward **Juma Ali** as *Parent* — exactly matching the documented demo
accounts in `docs/archive/demo/DEMO-ACCOUNTS.md`. The sidebar, the mascot, the
"Reading mode on" control and the accessibility category list are all live UI.

Every one of the eight selected screens was inspected by eye at full resolution
before being used, to confirm it is the screen its filename claims and that it is
not a loading state, a blank page or an error page.

## Deliverables

All paths are relative to `artifacts/elekeza-exhibition-film/`.

| File | What it is | Duration / size |
|---|---|---|
| `elekeza-exhibition-film.mp4` | **Primary cut.** 1920×1080, 30 fps, h.264 High + AAC 48 kHz stereo | 58.70 s · 31.9 MB |
| `elekeza-exhibition-film-vertical.mp4` | Secondary 9:16 cut for a side display or teaser. 1080×1920, same narration and same screenshots, screenshots shown undistorted in a full-width band | 58.70 s · 31.9 MB |
| `storyboard-contact-sheet.png` | Every screenshot beat of the primary cut, sampled from the rendered file | 1860×1298 |
| `storyboard-contact-sheet-vertical.png` | The same for the portrait cut | 1395×5280 |
| `film-viewer.html` + `serve_film.py` | Local review page playing both cuts with both storyboards. `python serve_film.py` → `http://127.0.0.1:8117/film-viewer.html`. The server adds HTTP Range support so the player can seek | — |
| `elekeza-promo-project/asset-manifest.md` | This file — provenance for every image | — |
| `elekeza-promo-project/voiceover-script.md` | The eight narration lines with their timings | — |
| `elekeza-promo-project/EDIT-BEFORE-EXHIBITION.md` | What to check and change before you screen it | — |

The audio mix is byte-identical in both cuts, so a narration change lands in both
without re-verifying sync twice. Both cuts were decoded end to end at full length
with zero errors and an exact frame count (1761 frames each).

## Selected — in the order they appear

| # | Scene | File | Label on screen | Beat | Length |
|---|---|---|---|---|---|
| 1 | product | `scene-login.png` | Welcome — Learners, teachers and guardians | 01/04 | 3.60 s |
| 2 | product | `scene-learner-dashboard.png` | Learner home — A clear daily path for every learner | 02/04 | 3.80 s |
| 3 | product | `scene-my-lessons.png` | My Lessons — Lessons, assignments and progress | 03/04 | 3.60 s |
| 4 | product | `scene-reading-mode.png` | Reading mode — A lesson at the learner's own pace | 04/04 | 3.80 s |
| 5 | inclusive | `scene-accessibility.png` | Accessibility settings — Visual · Focus · Cognitive · Audio · Emotional | 01/03 | 4.60 s |
| 6 | inclusive | `scene-progress.png` | Progress — Levels, streaks and what to do next | 02/03 | 4.20 s |
| — | inclusive | *(typographic card)* | Different learners. Different needs. | 03/03 | 5.47 s |
| 7 | opportunity | `scene-teacher-dashboard.png` | Teacher view — Class insight and quick actions | 01/03 | 4.40 s |
| 8 | opportunity | `scene-guardian-dashboard.png` | Guardian view — Today at a glance, in plain language | 02/03 | 4.40 s |
| — | opportunity | *(typographic card)* | Built to support more inclusive learning / proposed pilot | 03/03 | 4.60 s |

On-screen screenshot time: **32.4 s** of a **58.7 s** film.

Camera treatment: a slow push of 2–9 % with a small, eased pan. Each screenshot's
own pixels are never stretched or distorted — the source is cropped at its native
aspect, so the UI keeps its true proportions.

## Excluded

| File | Reason |
|---|---|
| `scene-lesson-reading.png` | **Byte-different but pixel-identical duplicate** of `scene-my-lessons.png` — it is the My Lessons page, not a lesson. Keeping both would have shown the same screen twice under two different labels. Verified by eye; excluded. |
| `scene-quiz-result.png` | Real and genuine, but it displays a **20 %** quiz score. Screened at exhibition size that reads as "the product is failing" rather than "feedback is encouraging". Excluded from the first cut; it is kept in `assets/` and is the single best candidate for a swap if you want a feedback beat. See `EDIT-BEFORE-EXHIBITION.md`. |
| `artifacts/exhibition-qa/09-teacher-students.png` | Not used; the film already covers the teacher idea in one dashboard beat and the cut had no room for a second. |
| `.../10-teacher-assignments.png`, `11-teacher-attendance.png`, `13-teacher-progress.png` | Genuine, but attendance and assignment-marking are school-operations surfaces; the film is about inclusive learning, so they were left out to keep the story tight. |
| `.../12-teacher-support-signals.png` | Teacher-facing support signals are powerful but need explaining in words to land; a caption alone risked implying more than it shows. |
| `.../15-guardian-child.png`, `16-guardian-reports.png` | The guardian dashboard beat already carries the message; a second guardian screen added runtime without adding meaning. |
| `.../17-guardian-communication.png`, `18-guardian-message-sent.png`, `19-teacher-communication.png` | **Deliberately excluded.** Messaging is a known partial in this build (`EL-NEW-02`: messages are stored sender-only — see `docs/PRODUCT.md`). Showing a message thread would imply a working conversation feature that is not there yet. |
| `.../mobile/*.png`, `logo-mobile-student.png` | Mobile is not part of the first cut. The vertical render re-uses the **desktop** screens rather than implying a mobile build. |
| `.../theme-login-dark*.png`, `theme-login-light.png` | Theme-comparison captures, three of which are the same image; not a journey. |
| `.../theme-student-purple*.png`, `logo-sidebar-*.png` | Diagnostic/sidebar-fix captures, kept only as QA evidence. |
| `/admin` (School Administration) | Never captured — the demo `admin@` password is unknown in this build (`artifacts/exhibition-qa/blockers.md` §1). The film therefore shows no school-administration screen. |

## Logos

| File | Use |
|---|---|
| `assets/logo-mark-tight.png` | The only logo used. Appears in the brand reveal and the closing card, over a soft halo so the darker blue reads against the near-black stage. 1832×641, alpha. |
| `logo-1920.png`, `logo-mark.png`, `logo-transparent.png`, `logo-white-bg.png`, `logo-lockup-1920-markonly.png`, `logo-mark-80px.png`, `logo-mark-120px.png`, `logo-preview-on-black.png` | Unused originals, kept so an editor can re-cut the brand beats. Nothing was modified or moved. |

The wordmark inside the lockup *is* the "ELEKEZA" requirement of the brand scene —
a separate typed "ELEKEZA" was deliberately not added, because repeating a typed
wordmark next to the real one looks like a mistake.

## Type

No Inter font ships in this repository, and Inter is the product's UI face. The
film therefore resolves type in this order (`film_plan.FONT_STACK`):

1. `assets/fonts/Inter-*.ttf` — **drop Inter in here and re-render to put the film
   on exactly the product's typeface**
2. `C:/Windows/Fonts/segoeui.ttf` (regular/light) and `seguisb.ttf` (semibold) —
   what this first cut actually uses
3. Pillow's bitmap fallback, with a loud console warning (never acceptable at
   1080p — if you see that warning, the render is unusable)

Type sizes are set for exhibition legibility: headlines 76 px, screenshot captions
44 px, supporting copy 28–40 px at 1920×1080. Minimum on-screen text is 22 px.

## Audio

| Track | Source | Rights |
|---|---|---|
| Narration | Windows SAPI **Microsoft Zira Desktop** (en-US), synthesised locally, then warmed (slight pitch-down, high-shelf tuck, short reverb, silence trim) | Generated on this machine; no third-party material |
| Music bed | **Original** composition, `make_music.py` — a D-major pad on a I–V–vi–IV cycle with a sparse pentatonic thumb-piano pluck, synthesised with numpy | No licensed track exists in this repository, so nothing was borrowed. Unambiguous rights position; intended as a scratch bed |

No licensed music, stock footage or stock imagery is used anywhere in this film.
