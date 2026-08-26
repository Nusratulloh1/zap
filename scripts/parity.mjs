// Снимает все 21 экран приложения (390×844) и складывает пары <id>-app.png / <id>-ref.png.
import { chromium } from 'playwright-core'
import { mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = process.env.PARITY_DIR ?? './parity/'
mkdirSync(OUT, { recursive: true })
const refDir = fileURLToPath(new URL('../design-reference/png/', import.meta.url))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const saved = []
async function shot(id) {
  await page.screenshot({ path: `${OUT}${id}-app.png` })
  copyFileSync(`${refDir}${id}.png`, `${OUT}${id}-ref.png`)
  saved.push(id)
}

async function typeDigits(s) {
  await page.keyboard.type(s, { delay: 45 })
}

// клавиши платёжного пада (pointerdown)
async function padTap(digits) {
  for (const d of digits) {
    await page
      .locator('button', { hasText: new RegExp('^\\s*' + d + '\\s*$') })
      .last()
      .dispatchEvent('pointerdown')
    await sleep(70)
  }
}

await page.addInitScript(() => {
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
})

// --- онбординг (гостевой контекст) ---
const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await guest.goto('http://localhost:5173/onboarding')
await sleep(1400)
await guest.screenshot({ path: `${OUT}5a-app.png` })
copyFileSync(`${refDir}5a.png`, `${OUT}5a-ref.png`)
const story = guest.locator('.select-none')
await story.click({ position: { x: 350, y: 400 } })
await sleep(900)
await guest.screenshot({ path: `${OUT}5a2-app.png` })
copyFileSync(`${refDir}5a2.png`, `${OUT}5a2-ref.png`)
await story.click({ position: { x: 350, y: 400 } })
await sleep(1900)
await guest.screenshot({ path: `${OUT}5a3-app.png` })
copyFileSync(`${refDir}5a3.png`, `${OUT}5a3-ref.png`)
saved.push('5a', '5a2', '5a3')
// --- телефон и код ---
await guest.goto('http://localhost:5173/auth/phone')
await sleep(900)
await guest.keyboard.type('901234221', { delay: 25 })
await sleep(300)
await guest.screenshot({ path: `${OUT}5b-app.png` })
copyFileSync(`${refDir}5b.png`, `${OUT}5b-ref.png`)
await guest.getByRole('button', { name: 'Получить код' }).click()
await sleep(1500)
await guest.keyboard.type('123', { delay: 60 })
await sleep(300)
await guest.screenshot({ path: `${OUT}5c-app.png` })
copyFileSync(`${refDir}5c.png`, `${OUT}5c-ref.png`)
saved.push('5b', '5c')
await guest.context().close()

// --- главная (4b без активного сплита) ---
await page.goto('http://localhost:5173/')
await sleep(1800)
await shot('4b')

// --- сканер ---
await page.goto('http://localhost:5173/split/scan')
await sleep(1300)
await shot('3d')

// --- счёт ---
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await shot('3e')

// --- ручная сумма (экранный пад) ---
await page.goto('http://localhost:5173/split/amount')
await sleep(800)
await padTap('12')
await padTap('00000')
await sleep(400)
await shot('3a')

// --- участники (через счёт) ---
await page.goto('http://localhost:5173/split/scan')
await sleep(1300)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(800)
// Бек в долг
await page.locator('button', { hasText: /^\s*400\s000\s*$/ }).last().click()
await sleep(400)
await shot('3b')

// --- PIN (3c) ---
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(600)
await shot('3c')
await typeDigits('7777')
await sleep(2400)

// --- QR-шэр (3k) ---
await shot('3k')

// --- участник (3b2) ---
const shareUrl = page.url()
const splitId = shareUrl.match(/split\/([^/]+)\/share/)?.[1]
await page.goto('http://localhost:5173/s/481-FRD')
await sleep(1600)
await shot('3b2')

// --- живой статус (3f) ---
await page.goto(`http://localhost:5173/split/${splitId}`)
await sleep(900)
await shot('3f')

// ждём закрытие симуляцией (Али платит ~14с) → закрытый экран
await sleep(15000)
await sleep(1400)
await shot('3g')

// --- сохранить группу (3h) ---
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(900)
await shot('3h')

// --- кэшбэк (3i) ---
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(1700)
await shot('3i')

// --- главная с активным сплитом (4a): создаём второй сплит ---
await page.getByRole('button', { name: 'Копить дальше' }).click()
await sleep(900)
await page.goto('http://localhost:5173/split/scan')
await sleep(1300)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(700)
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(600)
await typeDigits('7777')
await sleep(2400)
await page.goto('http://localhost:5173/')
await sleep(1600)
await shot('4a')

// --- разделы ---
await page.goto('http://localhost:5173/groups/g_friday')
await sleep(1400)
await shot('5f')
await page.goto('http://localhost:5173/debts')
await sleep(1500)
await shot('5g')
await page.goto('http://localhost:5173/cashback')
await sleep(1500)
await shot('5h')
await page.goto('http://localhost:5173/history')
await sleep(1500)
await shot('5i')
await page.goto('http://localhost:5173/profile')
await sleep(1400)
await shot('5j')

console.log('saved pairs:', saved.join(', '))
console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
