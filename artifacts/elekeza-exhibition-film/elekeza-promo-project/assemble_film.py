"""
assemble_film.py -- render the Elekeza exhibition film.

One command, scene-based, frame-accurate:

    python assemble_film.py                  # primary 1920x1080 cut
    python assemble_film.py --vertical       # secondary 1080x1920 cut
    python assemble_film.py --limit 90       # smoke test: cap every beat to N frames
    python assemble_film.py --no-audio       # picture only

How it works
------------
* Every scene is generated as in-memory RGB frames and piped straight to ffmpeg
  as raw rgb24. Frames are never written to disk, which matters here: the C:
  drive has almost no free space. The pipe is also why the old build ran long --
  it piped 4-channel RGBA into an rgb24 stream and ffmpeg silently read 4 frames
  for every 3. `as_rgb()` now refuses anything that is not exactly 3 channels.
* Crossfades are done by holding the last N frames of the outgoing scene in a
  small ring buffer and blending them with the first N frames of the incoming
  scene, so output length is exactly sum(scene frames) - N*(scenes-1). The audio
  timeline is derived from the same numbers, so sound and picture cannot drift.
  That identity only holds while every scene stays longer than twice N, because
  the incoming scene has to be able to refill the buffer. `--limit` therefore
  refuses to clamp a beat below 2*N, and the same guard shortens N itself if a
  plan is ever edited down to a scene shorter than the crossfade.
* Narration is placed with ffmpeg `adelay`, so a VO line sits at an exact
  millisecond offset measured from the same resolved timeline.

Layout is plan-driven: film_plan.py owns the palette, the narration, the
screenshot order and the timeline. Nothing here invents product behaviour.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import film_plan as P

# Masters are composed slightly larger than the frame and then sampled down, so
# the slow camera push never has to upscale text.
SUP = 1.08
SHOT_SUP = 1.14          # head-room for the Ken Burns crop inside a screenshot

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:                                     # pragma: no cover
    import shutil
    FFMPEG = shutil.which("ffmpeg")

_FONT_CACHE = {}


# --------------------------------------------------------------------------- #
# Layout
# --------------------------------------------------------------------------- #
class Layout:
    """Frame metrics + type scale for one orientation."""

    def __init__(self, vertical=False):
        self.vertical = vertical
        self.W, self.H = (1080, 1920) if vertical else (1920, 1080)
        self.pad = 60 if vertical else 76
        self.bar = 56 if vertical else 64            # brand rail thickness
        if vertical:
            self.fs = dict(tick=20, shot_title=40, shot_sub=25, counter=20,
                           headline=60, support=34, kicker=20,
                           brand=33, byline=24,
                           card=50, card_sub=29, card_foot=19,
                           close=44)
        else:
            self.fs = dict(tick=22, shot_title=44, shot_sub=28, counter=22,
                           headline=76, support=40, kicker=22,
                           brand=44, byline=28,
                           card=62, card_sub=36, card_foot=22,
                           close=60)
        self.content_w = self.W - 2 * self.pad

    def font(self, weight, size):
        return get_font(weight, size)

    def su(self, v):
        """Scale a landscape-space measurement into this frame's space."""
        return v if not self.vertical else int(round(v * 0.86))


def get_font(weight, size):
    key = (weight, size)
    if key not in _FONT_CACHE:
        path = P.resolve_font_path(weight)
        if path is None:
            if weight == "regular":
                print("!! No font found -- falling back to Pillow's bitmap font. "
                      "Text will be too small to read. Drop Inter into assets/fonts/.")
            _FONT_CACHE[key] = ImageFont.load_default()
        else:
            _FONT_CACHE[key] = ImageFont.truetype(path, size)
    return _FONT_CACHE[key]


def line_height(fnt):
    try:
        a, d = fnt.getmetrics()
        return a + d
    except Exception:
        return fnt.size


# --------------------------------------------------------------------------- #
# Backgrounds (composed once per scene, never per frame)
# --------------------------------------------------------------------------- #
def vgradient(top, bottom, w, h):
    """HxWx3 vertical gradient. `w` matters: without the repeat this collapses
    to a single column and every master renders blank."""
    t = np.linspace(0, 1, h)[:, None, None]
    row = (np.array(top, np.float32)[None, None, :] * (1 - t)
           + np.array(bottom, np.float32)[None, None, :] * t)
    return np.repeat(row, w, axis=1)


