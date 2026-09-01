#!/usr/bin/env python3
"""Баннеры заведений для карусели главной — в стиле feedup × ZAP!.

Эталон — assets/brand/venues/feedup.webp: широкий прозрачный коллаж, в центре
чёрная «пилюля» с лаймовой обводкой и лок-апом «логотип × ZAP!», вокруг —
стикеры, молнии, полутоновые точки и облачко с репликой.

Иллюстрации не рисуются заново: в assets/stickers уже лежит набор ровно в
этом языке (белая обводка, лайм, чёрный контур, ZAP!). Берём оттуда, поэтому
баннеры гарантированно совпадают со стикерами внутри приложения.

Запуск:  python3 tools/gen-venue-banners.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
OUT = os.path.join(A, "brand", "venues")

W, H = 1942, 809
LIME = (221, 255, 51, 255)
INK = (17, 17, 16, 255)
WHITE = (255, 255, 255, 255)

FONT_XB = os.path.join(A, "fonts", "Manrope-ExtraBold.ttf")


def font(size):
    return ImageFont.truetype(FONT_XB, size)


def load(path, height):
    im = Image.open(os.path.join(A, path)).convert("RGBA")
    w = round(im.width * height / im.height)
    return im.resize((w, height), Image.LANCZOS)


def bolt(canvas, cx, cy, h, angle=0, color=LIME, outline=None):
    """Молния: та же форма, что в вордмарке ZAP!, просто многоугольник."""
    u = h / 100.0
    pts = [(-18, -50), (16, -50), (2, -10), (24, -10), (-14, 50), (-2, 4), (-22, 4)]
    pts = [(x * u, y * u) for x, y in pts]
    a = math.radians(angle)
    pts = [(x * math.cos(a) - y * math.sin(a) + cx, x * math.sin(a) + y * math.cos(a) + cy) for x, y in pts]
    if outline:
        canvas.polygon(pts, fill=color, outline=outline, width=max(2, int(h / 24)))
    else:
        canvas.polygon(pts, fill=color)


def sparkle(canvas, cx, cy, r, color=LIME):
    """Четырёхлучевая искра — как в феедап-баннере."""
    k = r * 0.22
    canvas.polygon(
        [(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k),
         (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)],
        fill=color,
    )


def halftone(img, box, color=(221, 255, 51, 150), step=17, r=4):
    """Полутоновая заливка точками — фирменная фактура коллажа."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    rows = 0
    for y in range(y0, y1, step):
        rows += 1
        # точки к краю мельчают: пятно должно растворяться, а не обрываться
        fade = 1 - (y - y0) / max(1, (y1 - y0))
        rr = max(1, int(r * (0.35 + 0.65 * fade)))
        off = (step // 2) if rows % 2 else 0
        for x in range(x0 + off, x1, step):
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=color)


def bubble(img, cx, cy, lines, size=44, pad=26, tail="left"):
    """Лаймовое облачко с репликой, как «GOOD FOOD GOOD MOOD»."""
    d = ImageDraw.Draw(img)
    f = font(size)
    widths = [d.textlength(t, font=f) for t in lines]
    tw, th = max(widths), size * 1.22 * len(lines)
    w, h = tw + pad * 2, th + pad * 2
    x0, y0 = cx - w / 2, cy - h / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=h / 2, fill=LIME,
                        outline=INK, width=6)
    # хвостик облачка
    ty = y0 + h - 4
    tx = x0 + (w * 0.28 if tail == "left" else w * 0.72)
    d.polygon([(tx - 20, ty), (tx + 22, ty), (tx - 4, ty + 40)], fill=LIME, outline=INK, width=5)
    d.polygon([(tx - 15, ty - 6), (tx + 17, ty - 6), (tx - 4, ty + 30)], fill=LIME)
    for i, t in enumerate(lines):
        d.text((cx - widths[i] / 2, y0 + pad + i * size * 1.22), t, font=f, fill=INK)


