// Снимки приложения для «телефонов» на лендинге — по одному комплекту на язык.
// Раньше лежал один русский комплект: на узбекском лендинге в макете телефона
// был русский интерфейс. Скрипт снимает все три из одного и того же прохода,
// поэтому комплекты гарантированно одинаковые по кадру.
//
//   BASE=http://localhost:5174 node scripts/landing-shots.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5174'
const LOCALES = (process.env.LOCALES ?? 'uz,ru,en').split(',')
const TMP = 'scratchpad/landing-shots/'
mkdirSync(TMP, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const locale of LOCALES) {
  mkdirSync(`apps/web/src/assets/landing/${locale}/`, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, // ретина: картинка на лендинге показывается крупно
  })
  await ctx.addInitScript((loc) => {
    localStorage.setItem('zap:locale', loc)
    localStorage.setItem('zap:installed', '1') // баннер установки не нужен в кадре
  }, locale)
  const page = await ctx.newPage()

  // PNG здесь, webp — отдельным шагом (scripts/png2webp.py): sharp в этом
  // дереве не поднят наружу, тащить его ради конверсии незачем
  async function grab(name) {
    await page.screenshot({ path: `${TMP}${locale}-app-${name}.png` })
  }
  async function go(path, wait = 1400) {
    await page.goto(BASE + path)
    await sleep(wait)
  }

  // вход
  await go('/onboarding', 1200)
  await page.locator('button', { hasText: /.+/ }).last().click({ force: true })
  await sleep(700)
  await page.locator('input[type="tel"]').click()
  await page.keyboard.type('901234221', { delay: 30 })
  await sleep(250)
  await page.locator('button[type="submit"], button').last().click({ force: true })
  await sleep(1400)
  await page.keyboard.type('123456', { delay: 30 })
  await sleep(1600)
  await page.keyboard.type('7777', { delay: 30 })
  await sleep(700)
  await page.keyboard.type('7777', { delay: 30 })
  await sleep(2000)

  await go('/', 1600)
  await grab('home')

  // чек: /split/bill без черновика уводит на сканер — заходим через «новый
  // сплит» в группе, он подтягивает демо-чек и открывает экран чека
  const dict = JSON.parse(readFileSync(`packages/locales/${locale}.json`, 'utf8'))
  const L = (path) => path.split('.').reduce((o, k) => o?.[k], dict)
  await go('/groups/g_friday', 1500)
  await page.getByRole('button', { name: L('group.newSplit') }).first().click({ force: true })
  await sleep(1800)
  await grab('receipt')

  // участники — только из живого черновика: прямой заход на /split/members
  // редиректит на сканер (draft.total === 0)
  await page.getByRole('button', { name: L('bill.split') }).first().click({ force: true })
  await sleep(1500)
  await grab('members')

  await go('/split/amount', 900)
  for (const d of '1200000') {
    await page.locator('button', { hasText: new RegExp('^\\s*' + d + '\\s*$') }).last().dispatchEvent('pointerdown')
    await sleep(60)
  }
  await sleep(500)
  await grab('amount')

  await go('/split/sp_caffeine/closed', 1500)
  await grab('done')

  await go('/cashback', 1500)
  await grab('cashback')

  await go('/debts', 1600)
  await grab('debts')

  await go('/history', 1500)
  await grab('history')

  console.log(`[${locale}] снимки сняты → ${TMP}`)
  await browser.close()
}