def add_glow(arr, cx, cy, radius, color, alpha):
    """Alpha-composite a soft radial glow onto an HxWx3 float array."""
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip(alpha * (1 - np.clip(d / radius, 0, 1)) ** 2, 0, 255)
    # No explicit mode: Pillow infers L / RGB / RGBA from the array shape, and
    # the `mode` argument is removed in Pillow 13.
    layer = Image.fromarray(a.astype(np.uint8))
    col = Image.new("RGB", (w, h), tuple(int(c) for c in color))
    base = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    base = Image.composite(col, base, layer)
    return np.array(base).astype(np.float32)


def stage_background(w, h, warm=False):
    if warm:
        arr = vgradient((38, 29, 52), (11, 10, 17), w, h)
    else:
        arr = vgradient((30, 26, 48), (9, 9, 15), w, h)
    arr = add_glow(arr, w * 0.5, h * 0.42, h * 0.74, (124, 104, 226), 74)
    arr = add_glow(arr, w * 0.5, h * 0.44, h * 0.34, (168, 140, 240), 56)
    arr = add_glow(arr, w * 0.15, h * 0.87, h * 0.44, (232, 128, 58), 40)
    arr = add_glow(arr, w * 0.87, h * 0.12, h * 0.42, (62, 108, 214), 34)
    return arr.clip(0, 255).astype(np.uint8)


def _finish(img, w, h):
    """Bake the vignette into a master once, instead of per frame."""
    return np.array(Image.alpha_composite(img.convert("RGBA"),
                                          vignette_overlay(w, h)).convert("RGB"))


