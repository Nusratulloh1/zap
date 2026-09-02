# Промпты для аватаров ZAP! (Gemini / Nano Banana)

24 персоны в стиле Meta-аватаров: объёмные 3D-персонажи, портрет по грудь.
Готовые файлы кладём в `apps/mobile/assets/brand/personas/` как `p01.png` …
`p24.png`, размер 512×512, **круглый кадр без прозрачных полей**. Имена файлов
менять нельзя — по ним аватары подставляются во всём приложении.

Важно: Gemini **не умеет искать в интернете**. Все детали нужно описывать
словами, ссылки на «как у Meta» он не откроет.

---

## Вариант A — один лист из 24 персон (быстрее)

> Create a single image: a 6×4 grid of 24 different 3D cartoon avatar
> portraits, in the style of Meta / Facebook 3D avatars — soft clay-like
> rendering, smooth rounded shapes, friendly proportions, big expressive eyes
> with a small specular highlight, gentle studio lighting from the upper left,
> soft shadows, no outlines.
>
> Each avatar: head and shoulders only, facing the camera, centred inside its
> own circle with a solid pastel background (mint, sky blue, peach, lilac,
> cream, coral, sand, lime — vary them). Backgrounds are flat, no patterns, no
> text, no logos anywhere in the image.
>
> Make the 24 people diverse: different skin tones (light, olive, tan, brown,
> dark), different hairstyles (short crop, fringe, curly, afro, bun, long
> straight, braids, buzz cut, mohawk), some with beards or moustaches, some
> with glasses or sunglasses, some with headphones, one with a yellow-green
> cap, one with a red beanie, one in a hoodie. Casual clothes: plain t-shirts
> and hoodies in black, white, blue, green, red and lime green.
>
> All 24 must share the exact same rendering style, the same camera angle, the
> same head size and the same lighting, so they look like one set. Square
> image, high resolution, clean edges, no borders between cells, no captions.

Потом лист режется на 24 файла — скажите мне, я нарежу и подставлю.

---

## Вариант B — по одному (качественнее, 24 запроса)

Общая часть промпта (одинаковая для всех):

> A single 3D cartoon avatar portrait in the style of Meta / Facebook 3D
> avatars: soft clay-like rendering, smooth rounded shapes, friendly
> proportions, big expressive eyes with a small specular highlight, gentle
> studio lighting from the upper left, soft shadows, no outlines. Head and
> shoulders, facing the camera, centred in a circular crop on a solid flat
> {ЦВЕТ ФОНА} background. No text, no logos, no watermark. Square 1:1,
> 512×512, high resolution.

Подставляйте описание персоны:

| Файл | Фон | Персона |
|------|-----|---------|
| p01 | lime green | young man, light skin, short brown hair, black t-shirt |
| p02 | sky blue | young woman, light skin, long chestnut hair, white t-shirt, small gold earrings |
| p03 | peach | young man, brown skin, curly black hair, lime green t-shirt, freckles |
| p04 | mint | young man, tan skin, yellow-green baseball cap worn forward, black t-shirt |
| p05 | lilac | young woman, light skin, blonde hair in a top bun, green t-shirt, wide smile |
| p06 | cream | young man, dark skin, afro hair, blue t-shirt, freckles |
| p07 | coral | young woman, olive skin, brown hair with a fringe, white t-shirt, round glasses |
| p08 | sand | man, tan skin, buzz cut, full black beard, red t-shirt |
| p09 | sky blue | young man, olive skin, curly ginger hair, white t-shirt, wide smile |
| p10 | mint | young man, light skin, short brown hair, blue t-shirt, black sunglasses |
| p11 | peach | young woman, dark skin, black hair in a bun, white t-shirt, gold earrings |
| p12 | lilac | man, tan skin, red knitted beanie, moustache, black t-shirt |
| p13 | cream | young woman, olive skin, long straight black hair, red t-shirt, freckles |
| p14 | coral | young man, brown skin, short black hair, lime green t-shirt, clear glasses |
| p15 | lime green | young man, light skin, grey mohawk, black t-shirt, freckles, wide smile |
| p16 | sky blue | young man, tan skin, black hoodie with the hood up |
| p17 | mint | young man, olive skin, short brown hair, white t-shirt, lime green over-ear headphones |
| p18 | peach | young woman, light skin, blonde hair in two braids, lime green t-shirt, freckles |
| p19 | cream | young man, brown skin, black mohawk, red t-shirt, black sunglasses |
| p20 | lilac | man, olive skin, blue hoodie with the hood up, moustache |
| p21 | sand | man, light skin, short ginger hair, ginger beard, green t-shirt, freckles |
| p22 | coral | young woman, tan skin, black hair in braids, white t-shirt, gold earrings |
| p23 | sky blue | young man, dark skin, buzz cut, lime green t-shirt, black over-ear headphones |
| p24 | cream | young man, olive skin, yellow-green cap, white t-shirt, black sunglasses |

---

## Требования к результату

- 512×512, PNG, **круг вписан в квадрат** без прозрачных полей по краям.
- Никакого текста, водяных знаков и логотипов — иначе Apple завернёт.
- Одинаковый масштаб головы: если один портрет крупнее прочих, в ленте выбора
  это сразу видно.
- Стиль всех 24 — один. Смешивать «мультяшный 3D» и «реалистичный» нельзя.

Когда файлы будут готовы — пришлите папку, я приведу их к размеру, вырежу круг
и заменю `p01…p24`. Кода менять не нужно: аватары подставятся сразу в профиле,
в шапках, в выборе персоны и у участников сплитов.
