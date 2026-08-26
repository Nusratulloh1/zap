// Сценарий 2: активный пилл на главной, страница участника /s/481-FRD, «Покрыть остаток».
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR ?? './shots/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
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

// создаём сплит
await page.goto('http://localhost:5173/split/scan')
await sleep(1200)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(700)
await page.locator('button', { hasText: /^\s*400\s000\s*$/ }).last().click()
await sleep(300)
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(500)
await typeDigits('7777')
await sleep(1800)
console.log('after create:', page.url())
const splitUrl = page.url().replace('/share', '')

// главная: активный пилл
await page.goto('http://localhost:5173/')
await sleep(1500)
await shot('s2-01-home-active-pill')
const pill = page.locator('button', { hasText: /Активный сплит/ })
console.log('pill visible:', await pill.count())

// страница участника
await page.goto('http://localhost:5173/s/481-FRD')
await sleep(1500)
await shot('s2-02-participant')
await page.locator('button', { hasText: /Внести/ }).click()
await sleep(500)
await shot('s2-03-participant-pin')
await typeDigits('1234')
await sleep(1800)
await shot('s2-04-participant-paid')

// сплит должен закрыться (Али оплатил, Бек в долг) — организатор видит закрытие
await page.goto(splitUrl)
await sleep(1200)
await shot('s2-05-live-after-pay')
console.log('live url:', page.url())

console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
