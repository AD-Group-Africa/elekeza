"""
Elekeza Exhibition Film - Scene Renderer
----------------------------------------
Renders 1920x1080 stills (and optional motion keyframes) for each scene.
Style: restrained, premium, warm human-centred. Deep purple/green/orange accents
sourced from the existing brand (see tokens.css / manifest theme_color #4F46E5).

Output: PNG frames in assets/frames/<scene>/
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")
FRAMES = os.path.join(ASSETS, "frames")
os.makedirs(FRAMES, exist_ok=True)

W, H = 1920, 1080
FPS = 30

# ---- Brand palette (sourced from existing product assets) ----
PURPLE      = (79, 70, 229)     # manifest theme_color #4F46E5
PURPLE_DEEP = (45, 37, 160)
GREEN       = (34, 120, 80)     # brand green accent
ORANGE      = (234, 127, 55)    # warm sweet-orange accent
INK         = (15, 17, 24)
INK_SOFT    = (28, 31, 40)
PAPER       = (245, 243, 238)
MIST        = (228, 230, 236)
WHITE       = (255, 255, 255)
GREY_TEXT   = (120, 124, 136)

BODY_FONT = "assets/Inter-Medium.ttf"
TITLE_FONT = "assets/Inter-SemiBold.ttf"
if not os.path.exists(BODY_FONT):
    BODY_FONT = None
if not os.path.exists(TITLE_FONT):
    TITLE_FONT = None

def font(path, size):
    if path and os.path.exists(path):
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def vgradient(top, bottom, w=W, h=H):
    """Vertical gradient PNG."""
    top = np.array(top, dtype=np.float32)
    bottom = np.array(bottom, dtype=np.float32)
    t = np.linspace(0, 1, h)[:, None]
    row = (top[None, :] * (1 - t) + bottom[None, :] * t)  # h x 3
    arr = np.repeat(row[:, None, :], w, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def radial_soft(center, edge, w=W, h=H, cx=0.5, cy=0.5):
    """Simple radial-ish gradient by stacking vertical+horizontal falloff."""
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx / w - cx)
    dy = (yy / h - cy)
    d = np.sqrt(dx*dx + dy*dy)
    d = (d / np.sqrt(cx*cx + cy*cy + 0.7))  # normalize so edge~1
    d = np.clip(d, 0, 1)
    c = np.array(center, dtype=np.float32)
    e = np.array(edge, dtype=np.float32)
    arr = (c[None, None, :] * (1 - d[..., None]) + e[None, None, :] * d[..., None]).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def text_w(draw, s, fnt):
    b = draw.textbbox((0, 0), s, font=fnt)
    return b[2] - b[0], b[3] - b[1]


def draw_centered(draw, xy, s, fnt, fill, anchor="mm"):
    draw.text(xy, s, font=fnt, fill=fill, anchor=anchor)


def caption_strip(base, lines, y, fnt, fill, align="center", shadow=True, line_gap=8):
    """Draw one or more lines centered, with subtle shadow for readability."""
    draw = ImageDraw.Draw(base)
    cx = W // 2
    total_h = 0
    sizes = []
    for s in lines:
        w, h = text_w(draw, s, fnt)
        sizes.append((w, h))
        total_h += h + line_gap
    total_h -= line_gap
    start_y = y - total_h // 2
    for (s, (w, h)), i in zip(zip(lines, sizes), range(len(lines))):
        x = cx - w // 2 if align == "center" else (cx - w if align == "right" else cx)
        if shadow:
            draw.text((x + 2, start_y + 2), s, font=fnt, fill=(0, 0, 0, 90) if base.mode == "RGBA" else (0, 0, 0))
        draw.text((x, start_y), s, font=fnt, fill=fill)
        start_y += h + line_gap
    return base


def kerned_text(draw, xy, s, fnt, fill, tracking=0):
    x, y = xy
    for ch in s:
        draw.text((x, y), ch, font=fnt, fill=fill)
        w, _ = text_w(draw, ch, fnt)
        x += w + tracking


def vignette(img, strength=0.35):
    arr = np.array(img.convert("RGB"), dtype=np.float32) / 255.0
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = 0.5, 0.5
    dx = (xx / W - cx)
    dy = (yy / H - cy)
    d = np.sqrt(dx*dx + dy*dy)
    d = np.clip(d / 0.75, 0, 1)
    mask = 1 - strength * d
    arr = arr * mask[..., None]
    return Image.fromarray((arr * 255).clip(0, 255).astype(np.uint8), "RGB")


def subtle_grain(img, amount=6):
    arr = np.array(img, dtype=np.int16)
    noise = np.random.normal(0, amount, arr.shape).astype(np.int16)
    arr = (arr + noise)[... , :3].clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def letterbox_bar(base, color, height=8):
    """Thin accent bar at very bottom for brand grounding."""
    base.paste(color, (0, H - height, W, H))
    return base


def save_frame(path, img):
    img.convert("RGB").save(path, quality=95)


# ----------------------------------------------------------------------------
# Scene 0: Opening — typography-led, warm dark stage
# ----------------------------------------------------------------------------
def scene_opening(prefix="s0_opening"):
    f = FRAMES
    # Dark warm stage
    bg = radial_soft((36, 28, 46), (12, 10, 18), cx=0.5, cy=0.42)
    # subtle top glow
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in [(700, 22), (420, 30), (240, 26)]:
        gd.ellipse([W//2 - r, H//2 - r - 60, W//2 + r, H//2 + r - 60], fill=(150, 140, 220, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    base = bg.copy()

    # Accent line above
    draw = ImageDraw.Draw(base)
    ly = int(H * 0.30)
    draw.rectangle([W//2 - 90, ly, W//2 + 90, ly + 3], fill=ORANGE)

    title_font = font(TITLE_FONT, 64)
    body_font = font(BODY_FONT, 34)
    small_font = font(BODY_FONT, 26)

    draw_centered(draw, (W//2, int(H*0.34)), "Every learner is different.", title_font, WHITE)
    draw_centered(draw, (W//2, int(H*0.42)), "Every learner deserves the opportunity", body_font, (221, 224, 235))
    draw_centered(draw, (W//2, int(H*0.47)), "to thrive.", body_font, (221, 224, 235))

    # bottom accent + small brand hint
    draw = ImageDraw.Draw(base)
    by = int(H * 0.80)
    draw.rectangle([W//2 - 50, by, W//2 + 50, by + 2], fill=PURPLE)
    draw_centered(draw, (W//2, by + 40), "AFRICA DIGITALIS", small_font, GREY_TEXT)

    base = vignette(base, 0.30)
    base = subtle_grain(base, 5)
    letterbox_bar(base, ORANGE, 6)
    save_frame(os.path.join(f, f"{prefix}-00.png"), base)

    # second beat: fade deeper, same text — we produce one extra frame for ease-in
    base2 = bg.copy()
    draw = ImageDraw.Draw(base2)
    draw.rectangle([W//2 - 90, ly, W//2 + 90, ly + 3], fill=ORANGE)
    draw_centered(draw, (W//2, int(H*0.34)), "Every learner is different.", title_font, (240, 242, 250))
    draw_centered(draw, (W//2, int(H*0.42)), "Every learner deserves the opportunity", body_font, (200, 204, 218))
    draw_centered(draw, (W//2, int(H*0.47)), "to thrive.", body_font, (200, 204, 218))
    draw = ImageDraw.Draw(base2)
    draw.rectangle([W//2 - 50, by, W//2 + 50, by + 2], fill=PURPLE)
    draw_centered(draw, (W//2, by + 40), "AFRICA DIGITALIS", small_font, (150, 154, 168))
    base2 = vignette(base2, 0.32)
    base2 = subtle_grain(base2, 5)
    letterbox_bar(base2, ORANGE, 6)
    save_frame(os.path.join(f, f"{prefix}-01.png"), base2)
    return prefix


# ----------------------------------------------------------------------------
# Scene 1: Brand reveal — Eleheza lockup
# ----------------------------------------------------------------------------
def scene_brand(prefix="s1_brand"):
    f = FRAMES
    bg = vgradient((26, 22, 40), (12, 10, 18))
    # soft purple glow low-right
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W - 900, H - 500, W + 100, H + 100], fill=(120, 100, 220, 28))
    gd.ellipse([-200, H - 600, W - 300, H + 50], fill=(70, 90, 140, 20))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    base = bg.copy()
    draw = ImageDraw.Draw(base)

    # Eleheza wordmark rendered from the supplied logo mark is preferred,
    # but we also render a clean typographic "ELEKEZA" for the reveal.
    logo_mark = Image.open(os.path.join(ASSETS, "logo-mark-tight.png")).convert("RGBA")
    # scale mark to width 1100
    target_w = 1180
    scale = target_w / logo_mark.width
    logo_big = logo_mark.resize((target_w, int(logo_mark.height * scale)), Image.LANCZOS)

    # fade-in opacity handled by ffmpeg; here draw at full with subtle glow
    mark_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mx = (W - logo_big.width) // 2
    my = int(H * 0.30)
    # soft halo
    halo = Image.new("RGBA", logo_big.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([-60, -60, logo_big.width+60, logo_big.height+60], fill=(120, 100, 220, 70))
    halo = halo.filter(ImageFilter.GaussianBlur(40))
    mark_layer.alpha_composite(halo, (mx-60, my-60))
    mark_layer.alpha_composite(logo_big, (mx, my))
    base = Image.alpha_composite(base.convert("RGBA"), mark_layer).convert("RGB")
    draw = ImageDraw.Draw(base)

    # subtitle
    sub_font = font(BODY_FONT, 38)
    by = my + logo_big.height + 40
    draw_centered(draw, (W//2, by), "Inclusive Learning & Education Infrastructure",
                  sub_font, (225, 228, 240))
    draw_centered(draw, (W//2, by + 56), "By Afrika Digitalis", font(BODY_FONT, 30), (150, 154, 170))

    # bottom bar
    draw.rectangle([W//2 - 70, int(H*0.86), W//2 + 70, int(H*0.86) + 2], fill=ORANGE)

    base = vignette(base, 0.28)
    base = subtle_grain(base, 5)
    letterbox_bar(base, PURPLE, 6)
    save_frame(os.path.join(f, f"{prefix}-00.png"), base)
    return prefix


# ----------------------------------------------------------------------------
# Scene 2: Product montage — real screenshots with cinematic frame + label
# ----------------------------------------------------------------------------
def scene_product(scene_file, label_lines, prefix, duration_sec=4.0,
                  bg=(18, 20, 28), label_color=WHITE, accent=ORANGE):
    f = FRAMES
    base_img = Image.open(os.path.join(ASSETS, scene_file)).convert("RGB")
    # ensure 1920x1080
    if base_img.size != (W, H):
        base_img = base_img.resize((W, H), Image.LANCZOS)

    n_frames = int(duration_sec * FPS)
    for i in range(n_frames):
        t = i / max(1, n_frames - 1)
        # gentle zoom-in 1.0 -> 1.06
        zoom = 1.0 + 0.06 * t
        vw = int(W * zoom)
        vh = int(H * zoom)
        crop = base_img.resize((vw, vh), Image.LANCZOS)
        left = (vw - W) // 2
        top = (vh - H) // 2
        frame = crop.crop((left, top, left + W, top + H)).convert("RGBA")

        # cinematic letterbox bars (top/bottom) dark
        frame.paste((6, 7, 12, 255), (0, 0, W, 60))
        frame.paste((6, 7, 12, 255), (0, H - 60, W, H))

        # dark gradient at bottom for caption legibility
        grad = Image.new("RGBA", (W, 320), (0, 0, 0, 0))
        arr = np.array(grad)
        alpha = np.linspace(0, 205, 320).astype(np.uint8)
        arr[:, :, 3] = alpha[:, None]
        grad = Image.fromarray(arr, "RGBA")
        frame.alpha_composite(grad, (0, H - 320))

        # scrub faint horizontal motion streak removed; keep clean.

        draw = ImageDraw.Draw(frame)

        # top-left small brand tick + scene label
        tick_font = font(BODY_FONT, 22)
        draw.text((60, 80), "ELEKEZA", font=font(TITLE_FONT, 22), fill=accent)
        draw.text((60, 110), label_lines[0], font=tick_font, fill=label_color)

        # optional secondary line
        if len(label_lines) > 1:
            draw.text((60, 140), label_lines[1], font=font(BODY_FONT, 20), fill=(190, 194, 206))

        # thin accent rule under label
        draw.rectangle([60, 172, 60 + 120, 174], fill=accent)

        # bottom caption (lower third)
        cap_y = H - 250
        caption_strip(frame, label_lines[-1:], cap_y, font(BODY_FONT, 30),
                      WHITE, align="left", shadow=True, line_gap=6)

        frame = frame.convert("RGB")
        frame = vignette(frame, 0.18)
        frame = subtle_grain(frame, 4)
        save_frame(os.path.join(f, f"{prefix}-{i:03d}.png"), frame)
    return prefix, n_frames


# ----------------------------------------------------------------------------
# Scene 3: Inclusive learning + curriculum diversity (typographic, semi-screen)
# ----------------------------------------------------------------------------
def scene_inclusive(prefix="s3_inclusive"):
    f = FRAMES
    base = radial_soft((24, 30, 34), (10, 12, 16), cx=0.5, cy=0.5)
    # Place a faded product thumbnail on right for authenticity
    thumb = Image.open(os.path.join(ASSETS, "scene-my-lessons.png")).convert("RGB").resize((820, 464), Image.LANCZOS)
    tlayer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # darken thumbnail
    thumb = ImageEnhance.Brightness(thumb).enhance(0.78)
    tlayer.paste(thumb, (W - 860, H - 520))
    tlayer = Image.fromarray(np.array(tlayer)[..., :3]).convert("RGBA")
    ov = Image.new("RGBA", thumb.size, (10, 12, 18, 150))
    tlayer.alpha_composite(ov, (0, 0))
    thumb_rgba = Image.merge("RGBA", (*thumb.split(), Image.new("L", thumb.size, 255)))
    tlayer.alpha_composite(thumb_rgba, (W - 860, H - 520))
    base = Image.alpha_composite(base.convert("RGBA"), tlayer).convert("RGB")
    draw = ImageDraw.Draw(base)

    big = font(TITLE_FONT, 58)
    mid = font(BODY_FONT, 36)
    small = font(BODY_FONT, 28)

    draw_centered(draw, (W//2, int(H*0.30)), "Different learners.", big, WHITE)
    draw_centered(draw, (W//2, int(H*0.38)), "Different needs.", big, (221, 224, 235))
    draw_centered(draw, (W//2, int(H*0.46)), "More inclusive learning experiences.",
                  mid, (210, 214, 228))

    # feature chips
    chips = ["Accessible ways to engage",
             "School, learner, teacher & guardian",
             "Educational contexts that can evolve"]
    cy = int(H*0.60)
    for c in chips:
        w, h = text_w(draw, c, small)
        pad = 34
        draw.rounded_rectangle([W//2 - w//2 - pad, cy - h//2 - 6,
                                W//2 + w//2 + pad, cy + h//2 + 6],
                               radius=14, outline=PURPLE, width=2, fill=(255,255,255,8))
        draw.text((W//2 - w//2, cy - h//2), c, font=small, fill=(235, 238, 246))
        cy += h + 34

    # roadmap disclaimer line
    draw.text((W//2 - 360, H - 70), "Current build shown — roadmap continues to grow.",
              font=font(BODY_FONT, 22), fill=(140, 144, 158))
    base = vignette(base, 0.30)
    base = subtle_grain(base, 5)
    letterbox_bar(base, GREEN, 6)
    save_frame(os.path.join(f, f"{prefix}-00.png"), base)
    return prefix


# ----------------------------------------------------------------------------
# Scene 4: Opportunity — proposed school pilot
# ----------------------------------------------------------------------------
def scene_opportunity(prefix="s4_opportunity"):
    f = FRAMES
    base = vgradient((32, 30, 42), (14, 12, 20))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-260, -260, 760, 760], fill=(120, 100, 220, 30))
    gd.ellipse([W-700, H-700, W+200, H+200], fill=(70, 90, 140, 28))
    base = Image.alpha_composite(base.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(base)

    head = font(TITLE_FONT, 60)
    mid = font(BODY_FONT, 38)
    small = font(BODY_FONT, 28)

    draw_centered(draw, (W//2, int(H*0.34)), "Built to support", head, WHITE)
    draw_centered(draw, (W//2, int(H*0.42)), "more inclusive learning.", head, (221, 224, 235))
    # divider
    draw.rectangle([W//2 - 80, int(H*0.50), W//2 + 80, int(H*0.50) + 2], fill=ORANGE)
    draw_centered(draw, (W//2, int(H*0.56)), "Exploring a proposed school pilot.",
                  mid, (210, 214, 228))
    draw_centered(draw, (W//2, int(H*0.62)), "Working with educators and partners",
                  small, (180, 184, 200))
    draw_centered(draw, (W//2, int(H*0.66)), "to learn, validate and improve.",
                  small, (180, 184, 200))

    draw_centered(draw, (W//2, int(H*0.82)), "PROPOSED — NOT YET DEPLOYED",
                  font(BODY_FONT, 22), (234, 127, 55))

    base = vignette(base, 0.28)
    base = subtle_grain(base, 5)
    letterbox_bar(base, ORANGE, 6)
    save_frame(os.path.join(f, f"{prefix}-00.png"), base)
    return prefix


# ----------------------------------------------------------------------------
# Scene 5: Closing — logo + invitation
# ----------------------------------------------------------------------------
def scene_closing(prefix="s5_closing"):
    f = FRAMES
    base = radial_soft((28, 24, 42), (10, 8, 16), cx=0.5, cy=0.45)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W//2 - 600, H//2 - 600, W//2 + 600, H//2 + 600], fill=(120, 100, 220, 30))
    base = Image.alpha_composite(base.convert("RGBA"), glow).convert("RGB")

    # logo mark centred upper-middle
    logo = Image.open(os.path.join(ASSETS, "logo-mark-tight.png")).convert("RGBA")
    target_h = 240
    scale = target_h / logo.height
    logo_big = logo.resize((int(logo.width*scale), target_h), Image.LANCZOS)
    mlayer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mx = (W - logo_big.width)//2
    my = int(H*0.26)
    halo = Image.new("RGBA", logo_big.size, (0,0,0,0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([-40, -40, logo_big.width+40, logo_big.height+40], fill=(120, 100, 220, 90))
    halo = halo.filter(ImageFilter.GaussianBlur(35))
    mlayer.alpha_composite(halo, (mx-40, my-40))
    mlayer.alpha_composite(logo_big, (mx, my))
    base = Image.alpha_composite(base.convert("RGBA"), mlayer).convert("RGB")
    draw = ImageDraw.Draw(base)

    main = font(TITLE_FONT, 56)
    body = font(BODY_FONT, 34)
    small = font(BODY_FONT, 26)

    draw_centered(draw, (W//2, int(H*0.52)), "Every learner deserves a way forward.",
                  main, WHITE)
    draw_centered(draw, (W//2, int(H*0.60)), "Let's explore a more inclusive future for learning.",
                  body, (215, 218, 232))
    draw_centered(draw, (W//2, int(H*0.72)), "Afrika Digitalis",
                  small, (150, 154, 170))

    # thin rules
    draw.rectangle([W//2 - 60, int(H*0.78), W//2 + 60, int(H*0.78) + 2], fill=ORANGE)
    draw.rectangle([W//2 - 60, int(H*0.78) + 8, W//2 + 60, int(H*0.78) + 10], fill=PURPLE)

    base = vignette(base, 0.30)
    base = subtle_grain(base, 5)
    letterbox_bar(base, PURPLE, 6)
    save_frame(os.path.join(f, f"{prefix}-00.png"), base)
    return prefix


if __name__ == "__main__":
    print("Rendering scenes...")
    scene_opening()
    scene_brand()
    scene_inclusive()
    scene_opportunity()
    scene_closing()
    print("Static scenes done.")

    print("Rendering product montage scenes...")
    product_scenes = [
        ("scene-login.png", ["Welcome", "Login screen", "Entry point for learners, guardians and teachers"], "s2_login", 3.5),
        ("scene-learner-dashboard.png", ["Learner home", "Dashboard", "A clear daily path for each learner"], "s2_dashboard", 4.0),
        ("scene-my-lessons.png", ["My Lessons", "Learning activity", "Lessons and objectives at a glance"], "s2_lessons", 4.0),
        ("scene-lesson-reading.png", ["Reading mode", "Lesson content", "Engaging directly with lesson material"], "s2_reading", 4.0),
        ("scene-accessibility.png", ["Accessibility", "Learner preferences", "Settings that support different needs"], "s2_accessibility", 4.5),
        ("scene-quiz-result.png", ["Practice & feedback", "Quiz result", "Learners build confidence as they go"], "s2_quiz", 3.5),
        ("scene-teacher-dashboard.png", ["Teacher view", "Teacher dashboard", "Educators see the whole class"], "s2_teacher", 4.0),
        ("scene-guardian-dashboard.png", ["Guardian view", "Guardian dashboard", "Families stay connected to progress"], "s2_guardian", 4.0),
    ]
    total = 0
    for file, lines, prefix, dur in product_scenes:
        _, n = scene_product(file, lines, prefix, dur)
        total += n
        print(f"  {prefix}: {n} frames ({dur}s)")
    print(f"Total product frames: {total}")
    print("ALL SCENES RENDERED.")
