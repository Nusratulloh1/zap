// Drives the ZAP! demo path end-to-end in headless Chrome and screenshots each step.
// Usage: SHOT_DIR=<dir> node scripts/smoke.mjs  (dev server must be running on :5173)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR ?? './shots/'
mkdirSync(OUT, { recursive: true })

const errors = []
let browser
for (const channel of ['chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    break
  } catch (e) {
    console.log(`channel ${channel} failed: ${e.message.split('\n')[0]}`)
  }
}
if (!browser) throw new Error('no browser channel available')

const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// цифры вводятся нативной клавиатурой: поля автофокусятся, печатаем через keyboard
async function typeDigits(s) {
  await page.keyboard.type(s, { delay: 45 })
}

if (process.env.THEME) await page.addInitScript((t) => localStorage.setItem('zap:theme', t), process.env.THEME)

await page.goto('http://localhost:5173/')
await sleep(1200)
await shot('01-onboarding-1')

// листаем сторис
const story = page.locator('.relative.flex-1.select-none')
await story.click({ position: { x: 380, y: 450 } })
await sleep(500)
await shot('02-onboarding-2')
await story.click({ position: { x: 380, y: 450 } })
await sleep(600)
await shot('03-onboarding-3')
await page.getByRole('button', { name: 'Начать' }).click()
await sleep(600)
await shot('04-auth-phone')

// вводим номер 90 123 42 21
await page.locator('input[type="tel"]').click()
await typeDigits('901234221')
await sleep(300)
await page.getByRole('button', { name: 'Получить код' }).click()
await sleep(1400)
await shot('05-auth-code')

await typeDigits('123456')
await sleep(1500)
await shot('06-pin-create')
await typeDigits('7777')
await sleep(700)
await typeDigits('7777')
await sleep(1600)
await shot('07-home')

// сплит: сканер
await page.getByRole('button', { name: 'Сплит', exact: true }).first().click()
await sleep(1200)
await shot('08-scan')
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await shot('09-bill')

// разделить
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(800)
await shot('10-members')

// Бек в долг: тап по сумме в его строке (последняя «400 000»)
await page.locator('button', { hasText: /^\s*400\s000\s*$/ }).last().click()
await sleep(300)
console.log('debt chips:', await page.getByRole('button', { name: 'В ДОЛГ' }).count())
await sleep(400)
await shot('11-members-debt')

// CTA сплит
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(600)
await shot('12-pin-sheet')
await typeDigits('7777')
await sleep(1800)
await shot('13-share')

// к статусу
await page.getByRole('button', { name: /К статусу сплита/ }).click()
await sleep(800)
await shot('14-live')

// ждём симуляцию: Али открыл (6с) и оплатил (14с)
await sleep(7000)
await shot('15-live-opened')
await sleep(9000)
await shot('16-live-paid-closing')
await sleep(1500)
await shot('17-closed')

// сохранить группу
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(800)
await shot('18-save-group')
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(1400)
await shot('19-cashback-award')

// домой
await page.getByRole('button', { name: 'Копить дальше' }).click()
await sleep(1200)
await shot('20-home-after')

// долги
await page.goto('http://localhost:5173/debts')
await sleep(1200)
await shot('21-debts')
const remindBtn = page.getByRole('button', { name: 'Напомнить', exact: true }).first()
await remindBtn.click()
await sleep(600)
await shot('22-debts-reminded')

// история и кэшбэк
await page.goto('http://localhost:5173/history')
await sleep(1200)
await shot('23-history')
await page.goto('http://localhost:5173/cashback')
await sleep(1200)
await shot('24-cashback')

await page.goto('http://localhost:5173/profile')
await sleep(1200)
await shot('25-profile')

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
