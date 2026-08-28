// Проверка переключателя языка: лендинг (десктоп + мобильный) и онбординг
// на всех трёх слайдах, с открытым и закрытым списком, на каждом языке.
//
//   BASE=http://localhost:5174 node scripts/i18n-switcher-shots.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'scratchpad/i18n/switcher/'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []

async function ctxFor(locale, viewport) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript((loc) => {
    // только если выбора ещё нет: скрипт выполняется и после перезагрузки,
    // а она как раз происходит при смене языка — затирать выбор нельзя
    if (!localStorage.getItem('zap:locale')) localStorage.setItem('zap:locale', loc)
    localStorage.setItem('zap:installed', '1')
  }, locale)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${locale}: ${e.message}`))
  return { ctx, page }
}

const trigger = (page) => page.locator("[aria-haspopup]").first()

for (const locale of ['uz', 'ru', 'en']) {
  // ── лендинг: десктоп ────────────────────────────────────────────────────
  {
    const { ctx, page } = await ctxFor(locale, { width: 1280, height: 860 })
    await page.goto(BASE + '/landing')
    await sleep(2200)
    await page.screenshot({ path: `${OUT}${locale}-landing-desktop.png` })
    await trigger(page).click({ force: true })
    await sleep(420)
    await page.screenshot({ path: `${OUT}${locale}-landing-desktop-open.png` })
    await ctx.close()
  }

  // ── лендинг: мобильная ширина ───────────────────────────────────────────
  {
    const { ctx, page } = await ctxFor(locale, { width: 390, height: 844 })
    await page.goto(BASE + '/landing')
    await sleep(2200)
    await page.screenshot({ path: `${OUT}${locale}-landing-mobile.png` })
    await trigger(page).click({ force: true })
    await sleep(420)
    await page.screenshot({ path: `${OUT}${locale}-landing-mobile-open.png` })
    await ctx.close()
  }

  // ── онбординг: три слайда, дропдаун на светлом и на тёмном ──────────────
  {
    const { ctx, page } = await ctxFor(locale, { width: 390, height: 844 })
    await page.goto(BASE + '/onboarding')
    await sleep(1400)
    await page.screenshot({ path: `${OUT}${locale}-onb-1.png` })
    await trigger(page).click({ force: true })
    await sleep(420)
    await page.screenshot({ path: `${OUT}${locale}-onb-1-open.png` })
    await page.keyboard.press('Escape')
    await sleep(300)

    // тап по правой части экрана листает историю — проверяем, что листает
    const story = page.locator('.relative.flex-1.select-none')
    await story.click({ position: { x: 350, y: 430 }, force: true })
    await sleep(800)
    await page.screenshot({ path: `${OUT}${locale}-onb-2-dark.png` })
    await trigger(page).click({ force: true })
    await sleep(420)
    await page.screenshot({ path: `${OUT}${locale}-onb-2-dark-open.png` })
    await page.keyboard.press('Escape')
    await sleep(300)
    await story.click({ position: { x: 350, y: 430 }, force: true })
    await sleep(800)
    await page.screenshot({ path: `${OUT}${locale}-onb-3.png` })
    await ctx.close()
  }
}

// ── смена языка «на лету» + перенос выбора в приложение ────────────────────
{
  const { ctx, page } = await ctxFor('ru', { width: 390, height: 844 })
  await page.goto(BASE + '/onboarding')
  await sleep(1400)
  await trigger(page).click({ force: true })
  await sleep(350)
  await page.getByRole('option', { name: "O'zbekcha" }).click({ force: true })
  await sleep(1800) // выбор языка перезагружает страницу
  await page.screenshot({ path: `${OUT}switch-live-ru-to-uz.png` })
  const stored = await page.evaluate(() => localStorage.getItem('zap:locale'))
  console.log('после выбора в онбординге zap:locale =', stored)

  // онбординг → авторизация → приложение: язык должен доехать
  const uz = JSON.parse(readFileSync('packages/locales/uz.json', 'utf8'))
  await page.getByRole('button', { name: uz.onboarding.start }).first().click({ force: true })
  await sleep(900)
  await page.locator('input[type="tel"]').click()
  await page.keyboard.type('901234221', { delay: 30 })
  await sleep(250)
  await page.screenshot({ path: `${OUT}switch-auth-phone.png` })
  await page.getByRole('button', { name: uz.auth.getCode }).first().click({ force: true })
  await sleep(1600)
  await page.keyboard.type('123456', { delay: 30 })
  await sleep(1700)
  await page.keyboard.type('7777', { delay: 30 })
  await sleep(700)
  await page.keyboard.type('7777', { delay: 30 })
  await sleep(2200)
  await page.screenshot({ path: `${OUT}switch-app-after-auth.png` })
  const after = await page.evaluate(() => ({
    ls: localStorage.getItem('zap:locale'),
    lang: document.documentElement.lang,
  }))
  console.log('после входа:', JSON.stringify(after))
  await ctx.close()
}

// ── шит языка в профиле ────────────────────────────────────────────────────
{
  const uz = JSON.parse(readFileSync('packages/locales/uz.json', 'utf8'))
  const { ctx, page } = await ctxFor('uz', { width: 390, height: 844 })
  await page.goto(BASE + '/onboarding')
  await sleep(1200)
  await page.getByRole('button', { name: uz.onboarding.start }).first().click({ force: true })
  await sleep(900)
  await page.locator('input[type="tel"]').click()
  await page.keyboard.type('901234221', { delay: 30 })
  await page.getByRole('button', { name: uz.auth.getCode }).first().click({ force: true })
  await sleep(1600)
  await page.keyboard.type('123456', { delay: 30 })
  await sleep(1700)
  await page.keyboard.type('7777', { delay: 30 })
  await sleep(700)
  await page.keyboard.type('7777', { delay: 30 })
  await sleep(2200)
  await page.goto(BASE + '/profile')
  await sleep(1500)
  await page.getByRole('button', { name: uz.profile.language }).first().click({ force: true })
  await sleep(900)
  await page.screenshot({ path: `${OUT}uz-profile-sheet.png` })
  await ctx.close()
}

console.log('ошибки страниц:', errors.length ? errors : 'нет')
await browser.close()
