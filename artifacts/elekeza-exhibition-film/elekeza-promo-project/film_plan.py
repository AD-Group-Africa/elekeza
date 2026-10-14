"""
film_plan.py -- single source of truth for the Elekeza exhibition film.
========================================================================

Everything a human editor needs to re-cut this film without touching layout code:

  * PALETTE      brand colours, sourced from the real product assets
  * VO           narration script, in scene order
  * SHOTS        the real screenshots used, in journey order, with their labels
  * SCENES       the timeline: scene -> beats (shots + typographic cards)
  * resolve_timeline()  expands SCENES into exact frame-accurate timings and
                        guarantees every narration line finishes before the next
                        one begins (it grows a scene rather than clipping speech).

Every screenshot referenced here is a genuine capture of the running Elekeza
product (artifacts/exhibition-qa, 2026-10-12, branch feat/elekeza-pilot-completion).
No screen is redrawn, no feature is invented, no deployment is claimed.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
AUDIO = os.path.join(ASSETS, "audio")

FPS = 30

# --- Brand palette -----------------------------------------------------------
# Sourced from the real product: manifest theme_color #4F46E5 (indigo), the
# Elekeza logo mark's blue->purple gradient, the warm orange accent used in the
# brand, and the product's own dark surfaces.
PURPLE      = (79, 70, 229)      # manifest theme_color, logo gradient end
PURPLE_SOFT = (129, 122, 240)
BLUE        = (46, 104, 226)     # logo gradient start
GREEN       = (34, 150, 105)     # product accent green
ORANGE      = (234, 127, 55)     # warm sweet-orange accent
INK         = (10, 11, 18)       # true dark stage
INK_2       = (18, 18, 30)
BAR         = (6, 7, 12)         # cinematic letterbox bar
WHITE       = (255, 255, 255)
TEXT_SOFT   = (208, 212, 226)
TEXT_MUTE   = (140, 146, 164)

# --- Fonts -------------------------------------------------------------------
# The project prefers Inter (the product's UI face). Drop Inter-*.ttf into
# assets/fonts/ and it will be picked up automatically. Otherwise we fall back
# to the Windows system UI face, which is what the product itself uses as its
# `system-ui` fallback. A visible warning is printed if neither is available.
FONT_DIR = os.path.join(ASSETS, "fonts")
FONT_STACK = {
    "regular":  ["Inter-Regular.ttf", "Inter-Medium.ttf",
                 "C:/Windows/Fonts/segoeui.ttf"],
    "semibold": ["Inter-SemiBold.ttf", "Inter-Bold.ttf",
                 "C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/segoeuib.ttf"],
    "light":    ["Inter-Light.ttf", "Inter-Regular.ttf",
                 "C:/Windows/Fonts/segoeuil.ttf", "C:/Windows/Fonts/segoeui.ttf"],
}


def resolve_font_path(weight):
    """Return the first existing font file for a weight, else None."""
    for name in FONT_STACK.get(weight, []):
        p = name if os.path.isabs(name) else os.path.join(FONT_DIR, name)
        if os.path.exists(p):
            return p
    return None


# --- Narration ---------------------------------------------------------------
# Warm, confident, plain English. Facts only: nothing here claims a deployment,
# a partnership, a measured outcome or a capability the build does not have.
# Kept deliberately tight: the accessibility categories and the "By Afrika
# Digitalis" line are already legible on screen, so the voice does not repeat
# them. Every claim here is either a product fact or an explicit "we are
# preparing to explore" -- never a deployment, partnership or measured result.
VO_LINES = [
    "Every learner is different. Every learner deserves the opportunity to thrive.",
    "Meet Elekeza. Inclusive learning and education infrastructure.",
    "Learners get a clear daily path. Their lessons, their progress, all in one place.",
    "And a reading mode shaped for the way each learner learns best.",
    "Accessibility settings shape how each learner experiences a lesson.",
    "Our vision: more accessible learning across different educational contexts and curricula.",
    "We're preparing to explore a proposed school pilot, working with educators to learn, validate and improve.",
    "Elekeza. Every learner deserves a way forward.",
]

# --- Screenshots actually used ----------------------------------------------
# Order = the learner -> teacher -> guardian journey the film walks through.
SHOTS = {
    "login":     dict(file="scene-login.png",
                      title="Welcome",
                      sub="Learners, teachers and guardians"),
    "learner":   dict(file="scene-learner-dashboard.png",
                      title="Learner home",
                      sub="A clear daily path for every learner"),
    "lessons":   dict(file="scene-my-lessons.png",
                      title="My Lessons",
                      sub="Lessons, assignments and progress"),
    "reading":   dict(file="scene-reading-mode.png",
                      title="Reading mode",
                      sub="A lesson at the learner's own pace"),
    "a11y":      dict(file="scene-accessibility.png",
                      title="Accessibility settings",
                      sub="Visual - Focus - Cognitive - Audio - Emotional"),
    "progress":  dict(file="scene-progress.png",
                      title="Progress",
                      sub="Levels, streaks and what to do next"),
    "teacher":   dict(file="scene-teacher-dashboard.png",
                      title="Teacher view",
                      sub="Class insight and quick actions"),
    "guardian":  dict(file="scene-guardian-dashboard.png",
                      title="Guardian view",
                      sub="Today at a glance, in plain language"),
}

# --- Timeline ----------------------------------------------------------------
# Each scene has a minimum duration; resolve_timeline() may grow it so that its
# narration finishes with a breath before the next line starts.
# `vo` entries are (narration index, seconds after the scene starts).
SCENES = [
    dict(
        name="opening",
        kind="opening",
        seconds=6.0,
        vo=[(0, 0.5)],
        stage="A dark, warm stage with a typographic reveal.",
    ),
    dict(
        name="brand",
        kind="brand",
        seconds=6.2,
        vo=[(1, 0.5)],
        stage="Authentic Elekeza lockup + positioning line.",
    ),
    dict(
        name="product",
        kind="reels",
        seconds=None,          # built from its beats
        vo=[(2, 0.8), (3, 9.2)],
        beats=[
            dict(kind="shot", shot="login",   seconds=3.6, zoom=(1.02, 1.09), pan=(-14, -6)),
            dict(kind="shot", shot="learner", seconds=3.8, zoom=(1.03, 1.10), pan=(16, 8)),
            dict(kind="shot", shot="lessons", seconds=3.6, zoom=(1.02, 1.08), pan=(12, -8)),
            dict(kind="shot", shot="reading", seconds=3.8, zoom=(1.02, 1.09), pan=(-10, 10)),
        ],
    ),
    dict(
        name="inclusive",
        kind="reels",
        seconds=None,
        vo=[(4, 0.7), (5, 7.6)],
        beats=[
            dict(kind="shot", shot="a11y",     seconds=4.6, zoom=(1.02, 1.10), pan=(0, 14)),
            dict(kind="shot", shot="progress", seconds=4.2, zoom=(1.03, 1.09), pan=(-12, -6)),
            dict(kind="card", card="inclusive", seconds=4.6),
        ],
    ),
    dict(
        name="opportunity",
        kind="reels",
        seconds=None,
        vo=[(6, 0.7)],
        beats=[
            dict(kind="shot", shot="teacher",  seconds=4.4, zoom=(1.06, 1.13), pan=(0, 22)),
            dict(kind="shot", shot="guardian", seconds=4.4, zoom=(1.03, 1.10), pan=(0, 10)),
            dict(kind="card", card="pilot", seconds=4.6),
        ],
    ),
    dict(
        name="closing",
        kind="closing",
        seconds=7.0,
        vo=[(7, 0.9)],
        stage="Final lockup, invitation, hold on the logo.",
    ),
]

# --- Typographic cards -------------------------------------------------------
CARDS = {
    "inclusive": dict(
        lines=["Different learners.", "Different needs."],
        sub=["More inclusive learning experiences."],
        foot="Current build shown - the roadmap continues to grow.",
        accent=GREEN,
    ),
    "pilot": dict(
        lines=["Built to support", "more inclusive learning."],
        sub=["Exploring a proposed school pilot.",
             "Working with educators and partners to learn, validate and improve."],
        foot="PROPOSED - NOT YET DEPLOYED",
        accent=ORANGE,
    ),
}

# --- Copy used by the two bookend scenes ------------------------------------
OPENING = dict(
    headline="Every learner is different.",
    support=["Every learner deserves the opportunity", "to thrive."],
    kicker="AFRIKA DIGITALIS",
)

BRAND = dict(
    positioning="Inclusive Learning & Education Infrastructure",
    byline="By Afrika Digitalis",
)

CLOSING = dict(
    headline="Every learner deserves a way forward.",
    support="Let's explore a more inclusive future for learning.",
    byline="Afrika Digitalis",
)

# --- Output paths ------------------------------------------------------------
OUT_DIR = os.path.dirname(HERE)
OUT_LANDSCAPE = os.path.join(OUT_DIR, "elekeza-exhibition-film.mp4")
OUT_VERTICAL = os.path.join(OUT_DIR, "elekeza-exhibition-film-vertical.mp4")

# Crossfade between scenes, in seconds.
XFADE = 0.7


# --- Timeline maths ----------------------------------------------------------
def resolve_timeline(vo_durations, xfade=XFADE, gap=0.45, tail=0.7, verbose=True):
    """Expand SCENES into frame-exact timings.

    Returns (scenes, total_seconds). Each scene gains `out_start` (its start in
    the finished cut, crossfades included), `frames`, and resolved beats with
    frame counts. Each narration line gains `vo_start` in absolute output time.

    Narration is authoritative: the offsets in SCENES are *minimums*. If a line
    would overlap the previous one it is pushed later, and its scene is then
    grown so the sentence still lands inside its own visuals with a breath at the
    end. Speech is never clipped and two lines never talk over each other.
    """
    scenes = []
    for src in SCENES:
        s = {k: v for k, v in src.items()}
        s["beats"] = [dict(b) for b in src.get("beats", [])]
        if s.get("seconds") is None:
            s["seconds"] = float(sum(b["seconds"] for b in s["beats"]))
        else:
            s["seconds"] = float(s["seconds"])
        scenes.append(s)

    # Pass 1 -- place each line inside its scene, pushing on collision, then
    # size the scene to hold its last line.
    for s in scenes:
        placed, cursor = [], -1e9
        for vo_i, off in s.get("vo", []):
            start = max(float(off), cursor + gap)
            placed.append(dict(index=vo_i, offset=start,
                               length=float(vo_durations[vo_i])))
            cursor = start + float(vo_durations[vo_i])
        s["vo_placed"] = placed
        if placed:
            s["seconds"] = max(s["seconds"], cursor + tail)

    # Pass 2 -- beats -> whole frame counts; the last beat absorbs rounding.
    for s in scenes:
        if s["beats"]:
            counts = [max(1, int(round(b["seconds"] * FPS))) for b in s["beats"]]
            want = max(len(s["beats"]), int(round(s["seconds"] * FPS)))
            counts[-1] += want - sum(counts)
            if counts[-1] < 1:
                counts[0] += counts[-1] - 1
                counts[-1] = 1
            for b, c in zip(s["beats"], counts):
                b["frames"] = c
            s["frames"] = sum(counts)
        else:
            s["frames"] = max(1, int(round(s["seconds"] * FPS)))
        s["exact"] = s["frames"] / FPS

    # Pass 3 -- absolute start times. Scene i starts after every earlier scene,
    # minus one crossfade for each join before it. Getting this off by one join
    # shifts narration ~0.7 s late against the picture, so it is derived from the
    # SAME frame counts the renderer uses.
    acc = 0.0
    for i, s in enumerate(scenes):
        s["out_start"] = acc - i * xfade
        for p in s["vo_placed"]:
            p["vo_start"] = s["out_start"] + p["offset"]
            p["vo_end"] = p["vo_start"] + p["length"]
        acc += s["exact"]
    total = acc - (len(scenes) - 1) * xfade

    # Pass 4 -- verify. Any overlap or overrun is reported loudly, never hidden.
    flat = sorted([p for s in scenes for p in s["vo_placed"]], key=lambda p: p["vo_start"])
    for i, p in enumerate(flat):
        if i + 1 < len(flat) and p["vo_end"] + 0.05 > flat[i + 1]["vo_start"]:
            print(f"  !! VO {p['index']+1} overlaps VO {flat[i+1]['index']+1}")
        if p["vo_end"] > total - 0.2:
            print(f"  !! VO {p['index']+1} runs into the end card")
    if verbose:
        for s in scenes:
            print(f"  scene {s['name']:12s} start {s['out_start']:6.2f}s  "
                  f"frames {s['frames']:4d}  ({s['exact']:5.2f}s)")
            for p in s["vo_placed"]:
                print(f"      VO{p['index']+1} {p['vo_start']:6.2f} - {p['vo_end']:6.2f}s "
                      f"({p['length']:4.2f}s)  +{p['offset']:.2f}s into scene")

    return scenes, total


def crossfade_frames(xfade=XFADE):
    return int(round(xfade * FPS))


if __name__ == "__main__":
    import json
    durs = [4.0] * len(VO_LINES)
    p = os.path.join(AUDIO, "vo-durations.json")
    if os.path.exists(p):
        durs = json.load(open(p))
    sc, total = resolve_timeline(durs)
    print(f"total {total:.2f}s  ({int(round(total * FPS))} frames @ {FPS}fps)")
    for s in sc:
        print(f"  {s['name']:12s} start {s['out_start']:6.2f}s  dur {s['seconds']:5.2f}s  "
              f"{s['frames']:4d} frames")
        for b in s.get("beats", []):
            tag = b.get("shot") or b.get("card")
            print(f"      - {b['kind']:5s} {tag:10s} {b['frames']:4d}f")
