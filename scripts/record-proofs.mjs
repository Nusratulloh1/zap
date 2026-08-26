// Видео-доказательства: фильтры списков и живая сумма.
// VIDEO_DIR обязателен; создаёт filter-proof.webm и amount-proof.webm.
import { chromium } from 'playwright-core'
import { mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs'

const DIR = process.env.VIDEO_DIR ?? './video/'
mkdirSync(DIR, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function recordTo(name, fn) {
  const tmp = DIR + 'tmp-' + name + '/'
  mkdirSync(tmp, { recursive: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: tmp, size: { width: 390, height: 844 } },
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
  })
  await fn(page)
  await ctx.close()
  const f = readdirSync(tmp).find((x) => x.endsWith('.webm'))
  copyFileSync(tmp + f, DIR + name)
  rmSync(tmp, { recursive: true, force: true })
  console.log(name, 'saved')
}

// --- фильтры: кэшбэк, история, долги ---
await recordTo('filter-proof.webm', async (page) => {
  await page.goto('http://localhost:5173/cashback')
  await sleep(1800)
  await page.getByRole('button', { name: 'Friday Crew' }).click()
  await sleep(1100)
  await page.getByRole('button', { name: 'Zaytun Crew' }).click()
  await sleep(1100)
  await page.getByRole('button', { name: 'Все группы' }).click()
  await sleep(1200)
  await page.goto('http://localhost:5173/history')
  await sleep(1600)
  await page.getByRole('button', { name: 'Сплиты', exact: true }).click()
  await sleep(1000)
  await page.getByRole('button', { name: 'Кэшбэк', exact: true }).click()
  await sleep(1000)
  await page.getByRole('button', { name: 'Долги', exact: true }).click()
  await sleep(1000)
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await sleep(1200)
  await page.goto('http://localhost:5173/debts')
  await sleep(1600)
  await page.getByRole('button', { name: /Вы должны/ }).click()
  await sleep(1100)
  await page.getByRole('button', { name: 'Вам должны', exact: true }).click()
  await sleep(1300)
})

// --- сумма: набор и удаление длинного числа ---
await recordTo('amount-proof.webm', async (page) => {
  await page.goto('http://localhost:5173/split/amount')
  await sleep(1200)
  const tap = async (d) => {
    await page.locator('button', { hasText: new RegExp('^\\s*' + d + '\\s*$') }).last().dispatchEvent('pointerdown')
    await sleep(340)
  }
  for (const d of '123456789') await tap(d)
  await sleep(700)
  for (let i = 0; i < 6; i++) await tap('⌫')
  await sleep(500)
  await tap('000')
  await sleep(900)
})

await browser.close()
