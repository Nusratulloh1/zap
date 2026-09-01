# Промпты для баннеров карусели

Карусель на главной (`src/components/PromoCarousel.tsx`) показывает 5 заведений.
Все пять переводим из старого изометрического рендера зала в стикер-коллаж,
эталон — `assets/brand/venues/feedup.webp`.

## Общий стиль (одинаков для всех)

```
Wide horizontal sticker-collage banner, fully TRANSPARENT background, no backdrop,
aspect ratio 2.4:1 (1942x809).

Centerpiece: a black rounded-pill lockup with a thick lime-green (#DDFF33) outline,
containing the "<BRAND>" logo, then a white "×", then "ZAP!" — ZAP! set in heavy
white italic graffiti letters with a lime-green lightning bolt striking behind it.

Around the pill: 4-6 hyper-detailed food illustrations arranged as die-cut stickers
with thick white outlines and bold black linework — comic / street-art / graffiti
sticker-pack style, saturated colours, glossy highlights.

Decoration: lime-green (#DDFF33) lightning bolts of different sizes, black halftone
dot patterns, four-point sparkles, bold black speed-lines. One lime speech bubble
with the hand-lettered tagline in caps, one small lime "ZAP!" speech bubble, one
lime circular smiley sticker.

No frame, no background shapes, nothing but the collage on transparency.
```

## EVOS

Палитра: фирменный тёмно-зелёный и белый + лайм и чёрный из общего стиля.

Логотип: белое `EVOS®` жирным гротеском, подпись `DONER · LAVASH · FAST FOOD`.

Еда-стикеры: донер в лаваше в разрезе, ролл-лаваш, чизбургер, картошка фри
в фирменном зелёном стакане, стакан колы с логотипом EVOS, вертел с мясом.

Реплики: `REAL TASTE EVERY DAY` в лаймовом облачке, `GOOD FOOD GOOD MOOD`.

## Bellissimo Pizza

Палитра: оранжево-красный, зелёный, белый (итальянский триколор), чёрно-белая шашка.
Логотип: скруглённый квадрат-«сердце» с зелёно-красным кругом.

Еда-стикеры: целая пепперони-пицца на деревянной доске, отдельный ломтик с тянущимся
сыром, открытая коробка для пиццы с логотипом, бутылка колы, соусница.

Реплики: `GOOD PIZZA GOOD MOOD` в лаймовом облачке, `HOT FRESH DELICIOUS`.

## Safia café & bakery

Палитра: пыльно-розовый, кремовый, тёплый беж — но лайм и чёрный из общего стиля
остаются, иначе баннер выпадет из ряда.

Логотип: девочка в розовом поварском колпаке в круге + рукописное `Safia`
и подпись `café & bakery`.

Еда-стикеры: круассан, слоёный торт с ягодами, эклеры, стакан кофе с логотипом,
макаруны, корзина багетов.

Реплики: `FRESH BAKED DAILY` в лаймовом облачке, `MADE WITH LOVE`.

## Bon! boulangerie · pâtisserie

Палитра: тёмно-коричневый, кремовый, золото + лайм и чёрный из общего стиля.

Логотип: засечный `Bon!` с подписью `BOULANGERIE · PÂTISSERIE`.

Еда-стикеры: связка багетов, круассаны, шоколадный эклер, тарт с ягодами,
макаруны, чашка эспрессо с логотипом.

Реплики: `LE GOÛT DU VRAI` в лаймовом облачке, `FRESHLY BAKED DAILY`.

## Как класть в проект

Результат — прозрачный PNG. Кладём так же, как feedup:

```bash
python3 - <<'PY'
from PIL import Image
im = Image.open("<путь к PNG>").convert("RGBA")
im.thumbnail((1200, 1200), Image.LANCZOS)
im.save("apps/mobile/assets/brand/venues/<brand>.webp", "WEBP", quality=88, method=6)
PY
```

Имена файлов уже прописаны в `PromoCarousel.tsx`, менять код не нужно:
`evos.webp`, `bellissimo.webp`, `safia.webp`, `bon.webp`.
