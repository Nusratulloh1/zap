// Рендерит PNG всех экранов и артбордов в dist-share/png (@2x для экранов).
// Запуск: node export-png.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { chromium } from 'playwright-core'

const HERE = new URL('./', import.meta.url)
const OUT = new URL('./dist-share/', HERE)
const PNG = new URL('./png/', OUT)

const SCREENS = [
  ['01', 'onbording-1', 'onboarding1'],
  ['02', 'onbording-2', 'onboarding2'],
  ['03', 'onbording-3', 'onboarding3'],
  ['04', 'vhod-nomer', 'auth-phone'],
  ['05', 'kod-iz-sms', 'auth-code'],
  ['06', 'pridumayte-pin', 'auth-pin'],
  ['07', 'glavnaya', 'home'],
  ['08', 'skaner', 'scan'],
  ['09', 'chek', 'bill'],
  ['10', 'proverte-pozicii', 'review'],
  ['11', 'summa-pad', 'amount'],
  ['12', 's-kem-delim', 'members'],
  ['13', 'podtverzhdenie-pin', 'pin-confirm'],
  ['14', 'ssylka-qr', 'share'],
  ['15', 'zhivoy-status', 'split-live'],
  ['16', 'split-zakryt', 'split-closed'],
  ['17', 'sohranit-gruppu', 'save-group'],
  ['18', 'keshbek-zachislen', 'cashback-award'],
  ['19', 'keshbek', 'cashback'],
  ['20', 'vam-dolzhny', 'debts'],
  ['21', 'istoriya', 'history'],
  ['22', 'gruppa', 'group'],
  ['23', 'stranica-uchastnika', 'participant'],
  ['24', 'uchastnik-oplacheno', 'participant-done'],
  ['25', 'profil', 'profile'],
]

const BANNERS = [
  ['2', 'evos', 'banner-evos'],
  ['3', 'bellissimo', 'banner-bellissimo'],
  ['4', 'feedup', 'banner-feedup'],
  ['5', 'bon', 'banner-bon'],
  ['6', 'safia', 'banner-safia'],
]

const HEAD = `<meta charset="utf-8"><base href="../img/">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">
<style>body{margin:0;font-family:'Manrope',sans-serif}*{box-sizing:border-box}</style>`

const part = (n) => readFileSync(new URL(`./parts/${n}.html`, HERE), 'utf8')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(new URL('./ekrany/', PNG), { recursive: true })
mkdirSync(new URL('./bannery/', PNG), { recursive: true })
mkdirSync(new URL('./artbordy/', PNG), { recursive: true })
mkdirSync(new URL('./tmp/', HERE), { recursive: true })

let browser
for (const channel of ['chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    break
  } catch {}
}
if (!browser) throw new Error('нет Chrome/Edge для рендера')

async function shot(page, html, w, h, out) {
  const file = new URL('./tmp/frame.html', HERE)
  writeFileSync(file, `<!doctype html><html><head>${HEAD}</head><body>${html}</body></html>`)
  await page.setViewportSize({ width: w, height: h })
  await page.goto(file.href, { waitUntil: 'load' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } })
}

// экраны и баннеры — @2x
const hi = await browser.newPage({ deviceScaleFactor: 2 })
for (const [n, slug, f] of SCREENS) {
  await shot(hi, part(f), 390, 844, new URL(`./ekrany/${n}-${slug}.png`, PNG).pathname.slice(1))
  console.log('экран', n, slug)
}
for (const [n, slug, f] of BANNERS) {
  await shot(hi, part(f), 390, 452, new URL(`./bannery/${n}-${slug}.png`, PNG).pathname.slice(1))
  console.log('баннер', n, slug)
}
await hi.close()

// лендинг целиком — @1x, страница длинная; колонки склеиваем обратно в полосу
const one = await browser.newPage({ deviceScaleFactor: 1 })
const join = (files) => files.map(part).join('\n')
await shot(one, join(['nl-desktop-1', 'nl-desktop-2', 'nl-desktop-3']), 1440, 13840, new URL('./artbordy/lending-desktop.png', PNG).pathname.slice(1))
console.log('лендинг десктоп')
await shot(one, join(['nl-mobile-1', 'nl-mobile-2', 'nl-mobile-3', 'nl-mobile-4']), 390, 16129, new URL('./artbordy/lending-mobil.png', PNG).pathname.slice(1))
console.log('лендинг мобильный')
await shot(one, part('nl-modal'), 540, 520, new URL('./artbordy/zayavka-partnyora.png', PNG).pathname.slice(1))
console.log('модалка партнёра')
await one.close()

await browser.close()
rmSync(new URL('./tmp/', HERE), { recursive: true, force: true })
console.log('готово')
