// Верификация РЕДИЗАЙНА участника на проде: guest-pay → success с live-прогрессом
// → live-закрытие по сокету → настройка PIN → главная. Скриншоты в scratchpad/participant-flow.
import { chromium } from 'playwright-core'
import { io } from 'socket.io-client'

const BASE = 'https://zapapp.uz'
const API = BASE + '/api'
const CODE_OTP = '424242'
const SHOT = 'scratchpad/participant-flow'
const j = (r) => r.json()
const post = (p, b, h = {}) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) })
const frames = []
let failed = 0
const check = (n, ok, d = '') => { if (!ok) failed++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (d ? ` — ${d}` : '')) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- организатор создаёт 3-местный сплит через API ----
async function auth(phone) {
  await post('/auth/otp/request', { phone })
  const v = await post('/auth/otp/verify', { phone, code: CODE_OTP }).then(j)
  return v.accessToken
}
const orgTok = await auth('998900000091')
const AUTH = { Authorization: 'Bearer ' + orgTok }
await post('/auth/pin/set', { pin: '1234' }, AUTH)
const pt = await post('/auth/pin/verify', { pin: '1234' }, AUTH).then(j)
// имя организатора — чтобы проверить, что оно, а не «Ислам», рендерится
const nameRes = await fetch(API + '/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ name: 'Тест Организатор' }) })
const nameBody = await nameRes.json().catch(() => ({}))
console.log('set name:', nameRes.status, 'name=', nameBody.name ?? nameBody.user?.name ?? '(none)')
const created = await post('/splits', {
  title: 'Ужин в пятницу', totalAmount: 300000, mode: 'equal', merchantId: 'm_bellissimo',
  members: [{ phone: '998900000092', name: 'Гость Два' }, { phone: '998900000093', name: 'Гость Три' }],
}, { ...AUTH, 'X-Payment-Token': pt.paymentToken, 'Idempotency-Key': 'pf-' + Math.floor(performance.now()) }).then(j)
const code = created.code
check('организатор создал 3-местный сплит', Boolean(code), `code=${code} status=${created.status}`)

// ---- сокет: слушаем комнату сплита ----
const socket = io(`${BASE}/realtime`, { path: '/api/socket.io', transports: ['websocket'], auth: { token: orgTok } })
await new Promise((res) => { socket.on('connect', res); setTimeout(res, 4000) })
socket.emit('join_split', { code })
;['member_paid', 'split_closed'].forEach((ev) => socket.on(ev, (p) => frames.push({ ev, p })))

// ---- гость 92 в браузере ----
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`${BASE}/s/${code}`)
await sleep(1500)

// номер гостя
await page.waitForSelector('text=Ваш номер', { timeout: 8000 }).catch(() => {})
await page.locator('input[type="tel"]').last().click()
await page.keyboard.type('900000092', { delay: 35 })
await page.getByRole('button', { name: 'Продолжить' }).click()
await sleep(2000)

// PRE-PAY: имя организатора + чипы
const reqLine = await page.locator('text=/просит вашу долю/').first().textContent().catch(() => '')
check('организатор — реальное имя (не «Ислам»)', /Тест/.test(reqLine || '') && !/Ислам/.test(reqLine || ''), (reqLine || '').trim())
const noSeedNames = !/Ислам|Бек(?!ки)/.test(await page.content())
check('на странице нет seed-имён (Ислам/Бек)', noSeedNames)
const shareChip = await page.locator('text=моя доля').first().isVisible().catch(() => false)
check('чип «моя доля» показан', shareChip)
await page.screenshot({ path: `${SHOT}/1-prepay.png` })