def vignette_overlay(w, h, strength=0.34):
    """Black radial layer -- approximated for alpha compositing."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx / w) - 0.5) ** 2 + ((yy / h) - 0.5) ** 2)
    a = (np.clip(d / 0.72, 0, 1) ** 1.7) * strength * 255
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 3] = a.astype(np.uint8)
    return Image.fromarray(out)


def grain_arrays(n, w, h, amount):
    rng = np.random.default_rng(7)
    return [rng.normal(0, amount, (h, w, 3)).astype(np.int16) for _ in range(n)]


def add_grain(arr, g):
    """Add pre-generated grain in place -- avoids two full-frame allocations."""
    out = arr.astype(np.int16)
    out += g
    np.clip(out, 0, 255, out)
    return out.astype(np.uint8)


# --------------------------------------------------------------------------- #
# Text helpers
# --------------------------------------------------------------------------- #
def text_width(draw, s, fnt, tracking=0.0):
    w = draw.textlength(s, font=fnt)
    if tracking:
        w += tracking * max(0, len(s) - 1)
    return w


def draw_tracked(draw, xy, s, fnt, fill, tracking=0.0, anchor="la"):
    """Draw text with letter-spacing (used for the small-caps brand tick)."""
    if not tracking:
        draw.text(xy, s, font=fnt, fill=fill, anchor=anchor)
        return
    x, y = xy
    total = text_width(draw, s, fnt, tracking)
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for ch in s:
        draw.text((x, y), ch, font=fnt, fill=fill, anchor="l" + anchor[1])
        x += draw.textlength(ch, font=fnt) + tracking


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_block(draw, cx, y, lines, fnt, fill, gap=0.22, anchor="ma"):
    """Centred multi-line block; returns the y after the last line."""
    lh = line_height(fnt)
    for ln in lines:
        draw.text((cx, y), ln, font=fnt, fill=fill, anchor=anchor)
        y += lh * (1 + gap)
    return y


def shadowed(draw, xy, s, fnt, fill, anchor="la", tracking=0.0):
    x, y = xy
    draw_tracked(draw, (x + 2, y + 2), s, fnt, (0, 0, 0), tracking, anchor)
    draw_tracked(draw, (x, y), s, fnt, fill, tracking, anchor)


# --------------------------------------------------------------------------- #
# Camera
# --------------------------------------------------------------------------- #
def camera_sample(prep, L, z, dx=0.0, dy=0.0, zmax=SUP,
                  resample=Image.BILINEAR):
    """Crop a window out of a prepared master and resample it to the frame.

    BILINEAR is deliberate: the push only minifies by 3-8%, where bilinear is
    visually indistinguishable from LANCZOS but roughly twice as fast, and the
    whole film is resampled once per frame.
    """
    bw, bh = prep.size
    # never ask for a window larger than the master, and never let the crop
    # run off the edge -- a negative box offset is a hard PIL error
    cw = float(min(bw, max(8.0, L.W * zmax / z)))
    ch = float(min(bh, max(8.0, L.H * zmax / z)))
    cx = bw / 2 + dx * (zmax / z)
    cy = bh / 2 + dy * (zmax / z)
    x0 = min(max(0.0, cx - cw / 2), bw - cw)
    y0 = min(max(0.0, cy - ch / 2), bh - ch)
    return prep.resize((L.W, L.H), resample,
                       box=(x0, y0, x0 + cw, y0 + ch))


def band_sample(prep, tw, th, z, dx=0.0, dy=0.0, zmax=1.0):
    """Same camera idea as camera_sample, but into an arbitrary target box.

    Used by the portrait cut, where a 16:9 screenshot must stay 16:9 inside a
    9:16 frame. Squeezing it to fill would distort the product's own layout.
    """
    bw, bh = prep.size
    cw = float(min(bw, max(8.0, tw * zmax / z)))
    ch = float(min(bh, max(8.0, th * zmax / z)))
    cx = bw / 2 + dx * (zmax / z)
    cy = bh / 2 + dy * (zmax / z)
    x0 = min(max(0.0, cx - cw / 2), bw - cw)
    y0 = min(max(0.0, cy - ch / 2), bh - ch)
    return prep.resize((tw, th), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))


def blend(a, b, t):
    if t <= 0:
        return a
    if t >= 1:
        return b
    return (a.astype(np.float32) * (1.0 - t) + b.astype(np.float32) * t).astype(np.uint8)


# --------------------------------------------------------------------------- #
# Progress rail -- drawn per frame, over everything, 4 px of brand continuity
# --------------------------------------------------------------------------- #
def draw_rail(arr, L, gframe, total):
    """Thin progress rail. The track is kept darker than the darkest background
    so it never reads as a stray line at the frame edge (the rail is drawn after
    the vignette, so it is the one thing that is not darkened)."""
    y0, y1 = L.H - 5, L.H - 2
    arr[y0:y1, :] = (17, 18, 26)
    frac = min(1.0, max(0.0, gframe / max(1, total)))
    arr[y0:y1, :int(L.W * frac)] = P.ORANGE
    return arr


# --------------------------------------------------------------------------- #
# Scene pieces
# --------------------------------------------------------------------------- #
def chrome_shot_split(L, shot, beat_i, beat_n):
    """Two chrome overlays: with and without the caption, for a caption fade."""
    def build(caption=True):
        img = Image.new("RGBA", (L.W, L.H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        bar = L.bar
        # bottom legibility gradient
        grad = np.zeros((int(L.H * 0.42), L.W, 4), np.uint8)
        grad[:, :, 3] = np.linspace(0, 225, grad.shape[0]).astype(np.uint8)[:, None]
        img.alpha_composite(Image.fromarray(grad),
                            (0, L.H - grad.shape[0]))
        # vignette is baked in here so it costs nothing per frame
        img.alpha_composite(vignette_overlay(L.W, L.H, 0.30))
        # letterbox bars
        d.rectangle([0, 0, L.W, bar], fill=P.BAR + (255,))
        d.rectangle([0, L.H - bar, L.W, L.H], fill=P.BAR + (255,))
        # brand tick + counter inside the top rail
        tick = L.font("semibold", L.fs["tick"])
        draw_tracked(d, (L.pad, bar // 2), "ELEKEZA", tick, P.ORANGE,
                     tracking=L.su(5), anchor="lm")
        cnt = L.font("regular", L.fs["counter"])
        d.text((L.W - L.pad, bar // 2), f"{beat_i:02d} / {beat_n:02d}",
               font=cnt, fill=P.TEXT_MUTE, anchor="rm")
        if caption:
            ty = L.H - bar - L.su(150)
            d.rectangle([L.pad, ty - L.su(26), L.pad + L.su(56), ty - L.su(23)],
                        fill=P.ORANGE)
            shadowed(d, (L.pad, ty), shot["title"],
                     L.font("semibold", L.fs["shot_title"]), P.WHITE)
            sub_y = ty + line_height(L.font("semibold", L.fs["shot_title"])) * 1.14
            shadowed(d, (L.pad, sub_y), shot["sub"],
                     L.font("regular", L.fs["shot_sub"]), P.TEXT_SOFT)
        return img
    return build(True), build(False)


def shot_frames(L, shot, n, zoom, pan, beat_i, beat_n, g0, gtotal, grains):
    """Ken Burns over a real screenshot, with static broadcast chrome."""
    src = Image.open(os.path.join(P.ASSETS, shot["file"])).convert("RGB")
    prep = src.resize((int(round(L.W * SHOT_SUP)),
                       int(round(L.H * SHOT_SUP))), Image.LANCZOS)
    z0, z1 = zoom
    px, py = pan
    cap_on, cap_off = chrome_shot_split(L, shot, beat_i, beat_n)
    ramp = min(14, max(4, n // 6))

    for i in range(n):
        t = i / max(1, n - 1)
        z = z0 + (z1 - z0) * t
        # ease the pan so it starts and stops gently
        e = t * t * (3 - 2 * t)
        base = camera_sample(prep, L, z, px * e, py * e, SHOT_SUP).convert("RGBA")
        with_cap = Image.alpha_composite(base, cap_on).convert("RGB")
        if i < ramp:
            without = Image.alpha_composite(base, cap_off).convert("RGB")
            arr = blend(np.array(without), np.array(with_cap), (i + 1) / ramp)
        else:
            arr = np.array(with_cap)
        arr = add_grain(arr, grains[(i + g0) % len(grains)])
        arr = draw_rail(arr, L, g0 + i, gtotal)
        yield arr


def shot_frames_vertical(L, shot, n, zoom, pan, beat_i, beat_n, g0, gtotal,
                        grains):
    """Portrait cut: the screenshot keeps its true 16:9 shape inside a band."""
    src = Image.open(os.path.join(P.ASSETS, shot["file"])).convert("RGB")
    bw = L.W - 2 * L.pad
    bh = int(round(bw * 9 / 16))
    bx = L.pad
    by = int(L.H * 0.27)
    z0, z1 = zoom
    vsup = max(z0, z1) * 1.06
    prep = src.resize((int(round(bw * vsup)), int(round(bh * vsup))),
                      Image.LANCZOS)
    px, py = pan

    # static stage + chrome, built once
    bg = Image.fromarray(stage_background(L.W, L.H))
    bg = Image.alpha_composite(bg.convert("RGBA"),
                               vignette_overlay(L.W, L.H, 0.30)).convert("RGB")
    d = ImageDraw.Draw(bg)
    bar = L.bar
    d.rectangle([0, 0, L.W, bar], fill=P.BAR + (255,))
    d.rectangle([0, L.H - bar, L.W, L.H], fill=P.BAR + (255,))
    draw_tracked(d, (L.pad, bar // 2), "ELEKEZA", L.font("semibold", L.fs["tick"]),
                 P.ORANGE, tracking=L.su(5), anchor="lm")
    d.text((L.W - L.pad, bar // 2), f"{beat_i:02d} / {beat_n:02d}",
           font=L.font("regular", L.fs["counter"]), fill=P.TEXT_MUTE, anchor="rm")
    d.rectangle([bx - 2, by - 2, bx + bw + 1, by + bh + 1], outline=(74, 76, 96))
    cy = by + bh + L.su(46)
    d.rectangle([bx, cy - L.su(24), bx + L.su(52), cy - L.su(21)], fill=P.ORANGE)
    d.text((bx, cy), shot["title"], font=L.font("semibold", L.fs["shot_title"]),
           fill=P.WHITE)
    d.text((bx, cy + line_height(L.font("semibold", L.fs["shot_title"])) * 1.15),
           shot["sub"], font=L.font("regular", L.fs["shot_sub"]), fill=P.TEXT_SOFT)
    draw_tracked(d, (L.W // 2, L.H - bar - L.su(52)), "ELEKEZA",
                 L.font("semibold", L.fs["tick"]), (58, 60, 78),
                 tracking=L.su(9), anchor="mm")

    for i in range(n):
        t = i / max(1, n - 1)
        z = z0 + (z1 - z0) * t
        e = t * t * (3 - 2 * t)
        out = bg.copy()
        out.paste(band_sample(prep, bw, bh, z, px * e, py * e, vsup), (bx, by))
        arr = add_grain(np.array(out), grains[(i + g0) % len(grains)])
        yield draw_rail(arr, L, g0 + i, gtotal)


def staged_frames(L, stages, n, grains, g0, gtotal, fade=16,
                  push=0.035, drift=(0.0, 0.0)):
    """Cross-dissolve through pre-composed masters while slowly pushing in."""
    prep = [Image.fromarray(m) for _, m in stages]
    bounds, acc = [], 0
    for cnt, _ in stages:
        acc += cnt
        bounds.append(acc)

    cur = 0
    for i in range(n):
        while cur < len(bounds) - 1 and i >= bounds[cur]:
            cur += 1
        m = prep[cur]
        if cur > 0:
            into = i - bounds[cur - 1]
            if into < fade:
                m = Image.fromarray(blend(np.array(prep[cur - 1]), np.array(m),
                                          (into + 1) / fade))
        t = i / max(1, n - 1)
        z = 1.0 + push * t
        arr = np.array(camera_sample(m, L, z, drift[0] * t, drift[1] * t))
        arr = add_grain(arr, grains[(i + g0) % len(grains)])
        arr = draw_rail(arr, L, g0 + i, gtotal)
        yield arr


# --- title-card masters ------------------------------------------------------
def master_card(L, card, grain_seed=0):
    W, H = int(L.W * SUP), int(L.H * SUP)
    base = Image.fromarray(stage_background(W, H))
    d = ImageDraw.Draw(base)
    cx = W / 2
    big = L.font("semibold", int(L.fs["card"] * SUP))
    sub = L.font("regular", int(L.fs["card_sub"] * SUP))
    foot = L.font("regular", int(L.fs["card_foot"] * SUP))

    lines = []
    for ln in card["lines"]:
        lines += wrap(d, ln, big, L.content_w * SUP)
    subs = []
    for ln in card["sub"]:
        subs += wrap(d, ln, sub, L.content_w * 0.95 * SUP)

    block = len(lines) * line_height(big) * 1.16 + 34 * SUP \
        + len(subs) * line_height(sub) * 1.34
    y = H * 0.5 - block / 2 - 20 * SUP

    d.rectangle([cx - 44 * SUP, y - 46 * SUP, cx + 44 * SUP, y - 42 * SUP],
                fill=card["accent"])
    y = draw_block(d, cx, y, lines, big, P.WHITE, gap=0.16) + 30 * SUP
    draw_block(d, cx, y, subs, sub, P.TEXT_SOFT, gap=0.34)
    draw_tracked(d, (cx, H * 0.87), card["foot"], foot, card["accent"],
                 tracking=3 * SUP, anchor="mm")
    return _finish(base, W, H)


def master_opening(L):
    W, H = int(L.W * SUP), int(L.H * SUP)
    bg = stage_background(W, H, warm=True)
    bare = Image.fromarray(bg)

    def draw(headline, support, kicker, dim=1.0):
        img = Image.fromarray(bg.copy())
        d = ImageDraw.Draw(img)
        cx = W / 2
        hy = H * 0.44
        f_head = L.font("semibold", int(L.fs["headline"] * SUP))
        f_sup = L.font("light", int(L.fs["support"] * SUP))
        f_kick = L.font("regular", int(L.fs["kicker"] * SUP))
        if kicker:
            draw_tracked(d, (cx, H * 0.215), P.OPENING["kicker"], f_kick,
                         P.ORANGE, tracking=7 * SUP, anchor="mm")
            d.rectangle([cx - 34 * SUP, H * 0.255, cx + 34 * SUP, H * 0.255 + 2 * SUP],
                        fill=P.ORANGE)
        if headline:
            hl = wrap(d, headline, f_head, L.content_w * SUP)
            y = hy - (len(hl) * line_height(f_head) * 1.14) / 2
            y = draw_block(d, cx, y, hl, f_head,
                           tuple(int(c * dim) for c in P.WHITE), gap=0.14)
        if support:
            sl = wrap(d, support, f_sup, L.content_w * 0.9 * SUP)
            draw_block(d, cx, H * 0.60, sl, f_sup,
                       tuple(int(c * dim) for c in P.TEXT_SOFT), gap=0.34)
        return _finish(img, W, H)

    A = _finish(bare, W, H)
    B = draw(P.OPENING["headline"], None, True)
    C = draw(P.OPENING["headline"], " ".join(P.OPENING["support"]), True)
    return A, B, C


def master_brand(L, with_text):
    W, H = int(L.W * SUP), int(L.H * SUP)
    bg = stage_background(W, H)
    img = Image.fromarray(bg.copy())
    if with_text:
        d = ImageDraw.Draw(img)
        f_pos = L.font("regular", int(L.fs["brand"] * SUP))
        f_by = L.font("regular", int(L.fs["byline"] * SUP))
        cx = W / 2
        # sits clear of the logo lockup, which ends around 0.65H
        y = H * 0.70
        draw_block(d, cx, y, wrap(d, P.BRAND["positioning"], f_pos,
                                  L.content_w * SUP), f_pos, P.TEXT_SOFT, gap=0.3)
        d.text((cx, H * 0.795), P.BRAND["byline"], font=f_by,
               fill=P.TEXT_MUTE, anchor="mm")
        d.rectangle([cx - 40 * SUP, H * 0.845, cx + 40 * SUP, H * 0.845 + 2 * SUP],
                    fill=P.ORANGE)
    return _finish(img, W, H)


def logo_layer(L, target_w, alpha=1.0, scale=1.0):
    """RGBA logo lockup layer, centred, with a soft halo so it reads on dark."""
    logo = Image.open(os.path.join(P.ASSETS, "logo-mark-tight.png")).convert("RGBA")
    w = int(round(target_w * scale))
    h = int(round(logo.height * w / logo.width))
    logo = logo.resize((w, h), Image.LANCZOS)
    layer = Image.new("RGBA", (L.W, L.H), (0, 0, 0, 0))
    mx, my = (L.W - w) // 2, int(L.H * 0.30)
    # the halo must be its own, larger layer -- drawn on a logo-sized canvas the
    # ellipse is just clipped into a hard rectangle
    pad = 110
    halo = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([pad - 34, pad - 34, w + pad + 34, h + pad + 34],
               fill=(122, 102, 224, 76))
    halo = halo.filter(ImageFilter.GaussianBlur(58))
    layer.alpha_composite(halo, (mx - pad, my - pad))
    layer.alpha_composite(logo, (mx, my))
    if alpha < 1.0:
        a = layer.getchannel("A").point(lambda v: int(v * alpha))
        layer.putalpha(a)
    return layer, my + h


def master_closing(L):
    W, H = int(L.W * SUP), int(L.H * SUP)
    bg = stage_background(W, H)
    img = Image.fromarray(bg.copy())
    d = ImageDraw.Draw(img)
    cx = W / 2
    f_h = L.font("semibold", int(L.fs["close"] * SUP))
    f_s = L.font("regular", int(L.fs["support"] * SUP))
    f_b = L.font("regular", int(L.fs["byline"] * SUP))
    draw_block(d, cx, H * 0.565, wrap(d, P.CLOSING["headline"], f_h,
                                      L.content_w * SUP), f_h, P.WHITE, gap=0.16)
    draw_block(d, cx, H * 0.70, wrap(d, P.CLOSING["support"], f_s,
                                     L.content_w * 0.92 * SUP), f_s,
               P.TEXT_SOFT, gap=0.3)
    d.text((cx, H * 0.80), P.CLOSING["byline"], font=f_b,
           fill=P.TEXT_MUTE, anchor="mm")
    return _finish(img, W, H)


# --------------------------------------------------------------------------- #
# Scene generators
# --------------------------------------------------------------------------- #
def scene_frames(L, scene, ctx):
    """Yield exactly scene['frames'] RGB frames for one scene."""
    n = scene["frames"]
    g0 = ctx["g0"][scene["name"]]
    gt = ctx["total_frames"]
    grains = ctx["grains"]
    if scene["kind"] == "opening":
        A, B, C = master_opening(L)
        # stage lengths are fractions of the scene, so the reveal keeps its
        # shape whether the scene is 200 frames or a 16-frame preview
        a = max(4, int(round(0.06 * n)))
        b = max(4, int(round(0.13 * n)))
        stages = [(a, A), (b, B), (max(8, n - a - b), C)]
        yield from staged_frames(L, stages, n, grains, g0, gt,
                                 fade=min(18, max(6, n // 6)), push=0.03,
                                 drift=(-6, 4))
        return
    if scene["kind"] == "brand":
        A = master_brand(L, False)
        B = master_brand(L, True)
        a = max(4, int(round(0.09 * n)))
        stages = [(a, A), (max(8, n - a), B)]
        tw = int(L.W * (0.80 if L.vertical else 0.56))
        fr = max(6, min(int(round(0.9 * P.FPS)), max(1, n // 3)))
        held, _ = logo_layer(L, tw)                     # full-opacity lockup
        for i, arr in enumerate(staged_frames(L, stages, n, grains, g0, gt,
                                             fade=min(18, max(6, n // 6)),
                                             push=0.028, drift=(5, 3))):
            if i >= fr:
                lg = held
            else:
                t = i / fr
                lg, _ = logo_layer(L, tw, scale=0.965 + 0.035 * (1 - (1 - t) ** 3),
                                   alpha=t ** 0.8)
            img = Image.alpha_composite(Image.fromarray(arr).convert("RGBA"), lg)
            yield draw_rail(np.array(img.convert("RGB")), L, g0 + i, gt)
        return
    if scene["kind"] == "reels":
        frame_i = 0
        beats = scene["beats"]
        for bi, beat in enumerate(beats, start=1):
            bn = beat["frames"]
            sub_g0 = g0 + frame_i
            if beat["kind"] == "shot":
                maker = shot_frames_vertical if L.vertical else shot_frames
                gen = maker(L, P.SHOTS[beat["shot"]], bn, beat["zoom"],
                            beat["pan"], bi, len(beats), sub_g0, gt, grains)
            else:
                m = master_card(L, P.CARDS[beat["card"]])
                stages = [(max(10, bn // 5), m)]
                gen = staged_frames(L, stages, bn, grains, sub_g0, gt,
                                    fade=14, push=0.03)
            for f in gen:
                frame_i += 1
                yield f
        return
    if scene["kind"] == "closing":
        m = master_closing(L)
        tw = int(L.W * (0.56 if L.vertical else 0.34))
        fr = max(6, min(int(round(0.8 * P.FPS)), max(1, n // 3)))
        held, _ = logo_layer(L, tw)
        stages = [(max(8, n), m)]
        for i, arr in enumerate(staged_frames(L, stages, n, grains, g0, gt,
                                             fade=min(16, max(6, n // 6)),
                                             push=0.022, drift=(0, -3))):
            if i >= fr:
                lg = held
            else:
                lg, _ = logo_layer(L, tw, alpha=(i / fr) ** 0.8)
            img = Image.alpha_composite(Image.fromarray(arr).convert("RGBA"), lg)
            yield draw_rail(np.array(img.convert("RGB")), L, g0 + i, gt)
        return
    raise ValueError("unknown scene kind " + scene["kind"])


# --------------------------------------------------------------------------- #
# Streaming assembler with crossfades
# --------------------------------------------------------------------------- #
class Assembler:
    """Writes frames to ffmpeg, blending scene joins, never holding the film."""

    def __init__(self, proc, xfade_frames, total_frames, W, H):
        self.proc = proc
        self.xf = xfade_frames
        self.total = total_frames
        self.W, self.H = W, H
        self.buf = deque()
        self.written = 0
        self.t0 = time.time()

    def as_rgb(self, frame):
        f = np.asarray(frame)
        if f.ndim != 3 or f.shape[2] != 3:
            raise ValueError(
                f"frame must be exactly 3-channel RGB, got shape {f.shape}. "
                "This is the bug that made the earlier cut run 1.33x long.")
        if f.shape[0] != self.H or f.shape[1] != self.W:
            raise ValueError(f"frame is {f.shape[1]}x{f.shape[0]}, expected "
                             f"{self.W}x{self.H}")
        return np.ascontiguousarray(f, dtype=np.uint8)

    def _write(self, frame):
        self.proc.stdin.write(self.as_rgb(frame).tobytes())
        self.written += 1
        if self.written % 120 == 0:
            el = time.time() - self.t0
            print(f"    {self.written}/{self.total} frames  "
                  f"{self.written/el:5.1f} fps  "
                  f"ETA {(self.total-self.written)/max(0.001, self.written/el):4.0f}s")

    def add(self, frames, crossfade):
        it = iter(frames)
        if crossfade and self.buf:
            for i in range(min(self.xf, len(self.buf))):
                try:
                    nxt = next(it)
                except StopIteration:
                    break
                prev = self.buf.popleft()
                self._write(blend(prev, nxt, (i + 1) / self.xf))
            self.buf.clear()
        for f in it:
            self.buf.append(f)
            while len(self.buf) > self.xf:
                self._write(self.buf.popleft())

    def flush(self):
        while self.buf:
            self._write(self.buf.popleft())


# --------------------------------------------------------------------------- #
# ffmpeg
# --------------------------------------------------------------------------- #
def build_ffmpeg(L, args, out_path, vo_paths, vo_offsets, music_path, duration,
                 total_frames):
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{L.W}x{L.H}", "-r", str(P.FPS), "-i", "-"]

    audio_inputs, fc = [], []
    if music_path and vo_paths:
        cmd += ["-i", music_path]
        for p in vo_paths:
            cmd += ["-i", p]
        fc.append("[1:a]anull[mus]")
        labels = "[mus]"
        for k, off in enumerate(vo_offsets):
            ms = int(round(off * 1000))
            fc.append(f"[{k+2}:a]adelay=delays={ms}:all=1,volume=0.92[vo{k}]")
            labels += f"[vo{k}]"
        # mix at unity (speech sits ~12 dB above the bed), then lift the whole
        # programme a little and catch the odd transient so it never clips
        fc.append(f"{labels}amix=inputs={1+len(vo_paths)}:normalize=0:"
                  f"duration=first[mixed]")
        fc.append("[mixed]volume=1.25,alimiter=level=false:limit=0.97[aout]")
        cmd += ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[aout]",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    else:
        cmd += ["-an"]

    cmd += ["-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "21",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
            "-g", "60", "-keyint_min", "30", "-sc_threshold", "0",
            "-colorspace", "bt709", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-movflags", "+faststart",
            "-r", str(P.FPS), out_path]
    return cmd


# --------------------------------------------------------------------------- #
def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--vertical", action="store_true")
    ap.add_argument("--limit", type=int, default=0,
                    help="smoke test: cap every scene to this many frames")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    L = Layout(vertical=args.vertical)
    out_path = args.out or (P.OUT_VERTICAL if args.vertical else P.OUT_LANDSCAPE)

    if not FFMPEG or not os.path.exists(FFMPEG):
        print("ffmpeg not found -- pip install imageio-ffmpeg")
        return 1

    vo_dur_path = os.path.join(P.AUDIO, "vo-durations.json")
    vo_durations = json.load(open(vo_dur_path)) if os.path.exists(vo_dur_path) \
        else [4.0] * len(P.VO_LINES)
    scenes, total = P.resolve_timeline(vo_durations, verbose=True)
    xfade_frames = P.crossfade_frames()

    # A scene no longer than the crossfade cannot be blended: the assembler
    # would have nothing left to hand the next scene and the frames written
    # would overrun the cut. Only fires if a plan is edited to be very short.
    shortest = min(s["frames"] for s in scenes)
    if shortest <= xfade_frames:
        xfade_frames = max(1, shortest - 1)
        print(f"note: crossfade shortened to {xfade_frames} frames "
              f"(shortest scene is {shortest})")

    if args.limit:
        # Same reason: a scene only just longer than the crossfade cannot
        # refill the assembler's buffer, so the written count drifts from the
        # cut. Keep every scene at least twice the crossfade long.
        cap = max(args.limit, 2 * xfade_frames)
        if cap != args.limit:
            print(f"SMOKE TEST: --limit {args.limit} is too short to blend "
                  f"against the {xfade_frames}-frame crossfade; "
                  f"using {cap} frames per beat")
        else:
            print(f"SMOKE TEST: limiting every beat to {cap} frames")
        for s in scenes:
            for b in s.get("beats", []):
                b["frames"] = max(1, min(b["frames"], cap))
            if s.get("beats"):
                s["frames"] = sum(b["frames"] for b in s["beats"])
            else:
                s["frames"] = max(1, min(s["frames"], cap))

    total_frames = sum(s["frames"] for s in scenes) - xfade_frames * (len(scenes) - 1)
    duration = total_frames / P.FPS

    g0, acc = {}, 0
    for i, s in enumerate(scenes):
        g0[s["name"]] = acc
        acc += s["frames"] - (xfade_frames if i > 0 else 0)

    print(f"cut: {total_frames} frames @ {P.FPS}fps = {duration:.2f}s  "
          f"({L.W}x{L.H}{' vertical' if L.vertical else ''})")
    print(f"fonts: regular={P.resolve_font_path('regular')} "
          f"semibold={P.resolve_font_path('semibold')}")

    ctx = dict(g0=g0, total_frames=total_frames,
               grains=grain_arrays(8, L.W, L.H, 4.5),
               xfade_frames=xfade_frames)

    vo_paths, vo_offsets = [], []
    music = None
    if not args.no_audio:
        for s in scenes:
            for p in s["vo_placed"]:
                f = os.path.join(P.AUDIO, f"vo-{p['index']+1:02d}.wav")
                if os.path.exists(f):
                    vo_paths.append(f)
                    vo_offsets.append(p["vo_start"])
        m = os.path.join(P.AUDIO, "music-bed.wav")
        if os.path.exists(m) and not args.no_music:
            music = m
        if not vo_paths:
            print("no narration found -- rendering caption + music cut")
    else:
        vo_offsets = []

    cmd = build_ffmpeg(L, args, out_path, vo_paths, vo_offsets, music,
                       duration, total_frames)
    print("ffmpeg:", " ".join(cmd[:8]), "...")
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    asm = Assembler(proc, xfade_frames, total_frames, L.W, L.H)
    for i, s in enumerate(scenes):
        t0 = time.time()
        asm.add(scene_frames(L, s, ctx), crossfade=(i > 0))
        print(f"  scene {s['name']:12s} {s['frames']:4d}f  "
              f"{time.time()-t0:5.1f}s  (written {asm.written})")
    asm.flush()

    try:
        proc.stdin.close()
    except Exception:
        pass
    err = proc.stderr.read().decode("utf8", "ignore")
    rc = proc.wait()
    print(f"ffmpeg rc={rc}; frames written={asm.written} "
          f"(expected {total_frames})")
    if rc != 0:
        print("FFMPEG STDERR:\n" + err[-3000:])
        return 1
    if asm.written != total_frames:
        print(f"!! frame count mismatch: wrote {asm.written}, expected {total_frames}")
        return 1
    size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
    print(f"\noutput: {out_path}\n        {size/1024/1024:.1f} MB, "
          f"{duration:.2f}s, {L.W}x{L.H}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
