// Собирает Main.dc.html — один артборд со всеми экранами приложения и лендингом.
// Фрагменты лежат в parts/, картинки — в img/ (их подкладывает seed-canvas.mjs).
import { readFileSync, writeFileSync } from 'node:fs'

const part = (n) => readFileSync(new URL(`./parts/${n}.html`, import.meta.url), 'utf8').trim()

const W = 2624
const H = 14450

const SCREENS = [
  ['01', 'Онбординг · сторис 1/3 — сканируй счёт', 'onboarding1'],
  ['02', 'Онбординг · сторис 2/3 — дели поровну', 'onboarding2'],
  ['03', 'Вход · номер телефона', 'auth-phone'],
  ['04', 'Код из SMS · подтверждение номера', 'auth-code'],
  ['05', 'Придумайте PIN · 4 цифры', 'auth-pin'],
  ['06', 'Главная · промо, группы, сплиты', 'home'],
  ['07', 'Сканер · QR фискального чека', 'scan'],
  ['08', 'Чек · разобранный заказ', 'bill'],
  ['09', 'С кем делим · доли и «в долг»', 'members'],
  ['10', 'Подтверждение оплаты · PIN', 'pin-confirm'],
  ['11', 'Ссылка · QR и SMS друзьям', 'share'],
  ['12', 'Живой статус сплита', 'split-live'],
  ['13', 'Сплит закрыт · кэшбэк ×2', 'split-closed'],
  ['14', 'Кэшбэк · накопления по группам', 'cashback'],
  ['15', 'Вам должны · долги и напоминания', 'debts'],
  ['16', 'История · сплиты, кэшбэк, долги', 'history'],
  ['17', 'Страница участника · zap.uz/s/…', 'participant'],
  ['18', 'Профиль · карты и настройки', 'profile'],
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

const banner = (num, text, file) => `
    <div style="display: flex; flex-direction: column">${label(num, text)}
      <div style="width: 390px; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 44px -26px rgba(17,17,16,0.5)">
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

const html = `<!doctype html>
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
<div style="width: ${W}px; height: ${H}px; background: #EFEDE6; color: #111110; padding: 72px; overflow: hidden">

  <!-- ШАПКА ДОКУМЕНТА -->
  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 64px; margin-bottom: 72px">
    <div style="max-width: 900px">
      <img src="zap-wordmark.png" alt="ZAP!" style="height: 96px; width: auto; display: block">
      <div style="margin-top: 20px; font-size: 64px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.02">Все экраны</div>
      <div style="margin-top: 14px; font-size: 17px; font-weight: 600; line-height: 1.5; color: #5B594F">Сплит-платежи для Узбекистана: веб-приложение (PWA) и публичный лендинг. Экраны, тексты и данные собраны из текущей сборки продукта — интерфейс на русском.</div>
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
${sectionTitle('ВЕБ-ПРИЛОЖЕНИЕ · PWA', '18 экранов — от онбординга до профиля')}
  <div style="display: flex; flex-wrap: wrap; gap: 56px; align-items: flex-start">
${SCREENS.map(([n, t, f]) => phone(n, t, f)).join('')}
  </div>

  <!-- СЕКЦИЯ · ПРОМО-БАННЕРЫ -->
  <div style="margin-top: 96px">
${sectionTitle('ГЛАВНАЯ · ПРОМО-КАРУСЕЛЬ', 'Остальные слайды баннера — предложения заведений')}
    <div style="display: flex; flex-wrap: wrap; gap: 56px; align-items: flex-start">
${BANNERS.map(([n, t, f]) => banner(n, t, f)).join('')}
    </div>
  </div>

  <!-- СЕКЦИЯ · ЛЕНДИНГ -->
  <div style="margin-top: 96px">
${sectionTitle('ПУБЛИЧНЫЙ ЛЕНДИНГ · zapapp.uz', 'Десктоп и мобильная версия')}
    <div style="display: flex; gap: 56px; align-items: flex-start">
      <div style="display: flex; flex-direction: column">${label('Д', 'Лендинг · десктоп 1440')}
${part('landing-desktop')}
      </div>
      <div style="display: flex; flex-direction: column; gap: 56px">
        <div style="display: flex; flex-direction: column">${label('С', 'Заявка заведения · отправлено')}
${part('landing-form-sent')}
        </div>
      </div>
      <div style="display: flex; flex-direction: column">${label('М', 'Лендинг · мобильный 390')}
        <div style="width: 410px; border-radius: 44px; padding: 10px; background: linear-gradient(155deg, #4A4A4A 0%, #141414 34%, #0B0B0B 62%, #3A3A3A 100%); box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 30px 60px -30px rgba(17,17,16,0.55)">
          <div style="overflow: hidden; border-radius: 34px; background: #000">
${part('landing-mobile')}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`

writeFileSync(new URL('./Main.dc.html', import.meta.url), html)
console.log('Main.dc.html', html.length, 'bytes')
