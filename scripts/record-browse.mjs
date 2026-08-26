// Видео №2: обход всех разделов (табы, карусель, шиты, микровзаимодействия).
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

await page.addInitScript(() => {
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
})

await page.goto('http://localhost:5173/')
await sleep(2000)

// карусель: свайп двух слайдов
const box = await page.locator('.overflow-hidden').first().boundingBox()
for (let s = 0; s < 2; s++) {
  await page.mouse.move(box.x + 310, box.y + 100)
  await page.mouse.down()
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(box.x + 310 - i * 22, box.y + 100)
    await sleep(16)
  }
  await page.mouse.up()
  await sleep(900)
}

// категории
await page.getByRole('button', { name: 'Кэшбэк', exact: true }).first().click()
await sleep(900)
await page.getByRole('button', { name: 'Все', exact: true }).first().click()
await sleep(700)

// стат-карты → долги (напомнить всем) → назад
await page.getByRole('button', { name: 'Мои должники' }).click()
await sleep(1400)
await page.getByRole('button', { name: 'Напомнить всем' }).click()
await sleep(1600)
await page.getByRole('button', { name: 'Назад' }).click()
await sleep(1100)

// кэшбэк: фильтры
await page.getByRole('button', { name: 'Накопленные кэшбеки' }).click()
await sleep(1400)
await page.getByRole('button', { name: 'Friday Crew' }).click()
await sleep(800)
await page.getByRole('button', { name: 'Все группы' }).click()
await sleep(700)
await page.getByRole('button', { name: 'Назад' }).click()
await sleep(1100)

// группа: меню и шиты
await page.locator('span', { hasText: 'Friday Crew' }).first().click()
await sleep(1400)
await page.getByRole('button', { name: 'Меню' }).click()
await sleep(1000)
await page.locator('.fixed.inset-0').click({ position: { x: 195, y: 120 } })
await sleep(800)
await page.getByRole('button', { name: 'Назад' }).click()
await sleep(1100)

// история: табы
await page.locator('nav button').nth(2).click()
await sleep(1300)
await page.getByRole('button', { name: 'Кэшбэк', exact: true }).click()
await sleep(900)
await page.getByRole('button', { name: 'Долги', exact: true }).click()
await sleep(900)
await page.getByRole('button', { name: 'Все', exact: true }).click()
await sleep(800)

// профиль: тумблер, карта, PIN-флоу открыть/закрыть
await page.getByRole('button', { name: 'Профиль' }).click()
await sleep(1400)
await page.getByRole('switch').click()
await sleep(600)
await page.getByRole('switch').click()
await sleep(600)
await page.locator('button', { hasText: /HUMO ·· 1109/ }).click()
await sleep(1200)
await page.locator('button', { hasText: /PIN и вход/ }).click()
await sleep(1200)
await page.locator('.fixed.inset-0').click({ position: { x: 195, y: 120 } })
await sleep(800)

// сумма: пад
await page.goto('http://localhost:5173/split/amount')
await sleep(1000)
for (const d of '450000') {
  await page.locator('button', { hasText: new RegExp('^\\s*' + d + '\\s*$') }).last().dispatchEvent('pointerdown')
  await sleep(140)
}
await sleep(1200)

await ctx.close()
await browser.close()
console.log('browse video saved')
