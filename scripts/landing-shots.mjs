// Снимки приложения для «телефонов» на лендинге — по одному комплекту на язык.
// Раньше лежал один русский комплект: на узбекском лендинге в макете телефона
// был русский интерфейс. Скрипт снимает все три из одного и того же прохода,
// поэтому комплекты гарантированно одинаковые по кадру.
//
//   BASE=http://localhost:5174 node scripts/landing-shots.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

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
    permissions: ['camera'], // экран сканера снимаем «с живой камерой»
  })
  await ctx.addInitScript((loc) => {
    localStorage.setItem('zap:locale', loc)
    localStorage.setItem('zap:installed', '1') // баннер установки не нужен в кадре
    // Сессию кладём сразу: прогон через онбординг и SMS-код ничего не добавлял
    // к кадрам, но ломался от любой правки этих экранов.
    localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))

    // Камеры в headless нет, а тестовый шаблон Chrome в кадре смотрится мусором.
    // Подменяем поток холстом с ровным тёмным градиентом: сканер выходит таким
    // же, как в макете, и кадр не «пляшет» между прогонами.
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 1280
    const g = canvas.getContext('2d')
    const grad = g.createRadialGradient(360, 540, 40, 360, 540, 760)
    grad.addColorStop(0, '#3A3833')
    grad.addColorStop(0.55, '#211F1B')
    grad.addColorStop(1, '#121110')
    g.fillStyle = grad
    g.fillRect(0, 0, canvas.width, canvas.height)
    const stream = canvas.captureStream(10)
    navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream)

    // тосты («Али открыл ссылку» и т.п.) прилетают по таймеру симулятора
    // и попадают в случайные кадры — в снимках экранов им не место
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = '[data-sonner-toaster]{display:none !important}'
      document.head.appendChild(s)
    })
  }, locale)
  const page = await ctx.newPage()

  // PNG здесь, конверсия в webp — в конце прогона (sharp живёт в apps/web)
  async function grab(name) {
    await page.screenshot({ path: `${TMP}${locale}-app-${name}.png` })
  }
  async function go(path, wait = 1400) {
    await page.goto(BASE + path)
    await sleep(wait)
  }

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

  // сканер — читающий экран, состояние не трогает
  await go('/split/scan', 2200)
  await grab('scan')

  // Живой сплит целиком: QR-ссылка, страница участника, статус и начисленный
  // кэшбэк. Делается ПОСЛЕ всех остальных кадров — сплит меняет историю,
  // кэшбэк и долги, и снимки выше должны остаться прежними.
  try {
    await go('/groups/g_friday', 1500)
    await page.getByRole('button', { name: L('group.newSplit') }).first().click({ force: true })
    await sleep(1800)
    await page.getByRole('button', { name: L('bill.split') }).first().click({ force: true })
    await sleep(1500)
    // «Сплит · оплатить {amount}» — матчим по части до подстановки суммы
    const ctaSplit = L('members.ctaSplit').split('{')[0].trim()
    await page.locator('button', { hasText: new RegExp(ctaSplit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click()
    await sleep(600)
    await page.keyboard.type('7777', { delay: 45 })
    await sleep(2200)
    // на экране ссылка строится от window.location.origin — в кадре для
    // лендинга вместо localhost должен стоять боевой хост
    await page.evaluate((host) => {
      document.querySelectorAll('p').forEach((el) => {
        if (el.textContent && /^localhost[:\d]*\/s\//.test(el.textContent.trim())) {
          el.textContent = el.textContent.trim().replace(/^localhost[:\d]*/, host)
        }
      })
    }, 'use.zapapp.uz')
    await grab('share')

    const splitPath = new URL(page.url()).pathname.replace(/\/share$/, '')
    const code = (await page.textContent('body'))?.match(/\/s\/([A-Za-z0-9-]+)/)?.[1]

    if (code) {
      await go(`/s/${code}`, 1800)
      await grab('participant')
    }

    await go(splitPath, 1500)
    await grab('live')

    // «Покрыть остаток» закрывает сплит детерминированно — не ждём, пока
    // симулятор доведёт оплаты участников. После этого начисляется кэшбэк.
    const ctaCover = L('live.coverRest').split('{')[0].trim()
    await page.locator('button', { hasText: new RegExp(ctaCover.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click()
    await sleep(600)
    await page.keyboard.type('7777', { delay: 45 })
    await sleep(2600)

    await go(`${splitPath}/cashback`, 1800)
    await grab('award')
  } catch (e) {
    // не валим весь прогон: у лендинга на такие шаги есть запасные кадры
    console.warn(`[${locale}] живой сплит не снялся: ${e.message.split('\n')[0]}`)
  }

  console.log(`[${locale}] снимки сняты → ${TMP}`)
  await browser.close()
}

// PNG → webp прямо в ассеты лендинга: sharp объявлен в apps/web, поэтому
// резолвим его оттуда — скрипт запускается из корня монорепо.
const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
for (const locale of LOCALES) {
  for (const f of readdirSync(TMP).filter((n) => n.startsWith(`${locale}-app-`) && n.endsWith('.png'))) {
    const name = f.replace(`${locale}-app-`, '').replace(/\.png$/, '')
    await sharp(TMP + f)
      .webp({ quality: 82 })
      .toFile(`apps/web/src/assets/landing/${locale}/app-${name}.webp`)
  }
  console.log(`[${locale}] webp положены в assets/landing/${locale}/`)
}
