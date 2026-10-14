"""
make_contact_sheet.py -- sample the finished film into a storyboard image.

This reads the RENDERED video, not the source code, so what you see is what will
play: if a caption is clipped, a crop is wrong or a scene is out of order, it
shows up here.

    python make_contact_sheet.py
    python make_contact_sheet.py --video ../elekeza-exhibition-film-vertical.mp4 \
                                 --out ../storyboard-vertical.png

Output: ../storyboard-contact-sheet.png (next to the film)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

import assemble_film as A
import film_plan as P

FRACTIONS = (0.28, 0.72)          # two looks per scene


def video_aspect(video):
    """Read W/H back from the rendered file so portrait cuts get portrait cells."""
    r = subprocess.run([A.FFMPEG, "-hide_banner", "-i", video],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "Video:" in line:
            for tok in line.split(","):
                tok = tok.strip()
                if "x" in tok and tok.replace("x", "").isdigit():
                    w, h = tok.split("x")
                    return int(w), int(h)
    return 16, 9


def grab(video, t, dst):
    cmd = [A.FFMPEG, "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", video,
           "-frames:v", "1", dst]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError(f"frame grab at {t:.2f}s failed: {r.stderr[-400:]}")
    return dst


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", default=P.OUT_LANDSCAPE)
    ap.add_argument("--out", default=os.path.join(P.OUT_DIR,
                                                  "storyboard-contact-sheet.png"))
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--cell", type=int, default=465)
    args = ap.parse_args(argv)

    if not os.path.exists(args.video):
        print("no video at", args.video)
        return 1

    vo = json.load(open(os.path.join(P.AUDIO, "vo-durations.json")))
    scenes, total = P.resolve_timeline(vo, verbose=False)

    # Grabbed stills live in a throwaway directory -- the sheet is the artefact,
    # not the 16 intermediate PNGs.
    tmp = tempfile.mkdtemp(prefix="elekeza-contact-")
    print(f"grabbing stills into {tmp}")
    # One cell per beat, so every screenshot in the film appears in the sheet.
    cells = []
    for s in scenes:
        if s.get("beats"):
            acc = 0
            for bi, b in enumerate(s["beats"]):
                start = s["out_start"] + acc / P.FPS
                t = start + (b["frames"] / P.FPS) * 0.55
                tag = b.get("shot") or f"card:{b.get('card')}"
                dst = os.path.join(tmp, f"{s['name']}-{bi}.png")
                grab(args.video, t, dst)
                cells.append((f"{s['name']} · {tag}  ·  {t:5.2f}s", dst))
                acc += b["frames"]
        else:
            for k, f in enumerate(FRACTIONS):
                t = s["out_start"] + s["exact"] * f
                dst = os.path.join(tmp, f"{s['name']}-{k}.png")
                grab(args.video, t, dst)
                cells.append((f"{s['name']}  ·  {t:5.2f}s", dst))

    vw, vh = video_aspect(args.video)
    cw = args.cell
    ch = int(round(cw * vh / vw))
    lab = 34
    head = 96
    cols = args.cols
    rows = (len(cells) + cols - 1) // cols
    W = cols * cw
    H = head + rows * (ch + lab) + 18
    sheet = Image.new("RGB", (W, H), (12, 12, 18))
    d = ImageDraw.Draw(sheet)
    if vh > vw and cols > 3:
        cols = 3
        rows = (len(cells) + cols - 1) // cols
        W = cols * cw
        H = head + rows * (ch + lab) + 18
        sheet = Image.new("RGB", (W, H), (12, 12, 18))
        d = ImageDraw.Draw(sheet)
    font = None
    for cand in ("C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/segoeuib.ttf"):
        if os.path.exists(cand):
            font = ImageFont.truetype(cand, 19)
            break
    big = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 30) if font else None

    title = "ELEKEZA — exhibition film, first cut"
    if big:
        d.text((24, 20), title, font=big, fill=(240, 240, 250))
    d.text((24, 58), f"{os.path.basename(args.video)}   {vw}x{vh}   {total:.2f}s   "
                     f"{len(scenes)} scenes   ·   {len(cells)} sampled beats   ·   "
                     f"one cell per screenshot, in playing order",
           font=font or ImageFont.load_default(), fill=(150, 156, 172))
    d.rectangle([0, head - 6, W, head - 4], fill=P.ORANGE)

    for i, (label, path) in enumerate(cells):
        cx = (i % cols) * cw
        cy = head + (i // cols) * (ch + lab)
        im = Image.open(path).convert("RGB").resize((cw, ch), Image.LANCZOS)
        sheet.paste(im, (cx, cy))
        d.rectangle([cx, cy, cx + cw - 1, cy + ch - 1], outline=(48, 50, 62))
        d.text((cx + 10, cy + ch + 8), label,
               font=font or ImageFont.load_default(), fill=(190, 194, 206))

    sheet.save(args.out, optimize=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"storyboard: {args.out}  ({sheet.size[0]}x{sheet.size[1]}, "
          f"{os.path.getsize(args.out)/1024/1024:.2f} MB, {len(cells)} cells)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
