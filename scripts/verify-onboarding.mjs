// Верификация онбординга: слайды, переходы (в середине анимации), reduced-motion, логотипы.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.SHOT_DIR ?? './shots/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run(name, ctxOpts, fn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...ctxOpts })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await fn(page)
  if (errors.length) console.log(name, 'ERRORS:', errors)
  await ctx.close()
}

await run('main', {}, async (page) => {
  const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` })
  await page.goto(BASE + '/onboarding')
  await sleep(120)
  await shot('ob-01-slide1-appear-mid') // стаггер появления
  await sleep(900)
  await shot('ob-02-slide1')

  const story = page.locator('.select-none')
  // вперёд → середина перехода
  await story.click({ position: { x: 350, y: 400 } })
  await sleep(260)
  await shot('ob-03-fwd-mid-transition')
  await sleep(700)
  await shot('ob-04-slide2-dark')

  await story.click({ position: { x: 350, y: 400 } })
  await sleep(900)
  await shot('ob-05-slide3')

  // назад → середина перехода
  await story.click({ position: { x: 40, y: 400 } })
  await sleep(240)
  await shot('ob-06-back-mid-transition')
  await sleep(700)
  await shot('ob-07-slide2-again')
})

await run('reduced', { reducedMotion: 'reduce' }, async (page) => {
  const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` })
  await page.goto(BASE + '/onboarding')
  await sleep(500)
  await shot('ob-rm-slide1')
  const story = page.locator('.select-none')
  await story.click({ position: { x: 350, y: 400 } })
  await sleep(300)
  await shot('ob-rm-slide2')
})

await run('logos', {}, async (page) => {
  const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` })
  await page.addInitScript(() => {
    localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
  })
  await page.goto(BASE + '/')
  await sleep(1500)
  await shot('ob-08-home-logo')
})

console.log('verify done')
await browser.close()
