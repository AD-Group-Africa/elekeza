"""
preview_frames.py -- render representative frames to PNG for review.

A full render takes minutes; this takes seconds. Use it to check composition,
type size, caption placement and safe margins before committing to a render.

It deliberately shortens every beat to a handful of frames and then samples the
middle of each one, so nothing about the composition changes but the work does.

    python preview_frames.py                 # landscape
    python preview_frames.py --vertical
    python preview_frames.py --per-beat 24

Writes PNGs to ../_inspect/frames/ (outside the project sources).
"""

import argparse
import json
import os
import sys

from PIL import Image

import assemble_film as A
import film_plan as P

OUT = os.path.join(P.OUT_DIR, "_inspect", "frames")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--vertical", action="store_true")
    ap.add_argument("--per-beat", type=int, default=16,
                    help="frames each beat is shortened to for the preview")
    args = ap.parse_args(argv)

    L = A.Layout(vertical=args.vertical)
    vo = [4.0] * len(P.VO_LINES)
    p = os.path.join(P.AUDIO, "vo-durations.json")
    if os.path.exists(p):
        vo = json.load(open(p))
    scenes, _ = P.resolve_timeline(vo, verbose=False)

    # shorten every beat so the preview is cheap
    for s in scenes:
        for b in s.get("beats", []):
            b["frames"] = args.per_beat
        if s.get("beats"):
            s["frames"] = sum(b["frames"] for b in s["beats"])
        else:
            s["frames"] = args.per_beat

    g0, acc = {}, 0
    for s in scenes:
        g0[s["name"]] = acc
        acc += s["frames"]
    ctx = dict(g0=g0, total_frames=acc,
               grains=A.grain_arrays(8, L.W, L.H, 4.5))

    os.makedirs(OUT, exist_ok=True)
    tag = "vertical" if args.vertical else "landscape"
    made = []
    for s in scenes:
        picks = set()
        if s.get("beats"):
            acc_b = 0
            for bi, b in enumerate(s["beats"], start=1):
                picks.add(min(s["frames"] - 1, acc_b + int(b["frames"] * 0.8)))
                acc_b += b["frames"]
        else:
            picks = {min(s["frames"] - 1, int(s["frames"] * 0.8))}
        for i, f in enumerate(A.scene_frames(L, s, ctx)):
            if i in picks:
                name = f"{tag}-{s['name']}-{i:04d}.png"
                Image.fromarray(f).save(os.path.join(OUT, name))
                made.append(name)
    print(f"wrote {len(made)} frames to {OUT}")
    for m in made:
        print("  " + m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
