// Записывает видео полного прохода (все переходы анимируются) в VIDEO_DIR.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DIR = process.env.VIDEO_DIR ?? './video/'
mkdirSync(DIR, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: DIR, size: { width: 390, height: 844 } },
})
const page = await ctx.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const type = (s) => page.keyboard.type(s, { delay: 60 })

await page.goto('http://localhost:5173/')
await sleep(1500)
const story = page.locator('.select-none')
await story.click({ position: { x: 350, y: 400 } })
await sleep(1200)
await story.click({ position: { x: 350, y: 400 } })
await sleep(1400)
await page.getByRole('button', { name: 'Начать' }).click()
await sleep(1200)
await type('901234221')
await sleep(400)
await page.getByRole('button', { name: 'Получить код' }).click()
await sleep(1500)
await type('123456')
await sleep(1600)
await type('7777')
await sleep(900)
await type('7777')
await sleep(2200)

// сплит-флоу
await page.getByRole('button', { name: 'Сплит', exact: true }).first().click()
await sleep(1600)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(1300)
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(1100)
await page.locator('button', { hasText: /^\s*400\s000\s*$/ }).last().click()
await sleep(600)
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(900)
await type('7777')
await sleep(2200)
await page.getByRole('button', { name: /К статусу сплита/ }).click()
await sleep(1200)

// симуляция: Али открывает и платит → закрытие → сохранение → кэшбэк
await sleep(15500)
await sleep(1600)
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(1300)
await page.getByRole('button', { name: 'Сохранить группу' }).click()
await sleep(2000)
await page.getByRole('button', { name: 'Копить дальше' }).click()
await sleep(1600)

// разделы: табы и пуш-страницы
await page.locator('nav button').nth(2).click() // история
await sleep(1300)
await page.locator('nav button').nth(0).click() // главная
await sleep(1200)
await page.getByRole('button', { name: 'Мои должники' }).click()
await sleep(1400)
await page.getByRole('button', { name: 'Назад' }).click()
await sleep(1100)
await page.getByRole('button', { name: 'Накопленные кэшбеки' }).click()
await sleep(1400)
await page.getByRole('button', { name: 'Назад' }).click()
await sleep(1100)
await page.getByRole('button', { name: 'Профиль' }).click()
await sleep(1500)

await ctx.close()
await browser.close()
console.log('video saved to', DIR)
