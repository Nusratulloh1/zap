// Проверка нативного ввода и уклонения от клавиатуры (симуляция --kb-inset).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR ?? './shots/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` })
const fakeKb = (px) => page.evaluate((v) => document.documentElement.style.setProperty('--kb-inset', v + 'px'), px)

await page.addInitScript(() => {
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
})

// --- сумма: экранный платёжный пад (дизайн 3a) ---
await page.goto('http://localhost:5173/split/amount')
await sleep(800)
for (const d of '123456789') {
  await page
    .locator('button', { hasText: new RegExp('^\\s*' + d + '\\s*$') })
    .last()
    .dispatchEvent('pointerdown')
  await sleep(60)
}
await sleep(400)
await shot('n1-amount-typed')

// --- участники: ручной режим, редактирование доли с автофокусом ---
await page.goto('http://localhost:5173/split/scan')
await sleep(1200)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(700)
await page.getByRole('button', { name: 'Вручную' }).click()
await sleep(400)
await page.locator('button', { hasText: /^\s*400\s000\s*$/ }).first().click()
await sleep(600)
await page.keyboard.type('500000', { delay: 30 })
await sleep(300)
await shot('n3-member-edit-typed')
await fakeKb(320)
await sleep(400)
await shot('n4-member-edit-kb')
await fakeKb(0)
await page.getByRole('button', { name: 'Готово' }).click()
await sleep(400)
await shot('n5-member-manual-updated')

// --- карта: нативный ввод номера ---
await page.goto('http://localhost:5173/profile')
await sleep(1300)
await page.locator('button', { hasText: /Добавить карту/ }).click()
await sleep(700)
await page.keyboard.type('8600123412344821', { delay: 15 })
await sleep(300)
await shot('n6-card-typed')

// --- телефон: маска и автофокус (свежий контекст без авторизации) ---
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
const p2 = await ctx2.newPage()
await p2.goto('http://localhost:5173/auth/phone')
await sleep(900)
const focused = await p2.evaluate(() => document.activeElement?.getAttribute('type'))
await p2.keyboard.type('901234221', { delay: 25 })
await sleep(200)
const maskVal = await p2.locator('input[type="tel"]').inputValue()
console.log('phone autofocus type:', focused, '| masked value:', JSON.stringify(maskVal))
await p2.evaluate(() => document.documentElement.style.setProperty('--kb-inset', '320px'))
await sleep(400)
await p2.screenshot({ path: `${OUT}n7-phone-kb-raised.png` })

// у всех инпутов шрифт >= 16px (нет iOS-зума)
const small = await p2.evaluate(() =>
  [...document.querySelectorAll('input')].filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16).length,
)
console.log('inputs with font < 16px:', small)
await ctx2.close()

console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
