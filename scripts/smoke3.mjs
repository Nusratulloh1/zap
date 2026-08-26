// Сценарий 3: «Покрыть остаток» и сброс демо через «Выйти».
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR ?? './shots/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` })

await page.addInitScript(() => {
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
})

// цифры вводятся нативной клавиатурой: поля автофокусятся, печатаем через keyboard
async function typeDigits(s) {
  await page.keyboard.type(s, { delay: 45 })
}

// --- соло: «Оплатить целиком» → закрытый экран БЕЗ группового кэшбэка ---
await page.goto('http://localhost:5173/split/scan')
await sleep(1200)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Оплатить целиком' }).click()
await sleep(700)
await typeDigits('7777')
await sleep(2600)
const soloUrl = page.url()
const soloCashback = await page.locator('text=групповой кэшбэк').count()
const soloSaveGroup = await page.getByRole('button', { name: 'Сохранить группу' }).count()
const soloClose = await page.getByRole('button', { name: 'Закрыть' }).count()
console.log('solo closed:', soloUrl.includes('/closed'), '| групповой кэшбэк:', soloCashback, '| Сохранить группу:', soloSaveGroup, '| Закрыть:', soloClose)
await page.screenshot({ path: OUT + 's3-00-solo-closed.png' })
await page.getByRole('button', { name: 'Закрыть' }).click()
await sleep(1200)

// сплит без долга — Али и Бек оба ждут
await page.goto('http://localhost:5173/split/scan')
await sleep(1200)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(700)
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(500)
await typeDigits('7777')
await sleep(1800)
const splitUrl = page.url().replace('/share', '')
await page.goto(splitUrl)
await sleep(1000)
await shot('s3-01-live-two-waiting')

// покрыть остаток 800 000
await page.locator('button', { hasText: /Покрыть остаток/ }).click()
await sleep(500)
await typeDigits('7777')
await sleep(2200)
await shot('s3-02-after-cover')
console.log('url after cover:', page.url())

// выйти — сброс демо
await page.goto('http://localhost:5173/profile')
await sleep(1200)
await page.locator('button', { hasText: /Выйти/ }).first().click()
await sleep(500)
await shot('s3-03-logout-sheet')
await page.locator('button', { hasText: /Выйти/ }).last().click()
await sleep(1500)
console.log('url after logout:', page.url())
await shot('s3-04-onboarding-again')

// localStorage сброшен?
const db = await page.evaluate(() => JSON.parse(localStorage.getItem('zap:db:v2') ?? '{}'))
console.log('splits in db after reset:', db.splits?.length, 'debts:', db.debts?.length)

console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