// оплата доли
await page.locator('button', { hasText: /Внести/ }).first().click()
await page.waitForSelector('text=Код из SMS', { timeout: 8000 }).catch(() => {})
await sleep(600)
await page.keyboard.type(CODE_OTP, { delay: 45 })
await page.waitForSelector('text=/внесена/', { timeout: 12000 }).catch(() => {})
await sleep(1500)
const successVisible = await page.locator('text=/Ваша доля внесена/').first().isVisible().catch(() => false)
check('success-экран: «Ваша доля внесена»', successVisible)
const progA = await page.locator('text=/Оплачено \\d из 3/').first().textContent().catch(() => '')
check('live-прогресс «Оплачено 2 из 3» после оплаты', /2 из 3/.test(progA || ''), (progA || '').trim())
const cashbackPreview = await page.locator('text=/Кэшбэк ×2 придёт/').first().isVisible().catch(() => false)
check('кэшбэк-превью «×2 придёт»', cashbackPreview)
await page.screenshot({ path: `${SHOT}/2-success-live.png` })

// ---- гость 93 платит через ПУБЛИЧНУЮ ручку (без пред-авторизации, чтобы не
// сжечь 1/мин лимит OTP) → live-закрытие на экране 92 ----
await post(`/s/${code}/pay`, { phone: '998900000093', amount: 100000 }) // otpRequired (создаёт participant_pay OTP)
await sleep(500)
await post(`/s/${code}/pay`, { phone: '998900000093', amount: 100000, code: CODE_OTP })
// ждём, пока сокет-событие обновит экран 92
await page.waitForSelector('text=/Оплачено 3 из 3|Сплит закрыт/', { timeout: 12000 }).catch(() => {})
await sleep(1500)
const progB = await page.locator('text=/Оплачено 3 из 3/').first().textContent().catch(() => '')
check('LIVE: экран обновился до «Оплачено 3 из 3» по сокету', /3 из 3/.test(progB || ''), (progB || '').trim())
const cashbackDone = await page.locator('text=/начислен/').first().isVisible().catch(() => false)
check('LIVE: кэшбэк-строка сменилась на «+N начислен»', cashbackDone)
await page.screenshot({ path: `${SHOT}/3-live-closed.png` })
check('сокет-фреймы member_paid получены (2 оплаты)', frames.filter((f) => f.ev === 'member_paid').length >= 2, JSON.stringify(frames.map(f=>f.ev)))
check('сокет-фрейм split_closed получен', frames.some((f) => f.ev === 'split_closed'))

// ---- «Открыть ZAP!» → PIN setup → главная ----
await page.locator('button', { hasText: /Открыть ZAP/ }).click()
await page.waitForSelector('text=Придумайте PIN', { timeout: 8000 }).catch(() => {})
const pinSheet = await page.locator('text=Придумайте PIN').first().isVisible().catch(() => false)
check('inline-шит «Придумайте PIN» показан новому участнику', pinSheet)
await page.screenshot({ path: `${SHOT}/4-pin-setup.png` })
await sleep(400)
await page.keyboard.type('1234', { delay: 60 })
await page.waitForURL(`${BASE}/`, { timeout: 8000 }).catch(() => {})
await sleep(2500)
const onHome = await page.evaluate(() => location.pathname) === '/'
check('после PIN — участник на главной как залогиненный', onHome, await page.evaluate(() => location.pathname))
await page.screenshot({ path: `${SHOT}/5-home-loggedin.png` })

// история участника populated
const gjwt = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('zap:jwt:v1') || 'null') } catch { return null } })
const gboot = await fetch(API + '/bootstrap', { headers: { Authorization: 'Bearer ' + gjwt?.accessToken } }).then(j).catch(() => ({}))
const kinds = (gboot.history || []).map((h) => h.kind)
check('история участника содержит payment', kinds.includes('payment'), JSON.stringify(kinds))
check('участник получил кэшбэк-начисление', (gboot.cashbackEntries || []).length >= 1, `cb=${(gboot.cashbackEntries||[]).length}`)

// session continuity: reload → всё ещё залогинен
await page.reload(); await sleep(2500)
check('session continuity: после reload остаётся на главной', await page.evaluate(() => location.pathname) === '/')

socket.close()
console.log('\nCODE=' + code, 'FRAMES=' + JSON.stringify(frames.map((f) => f.ev)))
console.log('ERRORS:', errs.length ? errs : 'none')
console.log(failed === 0 ? 'PARTICIPANT FLOW: ALL PASS' : `PARTICIPANT FLOW: ${failed} FAILED`)
await browser.close()
process.exit(failed === 0 ? 0 : 1)
