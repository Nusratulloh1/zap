#!/usr/bin/env python3
"""Локализованные варианты стикеров с вшитым текстом.

Три стикера набраны по-узбекски прямо в картинке: «Bir chek. Bir guruh. Oson.»,
«Skanerla. Bo'ling. Tayyor!» и «Hisob bo'lindi!». В ru/en интерфейсе они
читались как чужой язык посреди своего экрана.

Ключевой момент — как затирается старый текст. Прямоугольная заливка не
годится: она вылезает за чёрный контур облачка и корпус телефона, и стикер
выглядит сломанным. Поэтому фон восстанавливается по маске: берём пиксели
подложки (белые, а где надо и лаймовые) и морфологически «закрываем» дырки от
букв. Контур при этом остаётся нетронутым, потому что он в маску не попадает.

Запуск:  python3 tools/gen-sticker-locales.py
"""
import os

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, "assets", "stickers")
FONT = os.path.join(ROOT, "assets", "fonts", "Manrope-ExtraBold.ttf")

LIME = (205, 245, 40, 255)
INK = (17, 17, 16, 255)
WHITE = (255, 255, 255, 255)

# Рисуем на увеличенном холсте и уменьшаем обратно: текст получается
# сглаженным, а не ступенчатым, как при рисовании 1:1.
K = 4


def interior_mask(base, box):
    """Маска подложки внутри box: где можно затирать, не тронув контур.

    Идём построчно и заливаем промежуток между крайними «светлыми» пикселями
    строки. Дырки от букв закрываются сами: буква всегда окружена подложкой
    слева и справа.

    Морфологическое закрытие для этого не годится — ядро, достаточное чтобы
    съесть жирный штрих буквы, «перепрыгивает» четырёхпиксельный контур
    облачка, и заливка уезжает наружу, на руку и на хвостик. А box берём
    заведомо внутри контура, чтобы крайним светлым пикселем строки не
    оказалась внешняя белая обводка стикера.
    """
    x, y, w, h = box
    m = Image.new("L", base.size, 0)
    px, mp = base.load(), m.load()
    for yy in range(y, min(y + h, base.height)):
        xs = [
            xx
            for xx in range(x, min(x + w, base.width))
            if px[xx, yy][3] > 200
            and (
                (px[xx, yy][0] > 196 and px[xx, yy][1] > 196 and px[xx, yy][2] > 196)
                or (px[xx, yy][1] > 150 and px[xx, yy][2] < 145 and px[xx, yy][1] > px[xx, yy][0] + 10)
            )
        ]
        if not xs:
            continue
        for xx in range(min(xs), max(xs) + 1):
            mp[xx, yy] = 255
    return m


def fitted(draw, text, box_w, start):
    size = start
    while size > 8:
        f = ImageFont.truetype(FONT, size)
        if draw.textlength(text, font=f) <= box_w:
            return f
        size -= 1
    return ImageFont.truetype(FONT, 8)


def render(src, dst, lines, box, size, pill, angle=0.0, align="left"):
    base = Image.open(os.path.join(S, src)).convert("RGBA")

    # 1. стираем старый текст по маске подложки
    mask = interior_mask(base, box)
    big = base.resize((base.width * K, base.height * K), Image.LANCZOS)
    big.paste(
        Image.new("RGBA", big.size, WHITE),
        (0, 0),
        mask.resize(big.size, Image.LANCZOS),
    )

    # 2. рисуем новый текст отдельным слоем и наклоняем его как подложку
    x, y, w, h = [v * K for v in box]
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # Кегль один на все строки: разнокалиберный текст в одном облачке
    # сразу выдаёт машинную подстановку.
    step = h / len(lines)
    f = min((fitted(d, t, w - 8 * K, size * K) for t in lines), key=lambda x: x.size)
    for i, t in enumerate(lines):
        tw = d.textlength(t, font=f)
        cy = step * i
        tx = 0 if align == "left" else (w - tw) / 2
        if pill is not None and i == pill:
            pad = 7 * K
            d.rounded_rectangle(
                [tx - pad, cy + 2 * K, tx + tw + pad, cy + step - 3 * K],
                radius=step / 2.6, fill=LIME,
            )
        top = f.getbbox(t)[1]
        d.text((tx, cy + (step - f.size) / 2 - top / 2), t, font=f, fill=INK)

    if angle:
        layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
        x -= (layer.width - w) // 2
        y -= (layer.height - h) // 2

    # Текст и плашку тоже ограничиваем маской подложки: облачко сужается
    # книзу, и плашка последней строки иначе вылезает за контур на хвостик.
    full = Image.new("RGBA", big.size, (0, 0, 0, 0))
    full.alpha_composite(layer, (x, y))
    full.putalpha(ImageChops.multiply(full.getchannel("A"), mask.resize(big.size, Image.LANCZOS)))
    big.alpha_composite(full)

    big.resize(base.size, Image.LANCZOS).save(os.path.join(S, dst))
    print("  ", dst)


JOBS = [
    # «Bir chek. Bir guruh. Oson.» — облачко, третья строка на лаймовой плашке
    dict(src="one-bill.png", box=(18, 16, 148, 130), size=34, pill=2,
         angle=0.0, align="left",
         text={"ru": ["Один чек.", "Вся компания.", "Просто."],
               "en": ["One bill.", "One crew.", "Easy."]}),
    # «Skanerla. Bo'ling. Tayyor!» — текст справа от колонки иконок
    dict(src="how-it-works.png", box=(76, 20, 128, 138), size=33, pill=2,
         angle=-4.0, align="left",
         text={"ru": ["Сканируй.", "Дели.", "Готово!"],
               "en": ["Scan.", "Split.", "Done!"]}),
    # «Hisob bo'lindi!» — белая часть экрана; лайм в маску НЕ берём, иначе
    # затрётся верхняя зелёная половина экрана с галочкой
    dict(src="bill-done.png", box=(40, 120, 82, 80), size=30, pill=None,
         angle=-6.0, align="center",
         text={"ru": ["Счёт", "разделён!"],
               "en": ["Bill", "split!"]}),
]

for job in JOBS:
    print(job["src"])
    for loc, lines in job["text"].items():
        render(job["src"], job["src"].replace(".png", f".{loc}.png"), lines,
               job["box"], job["size"], job["pill"], job["angle"], job["align"])
