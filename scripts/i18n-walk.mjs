// Обход всех экранов на трёх языках. Подписи кнопок берём из тех же словарей,
// что и приложение, — если ключ не отрисовался, шаг просто не найдёт кнопку.
//
//   LOCALE=uz BASE=http://localhost:5174 node scripts/i18n-walk.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const LOCALE = process.env.LOCALE ?? 'ru'
const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = `scratchpad/i18n/${LOCALE}/`
mkdirSync(OUT, { recursive: true })

const dict = JSON.parse(readFileSync(`packages/locales/${LOCALE}.json`, 'utf8'))
const L = (path) => path.split('.').reduce((o, k) => o?.[k], dict)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript((loc) => {
  localStorage.setItem('zap:locale', loc)
  // баннер установки PWA перехватывает клики и лезет в кадр — гасим на время обхода
  localStorage.setItem('zap:installed', '1')
}, LOCALE)
const page = await ctx.newPage()

const errors = []
const notes = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Скриншот + проверка на переполнение: текст, вылезающий за свой бокс. */
async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png` })
  const bad = await page.evaluate(() => {
    const out = []
    // горизонтальный вылет страницы
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      out.push(`страница шире вьюпорта: ${document.documentElement.scrollWidth}px`)
    for (const el of document.querySelectorAll('button, a, h1, h2, p, span, div')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (!el.textContent?.trim()) continue
      // карусели и бегущая строка обрезаются по замыслу — смотрим только на
      // элементы с собственным текстом, без вложенной раскладки
      if (el.children.length > 1) continue
      if (el.closest('[data-carousel], .lp-marquee, .no-scrollbar')) continue
      const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip'
      const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip'
      const noWrap = cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis'
      // обрезка по ширине без явного многоточия — реальная потеря текста
      if (clipsX && !noWrap && el.scrollWidth > el.clientWidth + 2)
        out.push(`обрезка по ширине: «${el.textContent.trim().slice(0, 42)}» (${el.scrollWidth}>${el.clientWidth})`)
      if (clipsY && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0 && !el.querySelector('img, svg, canvas'))
        out.push(`обрезка по высоте: «${el.textContent.trim().slice(0, 42)}» (${el.scrollHeight}>${el.clientHeight})`)
    }
    // непереведённый ключ, просочившийся в разметку: «members.modeEqual»
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const txt = (n.textContent ?? '').trim()
      if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,3}$/.test(txt) && !/\.(png|jpg|webp|svg|uz|ru|com)$/.test(txt))
        out.push(`сырой ключ в разметке: «${txt}»`)
    }
    return [...new Set(out)]
  })
  if (bad.length) notes.push(`${name}: ${bad.join(' | ')}`)
}

async function go(path, wait = 1100) {
  await page.goto(BASE + path)
  await sleep(wait)
}

async function tap(key, opts = {}) {
  const label = typeof key === 'string' && key.includes('.') ? L(key) : key
  const loc = page.locator('button, a', { hasText: new RegExp(escape(label)) }).last()
  await loc.click({ force: true, ...opts })
  await sleep(opts.wait ?? 700)
}
const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function padTap(digits) {
  for (const d of digits) {
    await page.locator('button', { hasText: new RegExp('^\\s*' + d + '\\s*$') }).last().dispatchEvent('pointerdown')
    await sleep(60)
  }
}

// ── лендинг (только гостю: authed уводится роутером на главную) ────────────
await go('/landing', 2200)
await shot('00-landing-hero')
for (const [i, y] of [1, 2, 3, 4].entries()) {
  await page.mouse.wheel(0, 900 * y)
  await sleep(900)
  await shot(`00-landing-${i + 2}`)
}

// ── онбординг и вход ───────────────────────────────────────────────────────
await go('/onboarding', 1300)
await shot('01-onboarding-1')
const story = page.locator('.relative.flex-1.select-none')
await story.click({ position: { x: 350, y: 420 } })
await sleep(600)
await shot('02-onboarding-2')
await story.click({ position: { x: 350, y: 420 } })
await sleep(900)
await shot('03-onboarding-3')
await tap('onboarding.start')
await shot('04-auth-phone')
await page.locator('input[type="tel"]').click()
await page.keyboard.type('901234221', { delay: 40 })
await sleep(300)
await shot('05-auth-phone-filled')
await tap('auth.getCode', { wait: 1400 })
await shot('06-auth-code')
await page.keyboard.type('123456', { delay: 40 })
await sleep(1600)
await shot('07-pin-create')
await page.keyboard.type('7777', { delay: 40 })
await sleep(800)
await page.keyboard.type('7777', { delay: 40 })
await sleep(1900)
await shot('08-home')

// ── ввод суммы и участники ────────────────────────────────────────────────
await go('/split/amount', 800)
await shot('09-amount-empty')
await padTap('450000')
await sleep(400)
await shot('10-amount-filled')
await tap('amount.split', { wait: 1000 })
await shot('11-members-equal')
await tap('members.modeManual')
await shot('12-members-manual')
await tap('members.modeEqual')
await tap('members.allContacts', { wait: 900 })
await shot('13-contacts-sheet')
await page.keyboard.press('Escape').catch(() => {})
await page.locator('.fixed.inset-0').first().click({ position: { x: 195, y: 80 } }).catch(() => {})
await sleep(600)

// ── сканер ────────────────────────────────────────────────────────────────
await go('/split/scan', 1500)
await shot('14-scan')

// ── статичные разделы ─────────────────────────────────────────────────────
await go('/', 1300)
await shot('15-home-full')
await go('/history', 1300)
await shot('16-history')
await go('/debts', 1400)
await shot('17-debts')
await go('/cashback', 1300)
await shot('18-cashback')
await go('/groups/g_friday', 1300)
await shot('19-group')
await go('/profile', 1300)
await shot('20-profile')
await tap('profile.language', { wait: 800 })
await shot('21-language-sheet')
await page.locator('.fixed.inset-0').first().click({ position: { x: 195, y: 60 } }).catch(() => {})
await sleep(500)

// ── экраны сплита из демо-данных ──────────────────────────────────────────
await go('/split/sp_caffeine', 1300)
await shot('22-split-live')
await go('/split/sp_caffeine/closed', 1300)
await shot('23-split-closed')
await go('/split/sp_caffeine/save-group', 1200)
await shot('24-save-group')
await go('/split/sp_caffeine/cashback', 1400)
await shot('25-cashback-award')
await go('/s/CFN-102', 1500)
await shot('26-participant')

writeFileSync(`${OUT}report.txt`, [
  `локаль: ${LOCALE}`,
  `ошибки страницы: ${errors.length ? errors.join('\n  ') : 'нет'}`,
  `переполнения: ${notes.length ? '\n  ' + notes.join('\n  ') : 'нет'}`,
].join('\n') + '\n')
console.log(`[${LOCALE}] ошибок: ${errors.length}, переполнений: ${notes.length}`)
if (errors.length) console.log(errors.join('\n'))
if (notes.length) console.log(notes.join('\n'))
await browser.close()
