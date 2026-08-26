// Видео-доказательства: переключение темы (circular reveal) и скролл-переходы.
// VIDEO_DIR обязателен; создаёт theme-toggle.webm и scroll-proof.webm.
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
    localStorage.setItem('zap:test', '1')
    localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
  })
  await fn(page)
  await ctx.close()
  const f = readdirSync(tmp).find((x) => x.endsWith('.webm'))
  copyFileSync(tmp + f, DIR + name)
  rmSync(tmp, { recursive: true, force: true })
  console.log(name, 'saved')
}

// --- тема: reveal из кнопки профиля, 4 экрана в обеих темах ---
await recordTo('theme-toggle.webm', async (page) => {
  await page.goto('http://localhost:5173/profile')
  await sleep(1600)
  await page.locator('[data-theme-toggle]').click() // light → dark: circular reveal
  await sleep(1400)
  await page.goto('http://localhost:5173/')
  await sleep(1800)
  await page.goto('http://localhost:5173/history')
  await sleep(1600)
  await page.goto('http://localhost:5173/cashback')
  await sleep(1600)
  await page.goto('http://localhost:5173/profile')
  await sleep(1300)
  await page.locator('[data-theme-toggle]').click() // dark → light: обратный reveal
  await sleep(1400)
  await page.goto('http://localhost:5173/')
  await sleep(1500)
})

// --- скролл: навигация из прокрученного состояния, вперёд и назад, 3 экрана ---
await recordTo('scroll-proof.webm', async (page) => {
  // 1) главная → профиль
  await page.goto('http://localhost:5173/')
  await sleep(1800)
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(1100)
  await page.locator('button[aria-label="Профиль"]').first().click()
  await sleep(1300)
  await page.goBack() // restore к низу главной
  await sleep(1500)
  // 2) история → кэшбэк
  await page.goto('http://localhost:5173/history')
  await sleep(1600)
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(1100)
  await page.goto('http://localhost:5173/cashback')
  await sleep(1400)
  await page.goBack()
  await sleep(1500)
  // 3) кэшбэк → группа
  await page.goto('http://localhost:5173/cashback')
  await sleep(1500)
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(1000)
  await page.goto('http://localhost:5173/groups/g_friday')
  await sleep(1400)
  await page.goBack()
  await sleep(1600)
})

await browser.close()
