#!/usr/bin/env python3
"""Аватары-персоны для профиля: 15 плоских иллюстраций людей.

Стиль — flat personas (Notion / avataaars): пастельный круг, голова и плечи,
минимальное лицо. Это не «нарисованный от руки арт», а чистая геометрия —
поэтому программная генерация здесь даёт ровный, профессиональный результат.

Каждая персона — осмысленная комбинация тона кожи, причёски, одежды и
аксессуаров, подобранная вручную (не рандом: рандом даёт двойников и мусор).

Рисуем в 4x и уменьшаем до 240 — края получаются гладкими.
Запуск:  python3 tools/gen-personas.py
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "brand", "personas")
os.makedirs(OUT, exist_ok=True)

S = 4                 # суперсэмплинг
R = 240               # итоговый размер
W = R * S

INK = (23, 19, 15, 255)

# пастельные подложки — спокойные, лайм оставлен двум персонам как акцент
BG = {
    "lime":  (221, 255, 51, 255),
    "cream": (243, 238, 226, 255),
    "peach": (255, 214, 179, 255),
    "sky":   (191, 217, 255, 255),
    "mint":  (203, 239, 211, 255),
    "lilac": (224, 212, 255, 255),
    "sand":  (232, 226, 210, 255),
    "coral": (255, 196, 186, 255),
}

SKIN = {
    "s1": (246, 205, 163, 255),
    "s2": (232, 177, 129, 255),
    "s3": (198, 136, 91, 255),
    "s4": (156, 106, 68, 255),
    "s5": (122, 78, 46, 255),
}

HAIR = {
    "black": (26, 21, 16, 255),
    "brown": (74, 50, 28, 255),
    "chest": (128, 82, 40, 255),
    "blond": (216, 168, 84, 255),
    "grey":  (206, 199, 186, 255),
    "ginger": (188, 84, 38, 255),
}

SHIRT = {
    "ink":   (23, 19, 15, 255),
    "white": (250, 248, 243, 255),
    "lime":  (221, 255, 51, 255),
    "blue":  (58, 92, 160, 255),
    "green": (58, 122, 84, 255),
    "red":   (196, 74, 54, 255),
}


def px(v):  # координаты заданы в сетке 240 — переводим в холст 960
    return v * S


def new_canvas():
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def clip_circle(img):
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, W, W], fill=255)
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def darker(c, k=0.82):
    return (int(c[0] * k), int(c[1] * k), int(c[2] * k), 255)


def draw_person(bg, skin, hair, hairstyle, shirt, acc, beard=None, freckles=False, grin=False):
    img, d = new_canvas()
    d.ellipse([0, 0, W, W], fill=BG[bg])

    cx = px(120)
    head_r = px(52)
    head_cy = px(104)

    # ── волосы сзади (длинные) — рисуются до торса и головы ──
    if hairstyle == "long":
        d.rounded_rectangle([cx - head_r - px(10), head_cy - head_r - px(6),
                             cx + head_r + px(10), px(214)],
                            radius=px(42), fill=HAIR[hair])

    # ── торс ──
    sh = SHIRT[shirt]
    d.rounded_rectangle([px(56), px(168), px(184), px(262)], radius=px(34), fill=sh)
    # ворот
    d.pieslice([cx - px(20), px(160), cx + px(20), px(196)], 0, 180, fill=SKIN[skin])
    if shirt == "ink":
        # маленькая лаймовая молния на груди — фирменная деталь
        d.polygon([(cx + px(2), px(206)), (px(112), px(224)), (px(120), px(224)),
                   (px(112), px(244)), (px(130), px(220)), (px(122), px(220)),
                   (px(128), px(206))], fill=BG["lime"])

    # ── шея и голова ──
    d.rectangle([cx - px(12), px(148), cx + px(12), px(172)], fill=SKIN[skin])
    d.ellipse([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r], fill=SKIN[skin])
    # ушки
    er = px(9)
    for ex in (cx - head_r, cx + head_r):
        d.ellipse([ex - er, head_cy - er, ex + er, head_cy + er], fill=SKIN[skin])

    # ── причёска ──
    hc = HAIR[hair]
    if hairstyle == "short":
        d.pieslice([cx - head_r - px(3), head_cy - head_r - px(6),
                    cx + head_r + px(3), head_cy + head_r], 180, 360, fill=hc)
    elif hairstyle == "fringe":
        d.pieslice([cx - head_r - px(3), head_cy - head_r - px(6),
                    cx + head_r + px(3), head_cy + head_r - px(20)], 180, 360, fill=hc)
        for i, fx in enumerate((-30, -10, 10, 30)):
            rr = px(16 if i % 2 == 0 else 13)
            d.ellipse([cx + px(fx) - rr, head_cy - head_r + px(2) - rr,
                       cx + px(fx) + rr, head_cy - head_r + px(2) + rr], fill=hc)
    elif hairstyle == "curly":
        for fx, fy, rr in ((-38, -34, 17), (-16, -46, 19), (8, -48, 19), (32, -40, 17),
                           (46, -22, 14), (-48, -18, 14)):
            d.ellipse([cx + px(fx) - px(rr), head_cy + px(fy) - px(rr),
                       cx + px(fx) + px(rr), head_cy + px(fy) + px(rr)], fill=hc)
        d.pieslice([cx - head_r - px(2), head_cy - head_r - px(4),
                    cx + head_r + px(2), head_cy + head_r - px(30)], 180, 360, fill=hc)
    elif hairstyle == "bun":
        d.ellipse([cx - px(16), head_cy - head_r - px(26),
                   cx + px(16), head_cy - head_r + px(4)], fill=hc)
        d.pieslice([cx - head_r - px(3), head_cy - head_r - px(6),
                    cx + head_r + px(3), head_cy + head_r - px(16)], 180, 360, fill=hc)
    elif hairstyle == "long":
        d.pieslice([cx - head_r - px(4), head_cy - head_r - px(8),
                    cx + head_r + px(4), head_cy + head_r - px(10)], 180, 360, fill=hc)
    elif hairstyle == "cap":
        d.pieslice([cx - head_r - px(4), head_cy - head_r - px(8),
                    cx + head_r + px(4), head_cy + head_r - px(18)], 180, 360, fill=SHIRT["lime"])
        d.rounded_rectangle([cx - head_r - px(6), head_cy - px(28),
                             cx + px(30), head_cy - px(16)], radius=px(6), fill=darker(SHIRT["lime"], 0.9))
        # козырёк
        d.rounded_rectangle([cx - head_r - px(26), head_cy - px(26),
                             cx - head_r + px(14), head_cy - px(14)], radius=px(7), fill=SHIRT["lime"])
        # молния на тулье
        d.polygon([(cx - px(4), head_cy - px(50)), (cx + px(8), head_cy - px(50)),
                   (cx + px(1), head_cy - px(40)), (cx + px(9), head_cy - px(40)),
                   (cx - px(6), head_cy - px(24)), (cx - px(1), head_cy - px(36)),
                   (cx - px(9), head_cy - px(36))], fill=INK)
    elif hairstyle == "beanie":
        d.pieslice([cx - head_r - px(4), head_cy - head_r - px(10),
                    cx + head_r + px(4), head_cy + head_r - px(14)], 180, 360, fill=SHIRT["red"])
        d.rounded_rectangle([cx - head_r - px(5), head_cy - px(34),
                             cx + head_r + px(5), head_cy - px(20)], radius=px(7),
                            fill=darker(SHIRT["red"], 0.85))
    elif hairstyle == "afro":
        d.ellipse([cx - head_r - px(14), head_cy - head_r - px(26),
                   cx + head_r + px(14), head_cy + px(6)], fill=hc)
        d.ellipse([cx - head_r + px(4), head_cy - head_r + px(2),
                   cx + head_r - px(4), head_cy + head_r], fill=SKIN[skin])
    elif hairstyle == "mohawk":
        d.pieslice([cx - head_r, head_cy - head_r - px(2),
                    cx + head_r, head_cy + head_r - px(34)], 180, 360, fill=darker(SKIN[skin], 0.8))
        for fx, hh in ((-16, 30), (-6, 40), (4, 44), (14, 36)):
            d.rounded_rectangle([cx + px(fx) - px(5), head_cy - head_r - px(hh),
                                 cx + px(fx) + px(5), head_cy - head_r + px(14)],
                                radius=px(4), fill=BG["lime"] if hair == "grey" else HAIR[hair])
    elif hairstyle == "hood":
        d.pieslice([cx - head_r - px(16), head_cy - head_r - px(18),
                    cx + head_r + px(16), head_cy + head_r + px(10)], 160, 380, fill=SHIRT[shirt])
        d.ellipse([cx - head_r + px(6), head_cy - head_r + px(6),
                   cx + head_r - px(6), head_cy + head_r], fill=SKIN[skin])
        d.pieslice([cx - head_r + px(4), head_cy - head_r + px(2),
                    cx + head_r - px(4), head_cy + head_r - px(30)], 180, 360, fill=HAIR[hair])
    elif hairstyle == "braids":
        d.pieslice([cx - head_r - px(3), head_cy - head_r - px(6),
                    cx + head_r + px(3), head_cy + head_r - px(14)], 180, 360, fill=hc)
        for side in (-1, 1):
            bx = cx + side * (head_r + px(6))
            for k in range(3):
                d.ellipse([bx - px(8), head_cy + px(6) + k * px(16),
                           bx + px(8), head_cy + px(22) + k * px(16)], fill=hc)
    elif hairstyle == "buzz":
        d.pieslice([cx - head_r, head_cy - head_r - px(2),
                    cx + head_r, head_cy + head_r - px(34)], 180, 360, fill=darker(SKIN[skin], 0.8))

    # ── лицо ──
    eye_y = head_cy + px(2)
    for ex in (cx - px(20), cx + px(20)):
        d.ellipse([ex - px(4.6), eye_y - px(4.6), ex + px(4.6), eye_y + px(4.6)], fill=INK)
    # брови
    for ex in (cx - px(20), cx + px(20)):
        d.arc([ex - px(9), eye_y - px(20), ex + px(9), eye_y - px(2)], 210, 330, fill=INK, width=px(3))
    # улыбка: дуга или открытая
    if grin:
        d.pieslice([cx - px(14), eye_y + px(8), cx + px(14), eye_y + px(30)], 0, 180, fill=INK)
        d.pieslice([cx - px(9), eye_y + px(16), cx + px(9), eye_y + px(30)], 0, 180, fill=(226, 106, 106, 255))
    else:
        d.arc([cx - px(16), eye_y + px(6), cx + px(16), eye_y + px(30)], 20, 160, fill=INK, width=px(4))
    # румянец
    for ex in (cx - px(34), cx + px(34)):
        d.ellipse([ex - px(6), eye_y + px(8), ex + px(6), eye_y + px(17)],
                  fill=(*darker(SKIN[skin], 0.9)[:3], 110))

    # ── растительность ──
    if beard == "full":
        # борода начинается ниже глаз, рот прорезан узкой дугой — без светлой
        # «маски» поперёк лица
        d.pieslice([cx - head_r + px(4), head_cy - px(2),
                    cx + head_r - px(4), head_cy + head_r + px(10)], 0, 180, fill=HAIR[hair])
        d.pieslice([cx - px(13), head_cy + px(10), cx + px(13), head_cy + px(28)], 0, 360, fill=SKIN[skin])
        d.arc([cx - px(12), head_cy + px(10), cx + px(12), head_cy + px(28)], 20, 160, fill=INK, width=px(4))
    elif beard == "stache":
        d.arc([cx - px(15), head_cy + px(8), cx - px(1), head_cy + px(22)], 180, 330, fill=HAIR[hair], width=px(5))
        d.arc([cx + px(1), head_cy + px(8), cx + px(15), head_cy + px(22)], 210, 360, fill=HAIR[hair], width=px(5))

    # ── аксессуары ──
    if acc == "glasses":
        gr = px(13)
        for ex in (cx - px(20), cx + px(20)):
            d.ellipse([ex - gr, eye_y - gr, ex + gr, eye_y + gr], outline=INK, width=px(3))
        d.line([cx - px(7), eye_y - px(2), cx + px(7), eye_y - px(2)], fill=INK, width=px(3))
    elif acc == "sunglasses":
        gr = px(13)
        for ex in (cx - px(20), cx + px(20)):
            d.ellipse([ex - gr, eye_y - gr, ex + gr, eye_y + gr], fill=INK)
        d.line([cx - px(7), eye_y - px(4), cx + px(7), eye_y - px(4)], fill=INK, width=px(4))
        d.line([cx - px(33), eye_y - px(6), cx - px(44), eye_y - px(10)], fill=INK, width=px(3))
        d.line([cx + px(33), eye_y - px(6), cx + px(44), eye_y - px(10)], fill=INK, width=px(3))
    elif acc == "headphones":
        d.arc([cx - head_r - px(8), head_cy - head_r - px(14),
               cx + head_r + px(8), head_cy + px(20)], 190, 350, fill=INK, width=px(7))
        for ex in (cx - head_r - px(2), cx + head_r + px(2)):
            d.rounded_rectangle([ex - px(9), head_cy - px(12), ex + px(9), head_cy + px(16)],
                                radius=px(7), fill=INK)
            d.rounded_rectangle([ex - px(5), head_cy - px(8), ex + px(5), head_cy + px(12)],
                                radius=px(4), fill=BG["lime"])
    elif acc == "earrings":
        for ex in (cx - head_r, cx + head_r):
            d.ellipse([ex - px(3.4), head_cy + px(10), ex + px(3.4), head_cy + px(17)],
                      fill=(240, 200, 60, 255))
    if freckles:
        for fx, fy in ((-28, 12), (-22, 16), (-32, 18), (28, 12), (22, 16), (32, 18)):
            d.ellipse([cx + px(fx) - px(1.6), eye_y + px(fy) - px(1.6),
                       cx + px(fx) + px(1.6), eye_y + px(fy) + px(1.6)],
                      fill=(*darker(SKIN[skin], 0.75)[:3], 160))

    return clip_circle(img)


# 24 персоны, собраны вручную. p01 — дефолт для всех новых пользователей.
PERSONAS = [
    ("p01", "lime",  "s1", "brown",  "short",  "ink",   None,        None,    False, False),
    ("p02", "sky",   "s1", "chest",  "long",   "white", "earrings",  None,    False, False),
    ("p03", "peach", "s4", "black",  "curly",  "lime",  None,        None,    False, True),
    ("p04", "mint",  "s3", "black",  "cap",    "ink",   None,        None,    False, False),
    ("p05", "lilac", "s1", "blond",  "bun",    "green", None,        None,    True,  False),
    ("p06", "cream", "s5", "black",  "afro",   "blue",  None,        None,    False, True),
    ("p07", "coral", "s2", "brown",  "fringe", "white", "glasses",   None,    False, False),
    ("p08", "sand",  "s3", "black",  "buzz",   "red",   None,        "full",  False, False),
    ("p09", "sky",   "s2", "ginger", "curly",  "white", None,        None,    True,  False),
    ("p10", "mint",  "s1", "brown",  "short",  "blue",  "sunglasses",None,    False, False),
    ("p11", "peach", "s5", "black",  "bun",    "white", "earrings",  None,    False, False),
    ("p12", "lilac", "s3", "brown",  "beanie", "ink",   None,        "stache",False, False),
    ("p13", "cream", "s2", "black",  "long",   "red",   None,        None,    False, True),
    ("p14", "coral", "s4", "black",  "short",  "lime",  "glasses",   None,    False, False),
    ("p15", "lime",  "s1", "grey",   "mohawk", "ink",   None,        None,    False, True),
    ("p16", "sky",   "s3", "black",  "hood",   "ink",   None,        None,    False, False),
    ("p17", "mint",  "s2", "brown",  "short",  "white", "headphones",None,    False, False),
    ("p18", "peach", "s1", "blond",  "braids", "lime",  None,        None,    True,  True),
    ("p19", "cream", "s4", "black",  "mohawk", "red",   "sunglasses",None,    False, False),
    ("p20", "lilac", "s2", "black",  "hood",   "blue",  None,        "stache",False, False),
    ("p21", "sand",  "s1", "ginger", "short",  "green", None,        "full",  True,  False),
    ("p22", "coral", "s3", "black",  "braids", "white", "earrings",  None,    False, False),
    ("p23", "sky",   "s5", "black",  "buzz",   "lime",  "headphones",None,    False, True),
    ("p24", "cream", "s2", "brown",  "cap",    "white", "sunglasses",None,    False, False),
]

for key, bg, skin, hair, style, shirt, acc, beard, freck, grin in PERSONAS:
    img = draw_person(bg, skin, hair, style, shirt, acc, beard, freck, grin)
    img = img.resize((R, R), Image.LANCZOS)
    img.save(os.path.join(OUT, f"{key}.png"))
    print(key, bg, style, shirt, acc or "-", beard or "-")
print("готово:", len(PERSONAS))
