// Собирает артборды канваса «ZAP! — Все экраны».
// Фрагменты лежат в parts/, картинки — в img/ (их подкладывает seed-canvas.mjs).
//
// ВАЖНО: холст обрезает артборд по 8000 px, поэтому лендинг живёт отдельными
// артбордами, а длинный мобильный лендинг разложен в две колонки.
import { readFileSync, writeFileSync } from 'node:fs'

const part = (n) => readFileSync(new URL(`./parts/${n}.html`, import.meta.url), 'utf8').trim()

// размеры артбордов — должны совпадать с canvas.json
const SIZES = {
  Main: [2624, 6520],
  Landing: [5172, 5040],
  LandingMobile: [1872, 4930],
}

const SCREENS = [
  ['01', 'Онбординг · сторис 1/3 — сканируй счёт', 'onboarding1'],
  ['02', 'Онбординг · сторис 2/3 — дели поровну', 'onboarding2'],
  ['03', 'Онбординг · сторис 3/3 — кэшбэк ×2', 'onboarding3'],
  ['04', 'Вход · номер телефона', 'auth-phone'],
  ['05', 'Код из SMS · подтверждение номера', 'auth-code'],
  ['06', 'Придумайте PIN · 4 цифры', 'auth-pin'],
  ['07', 'Главная · промо, группы, сплиты', 'home'],
  ['08', 'Сканер · QR фискального чека', 'scan'],
  ['09', 'Чек · разобранный заказ', 'bill'],
  ['10', 'Проверьте позиции · правка чека', 'review'],
  ['11', 'Сумма вручную · пад (вкладка нава)', 'amount'],
  ['12', 'С кем делим · доли и «в долг»', 'members'],
  ['13', 'Подтверждение оплаты · PIN', 'pin-confirm'],
  ['14', 'Ссылка · QR и SMS друзьям', 'share'],
  ['15', 'Живой статус сплита', 'split-live'],
  ['16', 'Сплит закрыт · кэшбэк ×2', 'split-closed'],
  ['17', 'Сохранить группу', 'save-group'],
  ['18', 'Кэшбэк зачислен · по участникам', 'cashback-award'],
  ['19', 'Кэшбэк · накопления по группам', 'cashback'],
  ['20', 'Вам должны · долги и напоминания', 'debts'],
  ['21', 'История · сплиты, кэшбэк, долги', 'history'],
  ['22', 'Группа · Friday Crew', 'group'],
  ['23', 'Страница участника · zap.uz/s/…', 'participant'],
  ['24', 'Участник · доля внесена', 'participant-done'],
  ['25', 'Профиль · карты и настройки', 'profile'],
]

// Верхняя карусель главной: hero-слайд (см. экран 06) + слайд на каждое
// заведение с иллюстрацией зала — здесь остальные пять баннеров.
const BANNERS = [
  ['2/6', 'EVOS · акция 1+1', 'banner-evos'],
  ['3/6', 'Bellissimo Pizza · скидка 10%', 'banner-bellissimo'],
  ['4/6', 'Feed Up · акция 2+1', 'banner-feedup'],
  ['5/6', 'Bon! · скидка 20%', 'banner-bon'],
  ['6/6', 'Safia café · кэшбэк ×2', 'banner-safia'],
]

const TOKENS = [
  ['lime', '#DDFF33'],
  ['ink', '#111110'],
  ['cream', '#EFEDE6'],
  ['paper', '#FFFFFF'],
  ['sand', '#F5F3EE'],
  ['dune', '#F2F0EA'],
  ['shell', '#F7F5F0'],
  ['hairline', '#E8E6DE'],
  ['slate', '#5B594F'],
  ['muted', '#8A887E'],
  ['faint', '#B3B1A8'],
  ['danger', '#C2453E'],
]

const label = (num, text) => `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px">
        <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; font-weight: 700; background: #E3E1D8; border-radius: 6px; padding: 3px 7px; color: #111110">${num}</div>
        <div style="font-size: 13px; font-weight: 600; color: #8A887E">${text}</div>
      </div>`

const phone = (num, text, file) => `
    <div style="display: flex; flex-direction: column">${label(num, text)}
      <div style="width: 410px; border-radius: 44px; padding: 10px; background: linear-gradient(155deg, #4A4A4A 0%, #141414 34%, #0B0B0B 62%, #3A3A3A 100%); box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 30px 60px -30px rgba(17,17,16,0.55)">
        <div style="overflow: hidden; border-radius: 34px; background: #000">
${part(file)}
        </div>
      </div>
    </div>`

const flat = (num, text, file) => `
    <div style="display: flex; flex-direction: column">${label(num, text)}
      <div style="border-radius: 28px; overflow: hidden; box-shadow: 0 20px 44px -26px rgba(17,17,16,0.5); width: fit-content">
${part(file)}
      </div>
    </div>`

const sectionTitle = (kicker, title) => `
  <div style="border-top: 2px solid #111110; padding-top: 14px; margin-bottom: 28px">
    <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #8A887E">${kicker}</div>
    <div style="margin-top: 6px; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: #111110">${title}</div>
  </div>`

