// UI-golden-path против НАСТОЯЩЕГО бэкенда (NestJS+Postgres, :3000) через
// real-режим фронта (:5174, VITE_API_URL). Прод-пусто: без сид-данных,
// участник добавляется по номеру, гость платит через публичные ручки + OTP-lite.
import { chromium } from 'playwright-core'

const FRONT = process.env.FRONT_URL ?? 'http://localhost:5174'
const API = process.env.API_URL ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ` — ${detail}` : ''))
}

// -------- создатель --------
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('CREATOR: ' + e.message))

await page.goto(FRONT + '/')
await sleep(1500)
// онбординг → авторизация
const story = page.locator('.relative.flex-1.select-none')
await story.click({ position: { x: 350, y: 420 } })
await sleep(400)
await story.click({ position: { x: 350, y: 420 } })
await sleep(700)
await page.getByRole('button', { name: 'Начать' }).click()
await sleep(700)
await page.locator('input[type="tel"]').click()
await page.keyboard.type('901234221', { delay: 40 })
await sleep(300)
await page.getByRole('button', { name: 'Получить код' }).click()
await sleep(1500)
const smsRes = await fetch(API + '/dev/sms/latest?phone=998901234221').then((r) => r.json()).catch(() => ({}))
const devCode = smsRes.code ?? (await page.evaluate(() => window.__ZAP_DEV_OTP))
check('код взят из /dev/sms/latest (dry-run SMS)', Boolean(smsRes.code), smsRes.code ? '******' : 'фолбэк window-хук')
await page.keyboard.type(devCode, { delay: 45 })
await sleep(1800)
await page.keyboard.type('7777', { delay: 45 })
await sleep(700)
await page.keyboard.type('7777', { delay: 45 })
await sleep(2200)
// незакрываемый шит «Как вас зовут?» у нового пользователя
const nameSheet = await page.waitForSelector('text=Как вас зовут?', { timeout: 10_000 }).then(() => true).catch(() => false)
check('шит имени показан новому пользователю', nameSheet)
await page.locator('input[placeholder="Имя и фамилия"]').click()
await page.keyboard.type('Ислам Ахунов', { delay: 30 })
await page.getByRole('button', { name: 'Продолжить' }).click()
await sleep(1500)

check('после auth — главная', await page.evaluate(() => location.pathname) === '/')
// прод-пусто: ни одного сплита в кэше
const emptySplits = await page.evaluate(() => {
  return document.body.innerText.includes('Ваши сплиты') || true
})
const splitCount = await page.evaluate(async () => {
  const mod = await import('/src/api/index.ts')
  return mod.snapshot().splits.length
})
check('прод стартует пустым (0 сплитов)', splitCount === 0, `splits=${splitCount}`)
void emptySplits

// -------- скан → счёт → участники --------
await page.goto(FRONT + '/split/scan')
await sleep(1500)
await page.getByRole('button', { name: 'Демо-чек' }).click()
await sleep(1500)
check('счёт Bellissimo из БД (seed:demo)', await page.locator('text=Bellissimo Pizza').first().isVisible())
await page.getByRole('button', { name: 'Разделить' }).click()
await sleep(1200)

// контактов нет — добавляем по номеру
await page.locator('button', { hasText: /^\s*Номер\s*$/ }).click().catch(async () => {
  await page.locator('button:has-text("Номер")').last().click()
})
await sleep(800)
await page.locator('input[type="tel"]').last().click()
await page.keyboard.type('901112233', { delay: 40 })
await sleep(300)
// обязательное поле имени в шите «+ Номер»
await page.locator('input[placeholder="Имя и фамилия"]').last().click()
await page.keyboard.type('Али Каримов', { delay: 30 })
await sleep(200)
await page.getByRole('button', { name: 'Добавить' }).last().click()
await sleep(1200)
const shareTxt = await page.locator('text=/по .* на человека/').first().textContent().catch(() => '')
check('участник добавлен, доли по 600 000', /600\s000/.test(shareTxt ?? ''), shareTxt ?? '')

// создаём сплит: PIN → paymentToken → POST /splits
await page.locator('button', { hasText: /Сплит · оплатить/ }).click()
await sleep(700)
await page.keyboard.type('7777', { delay: 45 })
await sleep(3000)
const shareUrl = await page.evaluate(() => location.pathname)
check('создан сплит → /share', /\/split\/.+\/share/.test(shareUrl), shareUrl)
const codeText = await page.locator('p.font-mono').first().textContent()
const code = (codeText ?? '').match(/s\/([\dA-Z-]+)/i)?.[1] ?? ''
check('код сплита получен', Boolean(code), code)

// -------- гость: публичная страница + OTP-lite --------
const gctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const gpage = await gctx.newPage()
gpage.on('pageerror', (e) => errors.push('GUEST: ' + e.message))
await gpage.goto(`${FRONT}/s/${code}`)
await sleep(1500)
// шит «Ваш номер»
await gpage.locator('input[type="tel"]').last().click()
await gpage.keyboard.type('901112233', { delay: 40 })
await sleep(300)
await gpage.getByRole('button', { name: 'Продолжить' }).click()
await sleep(2000)
check('гость видит свою долю 600 000', await gpage.locator('text=/600\\s000/').first().isVisible().catch(() => false))
await gpage.locator('button', { hasText: /Внести/ }).first().click()
await sleep(3500) // OTP-lite: dev-код авторезолвится, оплата уходит
const paidOk = await gpage.locator('text=/Доля внесена|уже внесена/').first().isVisible().catch(() => false)
check('гость оплатил долю (OTP-lite)', paidOk)

// -------- создатель: закрытие по realtime + кэшбэк --------
await sleep(2500)
await page.goto(FRONT + '/cashback')
await sleep(2500)
const cb = await page.evaluate(async () => {
  const mod = await import('/src/api/index.ts')
  const snap = mod.snapshot()
  return {
    entries: snap.cashbackEntries.length,
    total: snap.cashbackEntries.reduce((s, e) => s + e.amount, 0),
    splitStatus: snap.splits[0]?.status,
  }
})
check('сплит автозакрыт (все доли собраны)', cb.splitStatus === 'closed', `status=${cb.splitStatus}`)
check('кэшбэк начислен ×2 (600000×2.5%×2 = 30 000)', cb.total === 30_000, `total=${cb.total} entries=${cb.entries}`)

// история создателя — из HistoryEvent на сервере
await page.goto(FRONT + '/history')
await sleep(2000)
const histRows = await page.evaluate(async () => {
  const mod = await import('/src/api/index.ts')
  return mod.snapshot().history.map((h) => h.kind)
})
check('история: split + cashback записаны сервером', histRows.includes('split') && histRows.includes('cashback'), JSON.stringify(histRows))

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none')
console.log(failed === 0 ? 'REAL SMOKE: ALL PASS' : `REAL SMOKE: ${failed} FAILED`)
await browser.close()
process.exit(failed === 0 ? 0 : 1)
