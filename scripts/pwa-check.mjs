// PWA-проверки: манифест, иконки (реальные размеры через sharp), мета-теги,
// сплэши, отсутствие 100vh, динамический theme-color на живых роутах, SW.
// Запуск: node scripts/pwa-check.mjs  (BASE_URL по умолчанию http://localhost:4173)
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ` — ${detail}` : ''))
}

// ---------- 1. манифест ----------
const manifest = await (await fetch(BASE + '/manifest.webmanifest')).json()
check('manifest: id === "/"', manifest.id === '/')
check('manifest: start_url === "/"', manifest.start_url === '/')
check('manifest: scope === "/"', manifest.scope === '/')
check('manifest: display standalone', manifest.display === 'standalone')
check('manifest: orientation portrait', manifest.orientation === 'portrait')
check('manifest: categories включают finance', Array.isArray(manifest.categories) && manifest.categories.includes('finance'))
check('manifest: theme_color лайм', manifest.theme_color?.toUpperCase() === '#DDFF33')
check('manifest: background_color лайм', manifest.background_color?.toUpperCase() === '#DDFF33')
const iconOf = (size, purpose) =>
  manifest.icons?.find((i) => i.sizes === `${size}x${size}` && (i.purpose ?? 'any') === purpose)
check('manifest: icon 192 any', Boolean(iconOf(192, 'any')))
check('manifest: icon 512 any', Boolean(iconOf(512, 'any')))
check('manifest: icon 192 maskable (отдельный)', Boolean(iconOf(192, 'maskable')))
check('manifest: icon 512 maskable (отдельный)', Boolean(iconOf(512, 'maskable')))
check(
  'manifest: нет "any maskable" в одном purpose',
  !(manifest.icons ?? []).some((i) => (i.purpose ?? '').includes('any') && (i.purpose ?? '').includes('maskable')),
)

// ---------- 2. файлы иконок: размеры и непрозрачность ----------
for (const [file, size] of [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/icon-maskable-192.png', 192],
  ['public/icon-maskable-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]) {
  const m = existsSync(file) ? await sharp(file).metadata() : null
  check(`icon: ${file} ${size}×${size}`, m?.width === size && m?.height === size)
}
// apple-touch: полностью непрозрачный (iOS сам скругляет; альфа даёт чёрные углы)
{
  const { data, info } = await sharp('public/apple-touch-icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let opaque = true
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 255) { opaque = false; break }
  check('icon: apple-touch-icon без прозрачности', opaque, `${info.width}×${info.height}`)
}

// ---------- 3. сплэши iOS ----------
const SPLASH = [
  [1170, 2532], [1179, 2556], [1290, 2796], [1284, 2778], [1125, 2436], [828, 1792], [750, 1334],
]
for (const [w, h] of SPLASH) {
  const f = `public/splash/splash-${w}x${h}.png`
  const m = existsSync(f) ? await sharp(f).metadata() : null
  check(`splash: ${w}×${h}`, m?.width === w && m?.height === h)
}

// ---------- 4. index.html: мета-теги и startup-ссылки ----------
const html = await (await fetch(BASE + '/')).text()
check('html: viewport-fit=cover', /viewport-fit=cover/.test(html))
check('html: status-bar black-translucent', /apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/.test(html))
check('html: apple-mobile-web-app-capable', /apple-mobile-web-app-capable"\s+content="yes"/.test(html))
check('html: theme-color пара light/dark', (html.match(/name="theme-color"[^>]*media="\(prefers-color-scheme/g) ?? []).length === 2)
const startupLinks = html.match(/rel="apple-touch-startup-image"/g) ?? []
check('html: 7 apple-touch-startup-image ссылок', startupLinks.length === 7, `найдено ${startupLinks.length}`)
check('html: у каждой startup-ссылки есть media с device-width+dpr', (html.match(/apple-touch-startup-image" media="\(device-width: \d+px\) and \(device-height: \d+px\) and \(-webkit-device-pixel-ratio: \d\) and \(orientation: portrait\)"/g) ?? []).length === 7)
check('html: apple-touch-icon ссылка', /rel="apple-touch-icon"/.test(html))
check('html: manifest подключён', /rel="manifest"/.test(html))

// ---------- 5. исходники: без 100vh ----------
{
  const bad = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name
      if (e.isDirectory()) walk(p)
      else if (/\.(vue|css|ts|html)$/.test(e.name) && readFileSync(p, 'utf8').includes('100vh')) bad.push(p)
    }
  }
  walk('src')
  if (readFileSync('index.html', 'utf8').includes('100vh')) bad.push('index.html')
  check('нет 100vh нигде (только dvh)', bad.length === 0, bad.join(', '))
}

// ---------- 6. живые роуты: динамический theme-color, фон html, SW ----------
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
})
const metaColor = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content)

await page.goto(BASE + '/')
await page.waitForTimeout(900)
check('theme-color на / == #0E0E0C (тёмный hero)', (await metaColor()) === '#0E0E0C', await metaColor())
const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
check('html background = крем (не белый)', htmlBg === 'rgb(239, 237, 230)', htmlBg)
const overscroll = await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY)
check('body overscroll-behavior-y: none/contain', overscroll === 'none' || overscroll === 'contain', overscroll)

await page.goto(BASE + '/split/amount')
await page.waitForTimeout(700)
check('theme-color на /split/amount == лайм', (await metaColor()) === '#DDFF33', await metaColor())

await page.goto(BASE + '/split/scan')
await page.waitForTimeout(700)
check('theme-color на /split/scan == #151513', (await metaColor()) === '#151513', await metaColor())

// SPA-переход (не полная загрузка) тоже обновляет мету
await page.goto(BASE + '/')
await page.waitForTimeout(700)
await page.evaluate(() => history.pushState({}, '', '/'))
check('theme-color вернулся на / == #0E0E0C', (await metaColor()) === '#0E0E0C', await metaColor())

const sw = await page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration()))
check('service worker зарегистрирован', sw)

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
if (failed.length) { console.log('FAILED:', failed.map((f) => f.name).join(' | ')); process.exit(1) }
