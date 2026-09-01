#!/usr/bin/env python3
"""Стикер «десерт» для баннера Safia — кондитерская, а не кофейня.

В листах стикеров docs/product выпечки нет вообще: там фастфуд, пицца и кофе.
Брать торт из старого изометрического рендера нельзя — он фотореалистичный,
мелкий, и рядом с плоскими стикерами читается как чужеродная вставка.
Поэтому кусок торта и круассан нарисованы теми же средствами, что и остальная
графика баннера: плоская заливка, толстый чёрный контур, белая обводка
стикера, лаймовые искры.

Запуск:  python3 tools/gen-dessert-sticker.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "banner-src", "dessert.png")

# Рисуем крупно и уменьшаем — контуры получаются гладкими.
S = 3
W, H = 420 * S, 400 * S

INK = (17, 17, 16, 255)
LIME = (221, 255, 51, 255)
WHITE = (255, 255, 255, 255)
CREAM = (255, 243, 224, 255)
SPONGE = (233, 184, 122, 255)
JAM = (226, 74, 74, 255)
CHOCO = (122, 74, 45, 255)
PLATE = (245, 245, 242, 255)

LW = 7 * S  # толщина чёрного контура


def cake(d, x, y, w, h):
    """Кусок торта сбоку: бисквит — джем — бисквит — крем, вишня сверху."""
    # тарелка
    d.ellipse([x - 26 * S, y + h - 16 * S, x + w + 26 * S, y + h + 22 * S],
              fill=PLATE, outline=INK, width=LW)

    layers = [(SPONGE, 0.30), (JAM, 0.12), (SPONGE, 0.28), (CREAM, 0.30)]
    top = y + h
    for color, frac in layers:
        hh = h * frac
        d.rectangle([x, top - hh, x + w, top], fill=color, outline=INK, width=LW)
        top -= hh

    # шапка крема — три волны
    r = w / 6
    for i in range(3):
        cx = x + r + i * (w - 2 * r) / 2
        d.ellipse([cx - r, top - r * 1.25, cx + r, top + r * 0.75],
                  fill=CREAM, outline=INK, width=LW)

    # вишня
    cx, cy, cr = x + w / 2, top - r * 1.4, 17 * S
    d.line([cx, cy - cr, cx + 12 * S, cy - cr - 26 * S], fill=INK, width=LW)
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=JAM, outline=INK, width=LW)


def donut(d, cx, cy, r):
    """Пончик: круг, розовая глазурь с потёками, дырка, лаймовая посыпка.

    Круассан из дуг читался как бесформенное пятно — у пончика силуэт
    однозначный, поэтому в плоском стиле он выигрывает.
    """
    GLAZE = (244, 166, 190, 255)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=SPONGE, outline=INK, width=LW)
    # глазурь — круг чуть меньше со «сползающими» каплями по низу
    gr = r * 0.90
    d.ellipse([cx - gr, cy - gr, cx + gr, cy + gr * 0.72], fill=GLAZE, outline=INK, width=LW)
    for i in range(5):
        dx = -gr * 0.72 + i * gr * 0.36
        dr = gr * (0.20 if i % 2 else 0.27)
        d.ellipse([cx + dx - dr, cy + gr * 0.40, cx + dx + dr, cy + gr * 0.40 + dr * 2],
                  fill=GLAZE, outline=INK, width=LW)
    # дырка
    hr = r * 0.30
    d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=(0, 0, 0, 0))
    d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], outline=INK, width=LW)
    # посыпка
    for dx, dy, a in [(-0.42, -0.36, 0), (0.30, -0.44, 1), (0.52, 0.02, 0),
                      (-0.54, 0.06, 1), (0.06, -0.60, 1)]:
        px, py = cx + gr * dx, cy + gr * dy
        w, h = (13 * S, 5 * S) if a else (5 * S, 13 * S)
        d.rounded_rectangle([px - w, py - h, px + w, py + h], radius=4 * S, fill=LIME)


def sticker_outline(img, width=9, color=WHITE):
    """Белая обводка вокруг всей фигуры — фирменный признак стикера."""
    alpha = img.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(width * 2 + 1))
    ring = Image.new("RGBA", img.size, color)
    ring.putalpha(grown)
    ring.alpha_composite(img)
    return ring


img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

cake(d, 96 * S, 118 * S, 190 * S, 190 * S)
donut(d, 332 * S, 226 * S, 72 * S)

img = sticker_outline(img, width=9 * S)

# Искры рисуем ПОСЛЕ обводки: попав под неё, они превращались в белые кляксы.
d = ImageDraw.Draw(img)
for x, y, r in [(52, 116, 17), (398, 104, 14), (38, 300, 13), (404, 306, 16), (200, 48, 15)]:
    k = r * 0.2 * S
    X, Y, R = x * S, y * S, r * S
    d.polygon([(X, Y - R), (X + k, Y - k), (X + R, Y), (X + k, Y + k),
               (X, Y + R), (X - k, Y + k), (X - R, Y), (X - k, Y - k)], fill=LIME)
img = img.crop(img.getbbox())
img.resize((img.width // S, img.height // S), Image.LANCZOS).save(OUT)
print("dessert.png", Image.open(OUT).size)
