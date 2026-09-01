#!/usr/bin/env python3
"""Баннеры заведений для карусели главной — в языке feedup × ZAP!.

Эталон — assets/brand/venues/feedup.webp: широкий прозрачный коллаж, в центре
чёрная «пилюля» с лаймовой обводкой и лок-апом «логотип × ZAP!», вокруг —
крупная еда, молнии, полутоновая фактура, искры и облачко с репликой.

Главное в эталоне — именно ЕДА, а не абстрактные значки: без неё баннер
перестаёт читаться как баннер заведения. Иллюстрации не рисуются заново, они
вырезаны из листов стикеров в docs/product (лежат в tools/banner-src) — то же
происхождение, что и у стикеров внутри приложения, поэтому стиль совпадает.

Запуск:  python3 tools/gen-venue-banners.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
SRC = os.path.join(ROOT, "tools", "banner-src")
OUT = os.path.join(A, "brand", "venues")

W, H = 1942, 809
LIME = (221, 255, 51, 255)
INK = (17, 17, 16, 255)
WHITE = (255, 255, 255, 255)

FONT_XB = os.path.join(A, "fonts", "Manrope-ExtraBold.ttf")


def font(size):
    return ImageFont.truetype(FONT_XB, size)


def load(path, height, flip=False):
    """path — относительно assets, а если там нет, то относительно banner-src."""
    full = os.path.join(A, path)
    if not os.path.exists(full):
        full = os.path.join(SRC, path)
    im = Image.open(full).convert("RGBA")
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def bolt(canvas, cx, cy, h, angle=0):
    """Молния той же формы, что в вордмарке ZAP!, с чёрным контуром."""
    u = h / 100.0
    pts = [(-18, -50), (16, -50), (2, -10), (24, -10), (-14, 50), (-2, 4), (-22, 4)]
    a = math.radians(angle)
    pts = [
        (
            x * u * math.cos(a) - y * u * math.sin(a) + cx,
            x * u * math.sin(a) + y * u * math.cos(a) + cy,
        )
        for x, y in pts
    ]
    canvas.polygon(pts, fill=LIME, outline=INK, width=max(3, int(h / 26)))


def sparkle(canvas, cx, cy, r):
    k = r * 0.2
    canvas.polygon(
        [(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k),
         (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)],
        fill=LIME,
    )


def halftone(img, box, step=17, r=5, color=(221, 255, 51, 170)):
    """Полутоновое пятно — фирменная фактура коллажа, тает к краю."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    for row, y in enumerate(range(y0, y1, step)):
        fade = 1 - (y - y0) / max(1, y1 - y0)
        rr = max(1, int(r * (0.3 + 0.7 * fade)))
        off = step // 2 if row % 2 else 0
        for x in range(x0 + off, x1, step):
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=color)


