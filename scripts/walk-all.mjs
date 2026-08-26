// Полный обход всех экранов на 390×844 со скриншотами (SHOT_DIR обязателен).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR ?? './shots/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` })

// цифры вводятся нативной клавиатурой: поля автофокусятся, печатаем через keyboard
async function typeDigits(str) {
  await page.keyboard.type(str, { delay: 45 })
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

// -------- онбординг + авторизация --------
await page.goto('http://localhost:5173/')
await sleep(1200)
await shot('a01-onboarding-1')
const story = page.locator('.relative.flex-1.select-none')
await story.click({ position: { x: 350, y: 420 } })
await sleep(500)
await shot('a02-onboarding-2')
await story.click({ position: { x: 350, y: 420 } })
await sleep(900)
await shot('a03-onboarding-3')
await page.getByRole('button', { name: 'Начать' }).click()
await sleep(600)
await shot('a04-auth-phone')
await page.locator('input[type="tel"]').click()
await typeDigits('901234221')
await sleep(300)
await shot('a05-auth-phone-filled')
await page.getByRole('button', { name: 'Получить код' }).click()
await sleep(1400)
await shot('a06-auth-code')
await typeDigits('123456')
await sleep(1500)
await shot('a07-pin-create')
await typeDigits('7777')
await sleep(700)
await typeDigits('7777')
await sleep(1800)
await shot('a08-home')

// -------- ручная сумма (экранный пад) --------
await page.goto('http://localhost:5173/split/amount')
await sleep(600)
await shot('a09-amount-empty')
await padTap('123456789')
await sleep(400)
await shot('a10-amount-9digits')

// -------- сканер + счёт --------
await page.goto('http://localhost:5173/split/scan')
await sleep(1200)
await shot('a11-scan')
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await shot('a12-bill')

// -------- участники --------
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(900)
await shot('a13-members-equal')
await page.getByRole('button', { name: 'Вручную' }).click()
await sleep(500)
await shot('a14-members-manual')
await page.getByRole('button', { name: 'Позиции' }).click()
await sleep(500)
await shot('a15-members-items')
await page.getByRole('button', { name: 'Поровну' }).click()
await sleep(400)
await page.locator('button', { hasText: /^\s*400\s000\s*$/ }).last().click()
await sleep(300)
// контакты-шит
await page.locator('button', { hasText: /Все контакты/ }).click()
await sleep(600)
await shot('a16-contacts-sheet')
await page.locator('.fixed.inset-0').click({ position: { x: 195, y: 100 } })
await sleep(500)
// создаём
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(500)
await shot('a17-pin-sheet')
await typeDigits('7777')
await sleep(1900)
await shot('a18-share')

// -------- живой статус --------
const splitUrl = page.url().replace('/share', '')
await page.goto(splitUrl)
await sleep(900)
await shot('a19-live-waiting')
await sleep(6200)
await shot('a20-live-opened')
await sleep(9000)
await sleep(1500)
await shot('a21-closed')

// -------- сохранение группы + кэшбэк --------
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(800)
await shot('a22-save-group')
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(1600)
await shot('a23-cashback-award')
await page.getByRole('button', { name: 'Копить дальше' }).click()
await sleep(1300)
await shot('a24-home-after')

// -------- участник (создаём второй сплит, чтобы был активный) --------
await page.goto('http://localhost:5173/split/scan')
await sleep(1200)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(900)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(700)
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(500)
await typeDigits('7777')
await sleep(1900)
await page.goto('http://localhost:5173/')
await sleep(1400)
await shot('a25-home-active-pill')
await page.goto('http://localhost:5173/s/481-FRD')
await sleep(1500)
await shot('a26-participant')

// -------- разделы --------
await page.goto('http://localhost:5173/groups/g_friday')
await sleep(1300)
await shot('a27-group')
await page.goto('http://localhost:5173/debts')
await sleep(1600)
await shot('a28-debts')
await page.goto('http://localhost:5173/history')
await sleep(1400)
await shot('a29-history')
await page.goto('http://localhost:5173/cashback')
await sleep(1400)
await shot('a30-cashback')
await page.goto('http://localhost:5173/profile')
await sleep(1300)
await shot('a31-profile')
// карта-шит
await page.locator('button', { hasText: /Добавить карту/ }).click()
await sleep(600)
await shot('a32-card-sheet')

console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
