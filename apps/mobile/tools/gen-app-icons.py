#!/usr/bin/env python3
"""
Раскладывает три мастер-иконки (assets/app-icons/*.png, 1024×1024, full-bleed,
без альфы) по обеим платформам.

  receipts — основная («чеки»), mosaic и hands — альтернативные.

iOS: по .appiconset на каждую иконку. Альтернативные подхватываются через
CFBundleAlternateIcons в Info.plist + ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS.

Android: legacy-квадрат (ic_launcher) + круг (ic_launcher_round) + adaptive
(foreground вписан в safe zone 66/108, фон — лайм). Мастера нарисованы как
скруглённый квадрат целиком, поэтому в adaptive их нельзя класть во всю
площадь: круглая маска срезала бы углы вместе с частью логотипа.

Запуск: python3 tools/gen-app-icons.py
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "app-icons")
IOS_ASSETS = os.path.join(ROOT, "ios", "ZapMobile", "Images.xcassets")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# ключ -> (файл мастера, имя .appiconset, префикс android-ресурса)
ICONS = {
    "receipts": ("receipts.png", "AppIcon", "ic_launcher"),
    "mosaic": ("mosaic.png", "IconMosaic", "ic_launcher_mosaic"),
    "hands": ("hands.png", "IconHands", "ic_launcher_hands"),
}

# iPhone: 20/29/40/60 pt в @2x и @3x + 1024 для App Store
IOS_SIZES = [
    (20, 2), (20, 3), (29, 2), (29, 3),
    (40, 2), (40, 3), (60, 2), (60, 3),
]
# mdpi базовый 48dp, adaptive foreground — 108dp
ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def load(name: str) -> Image.Image:
    return Image.open(os.path.join(SRC, name)).convert("RGB")


def lime_of(im: Image.Image):
    """Фоновый лайм мастера — берём из точки на левом крае, вне арта."""
    return im.getpixel((6, im.height // 2))


def gen_ios(master: Image.Image, setname: str) -> None:
    out = os.path.join(IOS_ASSETS, f"{setname}.appiconset")
    os.makedirs(out, exist_ok=True)
    images = []
    for pt, scale in IOS_SIZES:
        px = pt * scale
        fn = f"icon-{pt}@{scale}x.png"
        master.resize((px, px), Image.LANCZOS).save(os.path.join(out, fn))
        images.append({"filename": fn, "idiom": "iphone", "scale": f"{scale}x", "size": f"{pt}x{pt}"})
    master.resize((1024, 1024), Image.LANCZOS).save(os.path.join(out, "icon-1024.png"))
    images.append({"filename": "icon-1024.png", "idiom": "ios-marketing", "scale": "1x", "size": "1024x1024"})
    with open(os.path.join(out, "Contents.json"), "w") as f:
        json.dump({"images": images, "info": {"author": "xcode", "version": 1}}, f, indent=2)
        f.write("\n")


def gen_android(master: Image.Image, prefix: str) -> None:
    lime = lime_of(master)
    for dens, mult in ANDROID_DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{dens}")
        os.makedirs(d, exist_ok=True)
        legacy = int(48 * mult)
        sq = master.resize((legacy, legacy), Image.LANCZOS)
        sq.save(os.path.join(d, f"{prefix}.png"))
        # round: та же картинка под круглой маской (сглаживание — через 4× холст)
        from PIL import ImageDraw
        mask = Image.new("L", (legacy * 4, legacy * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, legacy * 4 - 1, legacy * 4 - 1), fill=255)
        mask = mask.resize((legacy, legacy), Image.LANCZOS)
        rgba = sq.convert("RGBA")
        rgba.putalpha(mask)
        rgba.save(os.path.join(d, f"{prefix}_round.png"))
        # adaptive foreground: 108dp холст, арт вписан в safe zone 66dp
        fg_px = int(108 * mult)
        art_px = int(66 * mult)
        fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
        art = master.resize((art_px, art_px), Image.LANCZOS)
        fg.paste(art, ((fg_px - art_px) // 2, (fg_px - art_px) // 2))
        fg.save(os.path.join(d, f"{prefix}_foreground.png"))

    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        f'    <background android:drawable="@color/{prefix}_background"/>\n'
        f'    <foreground android:drawable="@mipmap/{prefix}_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    for suffix in ("", "_round"):
        with open(os.path.join(anydpi, f"{prefix}{suffix}.xml"), "w") as f:
            f.write(xml)
    return "#%02X%02X%02X" % lime


def main() -> None:
    colors = {}
    for key, (fname, setname, prefix) in ICONS.items():
        master = load(fname)
        gen_ios(master, setname)
        colors[prefix] = gen_android(master, prefix)
        print(f"{key:9} -> ios/{setname}.appiconset, android/{prefix}*  bg={colors[prefix]}")

    # один values-файл со всеми фонами adaptive-иконок
    lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"]
    for prefix, hexcol in colors.items():
        lines.append(f'    <color name="{prefix}_background">{hexcol}</color>')
    lines += ["</resources>", ""]
    with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w") as f:
        f.write("\n".join(lines))
    print("values/ic_launcher_background.xml updated")


if __name__ == "__main__":
    main()
