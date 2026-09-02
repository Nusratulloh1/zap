#!/usr/bin/env python3
"""Аватары-персоны: 24 объёмные (clay/3D) иллюстрации людей.

Прошлая версия была плоской заливкой — руководство просило вид Meta-аватаров.
Объём здесь делается светом, а не полигонами: под каждую форму подкладывается
размытое светлое пятно сверху-слева и тёмное снизу-справа, обрезанные маской
самой формы. Плюс градиентный фон, блик в глазу, мягкая тень головы на плечи.

Рисуем в 4x и уменьшаем — края получаются гладкими.
Запуск:  python3 tools/gen-personas.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "brand", "personas")
os.makedirs(OUT, exist_ok=True)

S = 4                 # суперсэмплинг
R = 240               # итоговый размер
W = R * S

INK = (23, 19, 15, 255)

# фон — пара цветов для вертикального градиента
BG = {
    "lime":  ((228, 255, 92), (186, 224, 40)),
    "cream": ((248, 244, 234), (226, 219, 202)),
    "peach": ((255, 224, 196), (247, 190, 148)),
    "sky":   ((205, 228, 255), (160, 196, 246)),
    "mint":  ((214, 245, 224), (170, 219, 187)),
    "lilac": ((233, 223, 255), (198, 180, 245)),
    "sand":  ((238, 232, 217), (214, 205, 184)),
    "coral": ((255, 208, 199), (250, 168, 158)),
}

SKIN = {
    "s1": (247, 209, 172),
    "s2": (233, 181, 137),
    "s3": (199, 140, 96),
    "s4": (158, 108, 71),
    "s5": (124, 80, 49),
}

HAIR = {
    "black": (32, 26, 22),
    "brown": (82, 55, 32),
    "chest": (134, 88, 45),
    "blond": (219, 174, 92),
    "grey":  (208, 202, 190),
    "ginger": (192, 90, 42),
}

SHIRT = {
    "ink":   (30, 26, 22),
    "white": (250, 248, 243),
    "lime":  (221, 255, 51),
    "blue":  (64, 100, 172),
    "green": (64, 130, 92),
    "red":   (202, 80, 60),
}

EYE = (54, 40, 30)


def px(v):
    return int(v * S)


def new_layer():
    return Image.new("RGBA", (W, W), (0, 0, 0, 0))


def darker(c, k=0.8):
    return (int(c[0] * k), int(c[1] * k), int(c[2] * k))


def lighter(c, k=0.25):
    return (
        int(c[0] + (255 - c[0]) * k),
        int(c[1] + (255 - c[1]) * k),
        int(c[2] + (255 - c[2]) * k),
    )


def shade(target, mask, dx_light, dy_light, dx_dark, dy_dark, light=90, dark=95, blur=26):
    """Объём: размытый блик и тень, обрезанные маской формы."""
    # Серп появляется ТАМ, ГДЕ маска есть, а сдвинутая копия — нет, то есть с
    # противоположной сдвигу стороны. Поэтому для блика сдвигаем маску вниз-
    # вправо, для тени — вверх-влево (иначе свет ложится снизу, как в подвале).
    for dx, dy, col, a in ((-dx_light, -dy_light, (255, 255, 255), light),
                           (-dx_dark, -dy_dark, (0, 0, 0), dark)):
        lay = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        m = mask.copy()
        # смещаем маску и вычитаем исходную — получаем «серп» света или тени
        shifted = Image.new("L", (W, W), 0)
        shifted.paste(m, (px(dx), px(dy)))
        sub = Image.new("L", (W, W), 0)
        sub.paste(
            Image.eval(shifted, lambda v: v),
            (0, 0),
        )
        band = Image.new("L", (W, W), 0)
        band.paste(m, (0, 0))
        # свет: часть формы, не покрытая сдвинутой копией в обратную сторону
        inv = Image.eval(sub, lambda v: 255 - v)
        crescent = Image.new("L", (W, W), 0)
        crescent.paste(inv, (0, 0), band)
        crescent = crescent.filter(ImageFilter.GaussianBlur(px(blur / S)))
        crescent = Image.eval(crescent, lambda v: int(v * a / 255))
        solid = Image.new("RGBA", (W, W), (*col, 255))
        lay.paste(solid, (0, 0), crescent)
        # ещё раз обрезаем строго по форме
        out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        out.paste(lay, (0, 0), band)
        target.alpha_composite(out)


def mask_of(draw_fn):
    m = Image.new("L", (W, W), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def gradient_circle(c_top, c_bot):
    """Фон-круг с вертикальным градиентом."""
    grad = Image.new("RGBA", (W, W))
    d = ImageDraw.Draw(grad)
    for y in range(W):
        t = y / (W - 1)
        d.line(
            [(0, y), (W, y)],
            fill=(
                int(c_top[0] + (c_bot[0] - c_top[0]) * t),
                int(c_top[1] + (c_bot[1] - c_top[1]) * t),
                int(c_top[2] + (c_bot[2] - c_top[2]) * t),
                255,
            ),
        )
    circle = Image.new("L", (W, W), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, W - 1, W - 1], fill=255)
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out.paste(grad, (0, 0), circle)
    return out


def draw_person(bg, skin, hair, hairstyle, shirt, acc, beard=None, freckles=False, grin=False):
    img = gradient_circle(*BG[bg])

    cx = px(120)
    head_r = px(53)
    head_cy = px(100)
    sk = SKIN[skin]
    hc = HAIR[hair]
    sh = SHIRT[shirt]

    # ── длинные волосы за спиной ──
    if hairstyle in ("long", "braids"):
        back = new_layer()
        ImageDraw.Draw(back).rounded_rectangle(
            [cx - head_r - px(14), head_cy - head_r, cx + head_r + px(14), px(226)],
            radius=px(46), fill=(*darker(hc, 0.82), 255))
        img.alpha_composite(back)

    # ── торс ──
    torso_box = [px(50), px(166), px(190), px(266)]
    torso_mask = mask_of(lambda d: d.rounded_rectangle(torso_box, radius=px(38), fill=255))
    torso = new_layer()
    ImageDraw.Draw(torso).rounded_rectangle(torso_box, radius=px(38), fill=(*sh, 255))
    shade(torso, torso_mask, -10, -8, 12, 10, light=70, dark=80, blur=30)
    img.alpha_composite(torso)

    # ворот
    collar = new_layer()
    ImageDraw.Draw(collar).pieslice(
        [cx - px(22), px(156), cx + px(22), px(196)], 0, 180, fill=(*darker(sk, 0.9), 255))
    img.alpha_composite(collar)

    if shirt == "ink":
        bolt = new_layer()
        ImageDraw.Draw(bolt).polygon(
            [(cx + px(2), px(204)), (px(112), px(222)), (px(120), px(222)),
             (px(112), px(242)), (px(130), px(218)), (px(122), px(218)),
             (px(128), px(204))], fill=(221, 255, 51, 255))
        img.alpha_composite(bolt)

    # ── шея с тенью от головы ──
    neck_box = [cx - px(14), px(142), cx + px(14), px(176)]
    neck = new_layer()
    ImageDraw.Draw(neck).rounded_rectangle(neck_box, radius=px(10), fill=(*darker(sk, 0.86), 255))
    img.alpha_composite(neck)

    # ── уши ──
    ears = new_layer()
    de = ImageDraw.Draw(ears)
    for ex in (cx - head_r + px(2), cx + head_r - px(2)):
        de.ellipse([ex - px(10), head_cy - px(6), ex + px(10), head_cy + px(16)], fill=(*sk, 255))
    img.alpha_composite(ears)

    # ── голова ──
    head_box = [cx - head_r, head_cy - head_r - px(4), cx + head_r, head_cy + head_r + px(6)]
    head_mask = mask_of(lambda d: d.ellipse(head_box, fill=255))
    head = new_layer()
    ImageDraw.Draw(head).ellipse(head_box, fill=(*sk, 255))
    shade(head, head_mask, -13, -12, 14, 13, light=105, dark=88, blur=24)
    img.alpha_composite(head)

    eye_y = head_cy + px(4)

    # румянец
    blush = new_layer()
    db = ImageDraw.Draw(blush)
    for ex in (cx - px(33), cx + px(33)):
        db.ellipse([ex - px(11), eye_y + px(8), ex + px(11), eye_y + px(22)],
                   fill=(*darker(sk, 0.86), 120))
    img.alpha_composite(blush.filter(ImageFilter.GaussianBlur(px(3))))

    if freckles:
        fr = new_layer()
        dfr = ImageDraw.Draw(fr)
        for fx, fy in ((-28, 12), (-22, 16), (-33, 18), (28, 12), (22, 16), (33, 18)):
            dfr.ellipse([cx + px(fx) - px(2), eye_y + px(fy) - px(2),
                         cx + px(fx) + px(2), eye_y + px(fy) + px(2)],
                        fill=(*darker(sk, 0.7), 150))
        img.alpha_composite(fr)

    # ── причёска ──
    hair_lay = new_layer()
    dh = ImageDraw.Draw(hair_lay)

    def cap_shape(d, lift=0, fill=None, temples=True):
        col = fill or (*hc, 255)
        d.pieslice([cx - head_r - px(3), head_cy - head_r - px(8),
                    cx + head_r + px(3), head_cy + head_r - px(lift)], 180, 360, fill=col)
        if temples:
            # без них срез волос читается как повязка на лбу
            for side in (-1, 1):
                tx = cx + side * (head_r - px(6))
                d.ellipse([tx - px(13), head_cy - px(26), tx + px(13), head_cy + px(18)], fill=col)

    if hairstyle == "short":
        cap_shape(dh, 30)
    elif hairstyle == "fringe":
        cap_shape(dh, 30)
        for i, fx in enumerate((-32, -12, 10, 30)):
            rr = px(17 if i % 2 == 0 else 14)
            dh.ellipse([cx + px(fx) - rr, head_cy - head_r - px(2) - rr,
                        cx + px(fx) + rr, head_cy - head_r - px(2) + rr], fill=(*hc, 255))
    elif hairstyle == "curly":
        for fx, fy, rr in ((-40, -34, 18), (-17, -47, 20), (9, -49, 20), (33, -41, 18),
                           (48, -22, 15), (-49, -18, 15)):
            dh.ellipse([cx + px(fx) - px(rr), head_cy + px(fy) - px(rr),
                        cx + px(fx) + px(rr), head_cy + px(fy) + px(rr)], fill=(*hc, 255))
        cap_shape(dh, 34)
    elif hairstyle == "bun":
        dh.ellipse([cx - px(18), head_cy - head_r - px(30), cx + px(18), head_cy - head_r + px(4)],
                   fill=(*hc, 255))
        cap_shape(dh, 26)
    elif hairstyle in ("long", "braids"):
        cap_shape(dh, 22)
        if hairstyle == "braids":
            for side in (-1, 1):
                bx = cx + side * (head_r + px(10))
                for k in range(3):
                    dh.ellipse([bx - px(10), head_cy + px(6) + k * px(18),
                                bx + px(10), head_cy + px(24) + k * px(18)], fill=(*hc, 255))
    elif hairstyle == "afro":
        dh.ellipse([cx - head_r - px(16), head_cy - head_r - px(28),
                    cx + head_r + px(16), head_cy + px(8)], fill=(*hc, 255))
    elif hairstyle == "buzz":
        cap_shape(dh, 40, fill=(*darker(sk, 0.78), 255), temples=False)
    elif hairstyle == "mohawk":
        cap_shape(dh, 40, fill=(*darker(sk, 0.78), 255), temples=False)
        for fx, hh in ((-16, 30), (-6, 42), (5, 46), (16, 36)):
            dh.rounded_rectangle([cx + px(fx) - px(6), head_cy - head_r - px(hh),
                                  cx + px(fx) + px(6), head_cy - head_r + px(16)],
                                 radius=px(5), fill=(*hc, 255))

    if hairstyle == "afro":
        # лицо поверх шапки волос
        face = new_layer()
        ImageDraw.Draw(face).ellipse(
            [cx - head_r + px(5), head_cy - head_r + px(3),
             cx + head_r - px(5), head_cy + head_r + px(6)], fill=(*sk, 255))
        hair_lay.alpha_composite(face)

    if hairstyle not in ("cap", "beanie", "hood"):
        hm = hair_lay.split()[3]
        shade(hair_lay, hm, -12, -11, 12, 12, light=95, dark=70, blur=22)
        img.alpha_composite(hair_lay)

    # головные уборы рисуем после лица — ниже

    # ── глаза ──
    eyes = new_layer()
    de = ImageDraw.Draw(eyes)
    for ex in (cx - px(20), cx + px(20)):
        de.ellipse([ex - px(8), eye_y - px(8), ex + px(8), eye_y + px(8)], fill=(255, 255, 255, 255))
        de.ellipse([ex - px(6), eye_y - px(5), ex + px(6), eye_y + px(7)], fill=(*EYE, 255))
        de.ellipse([ex - px(3), eye_y - px(1), ex + px(3), eye_y + px(5)], fill=(12, 10, 8, 255))
        # блик — от него взгляд «живой»
        de.ellipse([ex - px(5), eye_y - px(5), ex - px(1), eye_y - px(1)], fill=(255, 255, 255, 235))
    # брови
    for ex in (cx - px(20), cx + px(20)):
        de.arc([ex - px(11), eye_y - px(24), ex + px(11), eye_y - px(4)], 205, 335,
               fill=(*darker(hc, 0.8), 255), width=px(4))
    img.alpha_composite(eyes)

    # нос — мягкая тень
    nose = new_layer()
    ImageDraw.Draw(nose).arc([cx - px(6), eye_y + px(4), cx + px(7), eye_y + px(16)],
                             300, 60, fill=(*darker(sk, 0.72), 190), width=px(3))
    img.alpha_composite(nose.filter(ImageFilter.GaussianBlur(px(0.8))))

    # ── рот ──
    mouth = new_layer()
    dm = ImageDraw.Draw(mouth)
    if grin:
        dm.pieslice([cx - px(15), eye_y + px(10), cx + px(15), eye_y + px(32)], 0, 180,
                    fill=(78, 42, 40, 255))
        dm.pieslice([cx - px(13), eye_y + px(11), cx + px(13), eye_y + px(20)], 0, 180,
                    fill=(255, 252, 248, 255))
    else:
        dm.arc([cx - px(16), eye_y + px(8), cx + px(16), eye_y + px(30)], 20, 160,
               fill=(96, 52, 44, 255), width=px(4))
    img.alpha_composite(mouth)

    # ── борода/усы ──
    if beard == "full":
        b = new_layer()
        dbd = ImageDraw.Draw(b)
        dbd.pieslice([cx - head_r + px(4), head_cy - px(4),
                      cx + head_r - px(4), head_cy + head_r + px(14)], 0, 180, fill=(*hc, 255))
        dbd.pieslice([cx - px(14), eye_y + px(8), cx + px(14), eye_y + px(30)], 0, 180,
                     fill=(*sk, 255))
        dbd.arc([cx - px(14), eye_y + px(8), cx + px(14), eye_y + px(30)], 20, 160,
                fill=(96, 52, 44, 255), width=px(4))
        bm = b.split()[3]
        shade(b, bm, -8, -8, 9, 9, light=60, dark=60, blur=16)
        img.alpha_composite(b)
    elif beard == "stache":
        b = new_layer()
        dbd = ImageDraw.Draw(b)
        dbd.arc([cx - px(16), eye_y + px(2), cx - px(1), eye_y + px(18)], 175, 330,
                fill=(*hc, 255), width=px(6))
        dbd.arc([cx + px(1), eye_y + px(2), cx + px(16), eye_y + px(18)], 210, 5,
                fill=(*hc, 255), width=px(6))
        img.alpha_composite(b)

    # ── головные уборы ──
    if hairstyle == "cap":
        cap = new_layer()
        dc = ImageDraw.Draw(cap)
        dc.pieslice([cx - head_r - px(5), head_cy - head_r - px(12),
                     cx + head_r + px(5), head_cy + head_r - px(18)], 180, 360,
                    fill=(221, 255, 51, 255))
        dc.rounded_rectangle([cx - head_r - px(28), head_cy - px(28),
                              cx - head_r + px(16), head_cy - px(14)], radius=px(7),
                             fill=(206, 240, 40, 255))
        dc.polygon([(cx - px(4), head_cy - px(52)), (cx + px(9), head_cy - px(52)),
                    (cx + px(1), head_cy - px(40)), (cx + px(10), head_cy - px(40)),
                    (cx - px(7), head_cy - px(22)), (cx - px(1), head_cy - px(36)),
                    (cx - px(10), head_cy - px(36))], fill=INK)
        cm = cap.split()[3]
        shade(cap, cm, -10, -9, 11, 10, light=80, dark=70, blur=20)
        img.alpha_composite(cap)
    elif hairstyle == "beanie":
        bn = new_layer()
        dbn = ImageDraw.Draw(bn)
        dbn.pieslice([cx - head_r - px(5), head_cy - head_r - px(14),
                      cx + head_r + px(5), head_cy + head_r - px(14)], 180, 360,
                     fill=(*SHIRT["red"], 255))
        dbn.rounded_rectangle([cx - head_r - px(6), head_cy - px(36),
                               cx + head_r + px(6), head_cy - px(20)], radius=px(8),
                              fill=(*darker(SHIRT["red"], 0.82), 255))
        bm = bn.split()[3]
        shade(bn, bm, -10, -9, 11, 10, light=80, dark=70, blur=20)
        img.alpha_composite(bn)
    elif hairstyle == "hood":
        hd = new_layer()
        dhd = ImageDraw.Draw(hd)
        dhd.pieslice([cx - head_r - px(20), head_cy - head_r - px(20),
                      cx + head_r + px(20), head_cy + head_r + px(14)], 158, 382, fill=(*sh, 255))
        dhd.ellipse([cx - head_r + px(4), head_cy - head_r + px(2),
                     cx + head_r - px(4), head_cy + head_r + px(6)], fill=(0, 0, 0, 0))
        hm = hd.split()[3]
        shade(hd, hm, -12, -10, 12, 11, light=70, dark=80, blur=24)
        img.alpha_composite(hd)

    # ── аксессуары ──
    acc_lay = new_layer()
    da = ImageDraw.Draw(acc_lay)
    if acc == "glasses":
        gr = px(15)
        for ex in (cx - px(21), cx + px(21)):
            da.ellipse([ex - gr, eye_y - gr, ex + gr, eye_y + gr], fill=(255, 255, 255, 38))
            da.ellipse([ex - gr, eye_y - gr, ex + gr, eye_y + gr], outline=INK, width=px(3))
        da.line([cx - px(7), eye_y - px(2), cx + px(7), eye_y - px(2)], fill=INK, width=px(3))
    elif acc == "sunglasses":
        gr = px(15)
        for ex in (cx - px(21), cx + px(21)):
            da.ellipse([ex - gr, eye_y - gr, ex + gr, eye_y + gr], fill=(26, 22, 20, 255))
            da.ellipse([ex - gr + px(3), eye_y - gr + px(3), ex - px(2), eye_y - px(4)],
                       fill=(255, 255, 255, 60))
        da.line([cx - px(7), eye_y - px(4), cx + px(7), eye_y - px(4)], fill=INK, width=px(4))
        da.line([cx - px(36), eye_y - px(6), cx - px(48), eye_y - px(10)], fill=INK, width=px(4))
        da.line([cx + px(36), eye_y - px(6), cx + px(48), eye_y - px(10)], fill=INK, width=px(4))
    elif acc == "headphones":
        da.arc([cx - head_r - px(12), head_cy - head_r - px(20),
                cx + head_r + px(12), head_cy + px(22)], 188, 352, fill=INK, width=px(9))
        for ex in (cx - head_r - px(4), cx + head_r + px(4)):
            da.rounded_rectangle([ex - px(11), head_cy - px(14), ex + px(11), head_cy + px(18)],
                                 radius=px(9), fill=INK)
            da.rounded_rectangle([ex - px(6), head_cy - px(9), ex + px(6), head_cy + px(13)],
                                 radius=px(5), fill=(221, 255, 51, 255))
    elif acc == "earrings":
        for ex in (cx - head_r + px(1), cx + head_r - px(1)):
            da.ellipse([ex - px(4), head_cy + px(14), ex + px(4), head_cy + px(22)],
                       fill=(242, 202, 68, 255))
            da.ellipse([ex - px(2), head_cy + px(15), ex + px(1), head_cy + px(18)],
                       fill=(255, 246, 210, 220))
    img.alpha_composite(acc_lay)

    # ── общая мягкая виньетка: круг выглядит объёмным ──
    vig = new_layer()
    ImageDraw.Draw(vig).ellipse([px(6), px(6), W - px(6), W - px(6)], outline=(0, 0, 0, 46),
                                width=px(10))
    img.alpha_composite(vig.filter(ImageFilter.GaussianBlur(px(6))))

    # финальная обрезка по кругу
    circle = Image.new("L", (W, W), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, W - 1, W - 1], fill=255)
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out.paste(img, (0, 0), circle)
    return out


# 24 персоны. p01 — дефолт для всех новых пользователей.
PERSONAS = [
    ("p01", "lime",  "s1", "brown",  "short",  "ink",   None,         None,     False, False),
    ("p02", "sky",   "s1", "chest",  "long",   "white", "earrings",   None,     False, False),
    ("p03", "peach", "s4", "black",  "curly",  "lime",  None,         None,     False, True),
    ("p04", "mint",  "s3", "black",  "cap",    "ink",   None,         None,     False, False),
    ("p05", "lilac", "s1", "blond",  "bun",    "green", None,         None,     True,  False),
    ("p06", "cream", "s5", "black",  "afro",   "blue",  None,         None,     False, True),
    ("p07", "coral", "s2", "brown",  "fringe", "white", "glasses",    None,     False, False),
    ("p08", "sand",  "s3", "black",  "buzz",   "red",   None,         "full",   False, False),
    ("p09", "sky",   "s2", "ginger", "curly",  "white", None,         None,     True,  False),
    ("p10", "mint",  "s1", "brown",  "short",  "blue",  "sunglasses", None,     False, False),
    ("p11", "peach", "s5", "black",  "bun",    "white", "earrings",   None,     False, False),
    ("p12", "lilac", "s3", "brown",  "beanie", "ink",   None,         "stache", False, False),
    ("p13", "cream", "s2", "black",  "long",   "red",   None,         None,     False, True),
    ("p14", "coral", "s4", "black",  "short",  "lime",  "glasses",    None,     False, False),
    ("p15", "lime",  "s1", "grey",   "mohawk", "ink",   None,         None,     False, True),
    ("p16", "sky",   "s3", "black",  "hood",   "ink",   None,         None,     False, False),
    ("p17", "mint",  "s2", "brown",  "short",  "white", "headphones", None,     False, False),
    ("p18", "peach", "s1", "blond",  "braids", "lime",  None,         None,     True,  True),
    ("p19", "cream", "s4", "black",  "mohawk", "red",   "sunglasses", None,     False, False),
    ("p20", "lilac", "s2", "black",  "hood",   "blue",  None,         "stache", False, False),
    ("p21", "sand",  "s1", "ginger", "short",  "green", None,         "full",   True,  False),
    ("p22", "coral", "s3", "black",  "braids", "white", "earrings",   None,     False, False),
    ("p23", "sky",   "s5", "black",  "buzz",   "lime",  "headphones", None,     False, True),
    ("p24", "cream", "s2", "brown",  "cap",    "white", "sunglasses", None,     False, False),
]

for key, bg, skin, hair, style, shirt, acc, beard, freck, grin in PERSONAS:
    im = draw_person(bg, skin, hair, style, shirt, acc, beard, freck, grin)
    im = im.resize((R, R), Image.LANCZOS)
    im.save(os.path.join(OUT, f"{key}.png"))
    print(key, bg, style, shirt, acc or "-", beard or "-")
print("готово:", len(PERSONAS))