def text_logo(title, sub, height, mark=None):
    """Логотип: фирменный знак (если есть) + белая подпись.

    Готовые файлы логотипов свёрстаны под светлый фон — тёмный текст на
    чёрной пилюле пропадает. Поэтому знак берём из файла, а подпись рисуем
    сами белым.
    """
    f1 = font(int(height * 0.60))
    f2 = font(int(height * 0.155)) if sub else None
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    tw = max(tmp.textlength(title, font=f1), tmp.textlength(sub, font=f2) if sub else 0)

    knob = load(mark, int(height * 0.86)) if mark else None
    gap = int(height * 0.18) if knob else 0
    w = int(tw) + (knob.width + gap if knob else 0) + 8
    im = Image.new("RGBA", (w, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    x = 0
    if knob:
        im.paste(knob, (0, (height - knob.height) // 2), knob)
        x = knob.width + gap
    d.text((x + (tw - tmp.textlength(title, font=f1)) / 2, height * 0.06), title, font=f1, fill=WHITE)
    if sub:
        d.text((x + (tw - tmp.textlength(sub, font=f2)) / 2, height * 0.76), sub, font=f2, fill=LIME)
    return im


def lockup(img, logo_path, logo_h, pill_w=980, pill_h=228):
    """Центральный лок-ап «логотип × ZAP!» в чёрной пилюле."""
    d = ImageDraw.Draw(img)
    x0, y0 = (W - pill_w) / 2, (H - pill_h) / 2
    d.rounded_rectangle([x0, y0, x0 + pill_w, y0 + pill_h], radius=pill_h / 2,
                        fill=INK, outline=LIME, width=11)

    if isinstance(logo_path, tuple):
        title, sub, *mark = logo_path
        logo = text_logo(title, sub, logo_h, mark[0] if mark else None)
    else:
        logo = load(logo_path, logo_h)
    zap = load("brand/zap-wordmark.png", 132)
    f = font(64)
    xw = d.textlength("×", font=f)

    gap = 46
    total = logo.width + gap + xw + gap + zap.width
    x = (W - total) / 2
    img.paste(logo, (int(x), int((H - logo.height) / 2)), logo)
    x += logo.width + gap
    d.text((x, H / 2 - 46), "×", font=f, fill=WHITE)
    x += xw + gap
    img.paste(zap, (int(x), int((H - zap.height) / 2)), zap)


def build(name, logo_path, logo_h, left, right, caption, seed_bolts):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # фактура и молнии уходят под стикеры — рисуем первыми
    halftone(img, (300, 210, 700, 470), step=19, r=5)
    halftone(img, (1240, 330, 1660, 590), step=19, r=5)
    for cx, cy, h, ang in seed_bolts:
        bolt(d, cx, cy, h, ang, outline=INK)

    ls, rs = load(left[0], left[1]), load(right[0], right[1])
    img.paste(ls, (left[2], left[3]), ls)
    img.paste(rs, (right[2], right[3]), rs)

    lockup(img, logo_path, logo_h)

    # искры и реплика — поверх всего, как в эталоне
    for cx, cy, r in [(700, 235, 26), (1290, 250, 20), (1780, 330, 30), (150, 470, 22)]:
        sparkle(d, cx, cy, r)
    bubble(img, 330, 165, caption)

    out = os.path.join(OUT, name + ".webp")
    img.save(out, "WEBP", quality=88, method=6)
    print(f"{name:12s} → {out}  {os.path.getsize(out) // 1024} КБ")


# Стикеры подобраны по характеру заведения; для EVOS и Bon! в наборе нет
# профильной еды, поэтому взяты фирменный персонаж-чек и «социальные» сцены —
# они нейтральны и не выдают чужую кухню за свою.
build(
    "evos", "brand/partners/evos-logo.png", 150,
    left=("stickers/receipt-hero.png", 420, 200, 300),
    right=("stickers/fist-bump.png", 360, 1460, 380),
    caption=["REAL TASTE", "EVERY DAY"],
    seed_bolts=[(120, 430, 300, -8), (1810, 250, 260, 12), (960, 690, 190, 0), (1120, 150, 170, -14)],
)

build(
    "bellissimo", ("Bellissimo", "PIZZA"), 138,
    left=("stickers/theme-food.png", 420, 140, 300),
    right=("stickers/receipt-hero.png", 400, 1470, 330),
    caption=["GOOD PIZZA", "GOOD MOOD"],
    seed_bolts=[(130, 400, 300, -10), (1830, 300, 250, 14), (930, 700, 180, 0), (1150, 140, 160, -12)],
)

build(
    "safia", ("Safia", "CAFÉ & BAKERY", "brand/partners/safia-sq.png"), 150,
    left=("stickers/theme-coffee.png", 410, 155, 305),
    right=("stickers/hands-heart.png", 360, 1450, 380),
    caption=["FRESH BAKED", "DAILY"],
    seed_bolts=[(120, 420, 290, -9), (1820, 270, 250, 13), (950, 690, 180, 0), (1100, 150, 160, -12)],
)

build(
    "bon", ("Bon!", "BOULANGERIE · PÂTISSERIE"), 150,
    left=("stickers/heart-zap.png", 380, 175, 320),
    right=("stickers/bill-done.png", 400, 1480, 330),
    caption=["FRESHLY BAKED", "EVERY DAY"],
    seed_bolts=[(125, 410, 295, -8), (1815, 285, 245, 13), (940, 695, 185, 0), (1130, 145, 165, -13)],
)