const swatch = ([name, hex]) => `
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div style="height: 56px; width: 96px; border-radius: 14px; background: ${hex}; border: 1px solid rgba(17,17,16,0.08)"></div>
        <div style="font-size: 12px; font-weight: 800; color: #111110">${name}</div>
        <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px; font-weight: 700; color: #8A887E; margin-top: -6px">${hex}</div>
      </div>`

const doc = (name, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">
  <style>
    body { margin: 0; font-family: 'Manrope', 'Segoe UI', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    a { color: #111110; } a:hover { color: #6B6960; }
  </style>
</helmet>
<div style="width: ${SIZES[name][0]}px; height: ${SIZES[name][1]}px; background: #EFEDE6; color: #111110; padding: 72px; overflow: hidden">
${body}
</div>
</x-dc>
</body>
</html>
`

// ─── 1 · приложение ────────────────────────────────────────────────────────
const main = doc('Main', `
  <!-- ШАПКА ДОКУМЕНТА -->
  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 64px; margin-bottom: 72px">
    <div style="max-width: 900px">
      <img src="zap-wordmark.png" alt="ZAP!" style="height: 96px; width: auto; display: block">
      <div style="margin-top: 20px; font-size: 64px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.02">Все экраны</div>
      <div style="margin-top: 14px; font-size: 17px; font-weight: 600; line-height: 1.5; color: #5B594F">Сплит-платежи для Узбекистана: веб-приложение (PWA) и публичный лендинг. Экраны, тексты и данные собраны из текущей сборки продукта — интерфейс на русском. Лендинг — на соседних артбордах справа.</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 22px">
      <div>
        <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #8A887E; margin-bottom: 14px">ПАЛИТРА</div>
        <div style="display: flex; gap: 14px">
${TOKENS.map(swatch).join('')}
        </div>
      </div>
      <div style="display: flex; gap: 40px; align-items: flex-end">
        <div>
          <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #8A887E; margin-bottom: 10px">ШРИФТ ИНТЕРФЕЙСА</div>
          <div style="font-size: 34px; font-weight: 800; letter-spacing: -0.02em">Manrope 800 · 600</div>
        </div>
        <div>
          <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #8A887E; margin-bottom: 10px">СУММЫ И МОН-ЛЕЙБЛЫ</div>
          <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 26px; font-weight: 700">1 200 000 UZS</div>
        </div>
      </div>
    </div>
  </div>

  <!-- СЕКЦИЯ · ПРИЛОЖЕНИЕ -->
${sectionTitle('ВЕБ-ПРИЛОЖЕНИЕ · PWA', '25 экранов — от онбординга до профиля')}
  <div style="display: flex; flex-wrap: wrap; gap: 56px; align-items: flex-start">
${SCREENS.map(([n, t, f]) => phone(n, t, f)).join('')}
  </div>

  <!-- СЕКЦИЯ · ПРОМО-БАННЕРЫ -->
  <div style="margin-top: 96px">
${sectionTitle('ГЛАВНАЯ · ПРОМО-КАРУСЕЛЬ', 'Остальные слайды баннера — предложения заведений')}
    <div style="display: flex; flex-wrap: wrap; gap: 56px; align-items: flex-start">
${BANNERS.map(([n, t, f]) => flat(n, t, f)).join('')}
    </div>
  </div>`)

// ─── 2 · лендинг, десктоп (новая версия: пиннинг и анимации) ───────────────
// Длинная страница разложена в колонки: артборд холста обрезает всё выше 8000 px.
const landing = doc('Landing', `
${sectionTitle('ПУБЛИЧНЫЙ ЛЕНДИНГ · zapapp.uz', 'Новая версия — пиннинг и анимации · десктоп 1440')}
  <div style="display: flex; gap: 56px; align-items: flex-start">
${flat('Д1', 'Шапка · герой · «как сейчас» · шаги 01–03', 'nl-desktop-1')}
${flat('Д2', 'Шаги 04–08 · бегущая строка', 'nl-desktop-2')}
${flat('Д3', 'Причины · мерчанты · FAQ · финал', 'nl-desktop-3')}
${flat('Д4', 'Заявка партнёра · модалка', 'nl-modal')}
  </div>`)

// ─── 3 · лендинг, мобильный ────────────────────────────────────────────────
const landingMobile = doc('LandingMobile', `
${sectionTitle('ПУБЛИЧНЫЙ ЛЕНДИНГ · zapapp.uz', 'Новая версия · мобильный 390 — страница в четыре колонки')}
  <div style="display: flex; gap: 56px; align-items: flex-start">
${flat('М1', 'Шапка · герой · «как сейчас» · шаги 01–02', 'nl-mobile-1')}
${flat('М2', 'Шаги 03–06', 'nl-mobile-2')}
${flat('М3', 'Шаги 07–08 · причины', 'nl-mobile-3')}
${flat('М4', 'Мерчанты · FAQ · финал', 'nl-mobile-4')}
  </div>`)

for (const [name, html] of [['Main', main], ['Landing', landing], ['LandingMobile', landingMobile]]) {
  writeFileSync(new URL(`./${name}.dc.html`, import.meta.url), html)
  console.log(`${name}.dc.html`, html.length, 'bytes', SIZES[name].join('×'))
}