def smiley(img, cx, cy, r):
    """Лаймовый смайлик — он есть в эталоне и держит настроение коллажа."""
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LIME, outline=INK, width=max(3, r // 9))
    e = r * 0.2
    for dx in (-r * 0.36, r * 0.36):
        d.ellipse([cx + dx - e / 2, cy - r * 0.3 - e, cx + dx + e / 2, cy - r * 0.3 + e], fill=INK)
    d.arc([cx - r * 0.55, cy - r * 0.35, cx + r * 0.55, cy + r * 0.6], 20, 160,
          fill=INK, width=max(3, r // 8))


def bubble(img, cx, cy, lines, size=46, tail="left"):
    d = ImageDraw.Draw(img)
    f = font(size)
    widths = [d.textlength(t, font=f) for t in lines]
    pad = 26
    w = max(widths) + pad * 2
    h = size * 1.2 * len(lines) + pad * 2
    x0, y0 = cx - w / 2, cy - h / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=h / 2.2, fill=LIME, outline=INK, width=6)
    tx = x0 + (w * 0.3 if tail == "left" else w * 0.7)
    d.polygon([(tx - 20, y0 + h - 6), (tx + 22, y0 + h - 6), (tx - 6, y0 + h + 38)],
              fill=LIME, outline=INK, width=5)
    d.polygon([(tx - 14, y0 + h - 12), (tx + 16, y0 + h - 12), (tx - 6, y0 + h + 26)], fill=LIME)
    for i, t in enumerate(lines):
        d.text((cx - widths[i] / 2, y0 + pad + i * size * 1.2), t, font=f, fill=INK)


def text_logo(title, sub, height):
    """Белая подпись заведения.

    Готовые файлы логотипов свёрстаны под светлый фон — тёмный текст на чёрной
    пилюле пропадает, поэтому подпись рисуется своим шрифтом.
    """
    f1 = font(int(height * 0.62))
    f2 = font(int(height * 0.16)) if sub else None
    t = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(max(t.textlength(title, font=f1), t.textlength(sub, font=f2) if sub else 0)) + 8
    im = Image.new("RGBA", (w, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text(((w - t.textlength(title, font=f1)) / 2, 0), title, font=f1, fill=WHITE)
    if sub:
        d.text(((w - t.textlength(sub, font=f2)) / 2, height * 0.76), sub, font=f2, fill=LIME)
    return im


def lockup(img, logo, logo_h, pill_w=930, pill_h=214):
    d = ImageDraw.Draw(img)
    x0, y0 = (W - pill_w) / 2, (H - pill_h) / 2
    d.rounded_rectangle([x0, y0, x0 + pill_w, y0 + pill_h], radius=pill_h / 2,
                        fill=INK, outline=LIME, width=11)

    mark = text_logo(*logo, logo_h) if isinstance(logo, tuple) else load(logo, logo_h)
    zap = load("brand/zap-wordmark.png", 128)
    f = font(60)
    xw = d.textlength("×", font=f)
    gap = 44
    x = (W - (mark.width + gap + xw + gap + zap.width)) / 2
    img.paste(mark, (int(x), int((H - mark.height) / 2)), mark)
    x += mark.width + gap
    d.text((x, H / 2 - 43), "×", font=f, fill=WHITE)
    x += xw + gap
    img.paste(zap, (int(x), int((H - zap.height) / 2)), zap)


def build(name, logo, logo_h, food, caption):
    """food — список (файл, высота, x, y); рисуется поверх молний и фактуры."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    halftone(img, (250, 180, 640, 470))
    halftone(img, (1300, 340, 1700, 610))
    for cx, cy, h, ang in [
        (95, 420, 320, -9), (1855, 300, 290, 12), (300, 690, 190, 6),
        (1660, 690, 170, -6), (1130, 120, 165, -14), (820, 700, 150, 4),
    ]:
        bolt(d, cx, cy, h, ang)

    # Еда рисуется ДО пилюли и заходит под неё — в эталоне лок-ап лежит
    # поверх бургера и лаваша, именно это делает коллаж плотным, а не
    # «иконки по краям».
    for item in food:
        path, fh, fx, fy = item[:4]
        im = load(path, fh, flip=len(item) > 4 and item[4])
        img.paste(im, (fx, fy), im)

    lockup(img, logo, logo_h)

    for cx, cy, r in [(700, 205, 26), (1255, 215, 20), (1795, 265, 30), (170, 640, 22)]:
        sparkle(d, cx, cy, r)
    smiley(img, 1245, 690, 44)
    bubble(img, 345, 150, caption)

    out = os.path.join(OUT, name + ".webp")
    img.save(out, "WEBP", quality=88, method=6)
    print(f"{name:12s} {os.path.getsize(out) // 1024} КБ")


# Еда подобрана по кухне заведения: EVOS — фастфуд, Bellissimo — пицца,
# Safia — кондитерская (торты и выпечка), Bon — кофейня. Подставить бургер
# кондитерской — ровно та небрежность, из-за которой баннер перестаёт
# читаться как «про это место».
build(
    "evos", "brand/partners/evos-logo.png", 142,
    food=[("food-combo.png", 470, 255, 250), ("burger-set.png", 340, 1310, 360)],
    caption=["REAL TASTE", "EVERY DAY"],
)

build(
    "bellissimo", ("Bellissimo", "PIZZA"), 132,
    food=[("pizza-box.png", 450, 250, 250), ("stickers/theme-food.png", 400, 1310, 330)],
    caption=["GOOD PIZZA", "GOOD MOOD"],
)

build(
    "safia", ("Safia", "CAKES & PASTRY"), 132,
    food=[("dessert.png", 440, 265, 255), ("dessert.png", 330, 1330, 375, True)],
    caption=["FRESH BAKED", "DAILY"],
)

build(
    "bon", ("Bon!", "COFFEE SHOP"), 132,
    food=[("coffee-duo.png", 460, 255, 245), ("stickers/theme-coffee.png", 360, 1330, 350)],
    caption=["GOOD COFFEE", "GOOD MOOD"],
)
