// Проверки тёмной темы: контраст токенов (WCAG), переключение и персист,
// первый пейнт без белой вспышки, meta theme-color, QR читается в тёмной.
// Запуск: node scripts/theme-check.mjs (BASE_URL, по умолчанию :5173)
import { chromium } from 'playwright-core'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const jsQR = require('jsqr')

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ` — ${detail}` : ''))
}

// ---------- 1. контраст (чистая математика по токенам тёмной темы) ----------
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const pairs = [
  ['текст #F5F3EE на фоне #0E0E0C', '#F5F3EE', '#0E0E0C', 4.5],
  ['текст #F5F3EE на surface #1A1916', '#F5F3EE', '#1A1916', 4.5],
  ['текст #F5F3EE на surface-2 #22211D', '#F5F3EE', '#22211D', 4.5],
  ['текст #F5F3EE на elevated #2A2925', '#F5F3EE', '#2A2925', 4.5],
  ['muted #A3A199 на surface #1A1916', '#A3A199', '#1A1916', 4.5],
  ['muted #A3A199 на фоне #0E0E0C', '#A3A199', '#0E0E0C', 4.5],
  ['лайм #DDFF33 на фоне #0E0E0C (акценты/суммы)', '#DDFF33', '#0E0E0C', 3],
  ['danger #E0685C на surface #1A1916 (суммы)', '#E0685C', '#1A1916', 3],
  ['on-lime #111110 на лайме #DDFF33', '#111110', '#DDFF33', 4.5],
  ['CTA-текст #1A1916 на крем-кнопке #F5F3EE', '#1A1916', '#F5F3EE', 4.5],
  ['slate(dark) #B8B6AD на surface #1A1916', '#B8B6AD', '#1A1916', 4.5],
]
for (const [name, fg, bg, min] of pairs) {
  const r = ratio(fg, bg)
  check(`контраст: ${name} ≥ ${min}`, r >= min, r.toFixed(2) + ':1')
}

// ---------- 2. живые проверки ----------
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('zap:test', '1')
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
  localStorage.setItem('zap:theme', 'dark')
})
const metaColor = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content)

// первый пейнт в тёмной: data-theme выставлен до отрисовки, фон html тёмный
await page.goto(BASE + '/profile')
const early = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  bg: getComputedStyle(document.documentElement).backgroundColor,
}))
check('тёмная: data-theme=dark сразу', early.theme === 'dark')
check('тёмная: html фон #0E0E0C (нет белой вспышки)', early.bg === 'rgb(14, 14, 12)', early.bg)
await page.waitForTimeout(900)
check('тёмная: theme-color на /profile == surface #1A1916', (await metaColor()) === '#1A1916', await metaColor())

// переключатель: клик по кнопке в профиле
await page.locator('[data-theme-toggle]').click()
await page.waitForTimeout(700)
const afterToggle = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme ?? 'light',
  stored: localStorage.getItem('zap:theme'),
}))
check('toggle: тема переключилась в light', afterToggle.theme === 'light')
check('toggle: zap:theme сохранён', afterToggle.stored === 'light')
check('toggle: theme-color стал белым (профиль light)', (await metaColor()) === '#FFFFFF', await metaColor())
await page.locator('[data-theme-toggle]').click()
await page.waitForTimeout(700)
check('toggle: обратно в dark', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark')

// персист: перезагрузка сохраняет тёмную
await page.reload()
await page.waitForTimeout(600)
check('персист: после reload тема dark', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark')

// statement-экраны: theme-color не темнеет (лайм на amount)
await page.goto(BASE + '/split/amount')
await page.waitForTimeout(700)
check('statement: theme-color на amount == лайм в dark', (await metaColor()) === '#DDFF33', await metaColor())

// ---------- 3. QR в тёмной читается (крем-на-surface, inversionAttempts) ----------
await page.goto(BASE + '/split/scan')
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await page.waitForTimeout(800)
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await page.waitForTimeout(500)
await page.keyboard.type('7777', { delay: 45 })
await page.waitForTimeout(2100)
const qrData = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return null
  const g = c.getContext('2d')
  const img = g.getImageData(0, 0, c.width, c.height)
  return { data: Array.from(img.data), w: img.width, h: img.height }
})
if (!qrData) {
  check('QR: canvas найден на share', false)
} else {
  const decoded = jsQR(new Uint8ClampedArray(qrData.data), qrData.w, qrData.h)
  check('QR (dark, крем-на-surface) декодируется jsQR', Boolean(decoded), decoded?.data ?? 'не прочитан')
}

await browser.close()
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
