// Runtime-доказательство анимаций: сэмплирует computed transform/opacity ВО ВРЕМЯ движения.
// Использование: BASE_URL=... [REDUCED=1] node scripts/motion-proof.mjs
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const REDUCED = process.env.REDUCED === '1'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: REDUCED ? 'reduce' : 'no-preference',
})
const page = await ctx.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const record = (name, ok, evidence) => {
  results.push({ name, ok, evidence })
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  ' + evidence)
}

await page.addInitScript(() => {
  localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
})

// сэмплер: N срезов transform/opacity элемента по селектору
async function sample(selector, times = [40, 120, 220], prop = 'both') {
  const out = []
  const t0 = Date.now()
  for (const t of times) {
    const wait = t - (Date.now() - t0)
    if (wait > 0) await sleep(wait)
    const v = await page.evaluate(
      ([sel]) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const cs = getComputedStyle(el)
        return { transform: cs.transform, opacity: cs.opacity }
      },
      [selector],
    )
    out.push(v)
  }
  return out
}

const isIdentity = (s) => !s || s.transform === 'none' || s.transform === 'matrix(1, 0, 0, 1, 0, 0)'
const midFlight = (samples) => samples.some((s) => s && (!isIdentity(s) || Number(s.opacity) < 0.99))

// ---------- 1. переход между роутами ----------
{
  await page.goto(BASE + '/')
  await sleep(1800)
  // кликаем на аватар → /profile и сэмплируем входящую страницу
  await page.locator('button[aria-label="Профиль"]').first().click()
  const samples = await sample(
    '.route-forward-enter-active, .route-fade-enter-active, .route-up-enter-active, .route-back-enter-active',
    [30, 100, 200],
  )
  const sawActive = samples.some((s) => s !== null)
  record(
    'route transition (enter-active class present + mid-flight styles)',
    REDUCED ? true : sawActive && midFlight(samples),
    JSON.stringify(samples),
  )
}

// ---------- 2. кнопка: press scale < 1 ----------
{
  await page.goto(BASE + '/profile')
  await sleep(1200)
  const btn = page.locator('button[aria-label="Назад"]')
  await btn.dispatchEvent('pointerdown')
  await sleep(90)
  const t = await page.evaluate(() => {
    const el = document.querySelector('button[aria-label="Назад"]')
    return el ? getComputedStyle(el).transform : null
  })
  const m = t && t.match(/matrix\(([\d.]+),/)
  const scale = m ? Number(m[1]) : 1
  await btn.dispatchEvent('pointerup')
  record('press feedback (scale < 1 on pointerdown)', scale < 0.99, 'scale=' + scale.toFixed(3))
}

// ---------- 3. BottomSheet: transform в полёте ----------
{
  await page.locator('button', { hasText: /Добавить карту/ }).click()
  const samples = await sample('.rounded-t-card', [40, 120, 240])
  record('bottom sheet spring (translateY mid-flight)', REDUCED ? true : midFlight(samples), JSON.stringify(samples))
  await page.keyboard.press('Escape').catch(() => {})
  await page.locator('.fixed.inset-0.z-40').click({ position: { x: 195, y: 100 } }).catch(() => {})
  await sleep(500)
}

// ---------- 4. тост: входная анимация ----------
{
  await page.goto(BASE + '/debts')
  await sleep(1500)
  // тост появляется после мок-латентности: кадры ловим ВНУТРИ страницы (rAF),
  // кросс-процессный сэмплинг для 320мс-окна слишком медленный
  await page.evaluate(() => {
    const w = window
    w.__toastFrames = []
    const mo = new MutationObserver(() => {
      const el = document.querySelector('[data-zap-toast]')
      if (el && !w.__toastWatching) {
        w.__toastWatching = true
        const t0 = performance.now()
        const tick = () => {
          const cs = getComputedStyle(el)
          w.__toastFrames.push({ t: Math.round(performance.now() - t0), transform: cs.transform, opacity: cs.opacity })
          if (performance.now() - t0 < 400) requestAnimationFrame(tick)
        }
        tick()
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
  })
  await page.getByRole('button', { name: 'Напомнить', exact: true }).first().click()
  await sleep(1600)
  const frames = await page.evaluate(() => window.__toastFrames ?? [])
  const appeared = frames.length > 0
  record(
    'toast entrance (in-page frames show mid-flight)',
    REDUCED ? appeared : appeared && midFlight(frames),
    JSON.stringify(frames.slice(0, 3)) + ` …(${frames.length} frames)`,
  )
  await sleep(800)
}

// ---------- 5. пад суммы: поп цифры ----------
{
  await page.evaluate(() => sessionStorage.removeItem('zap:amount-draft')).catch(() => {})
  await page.goto(BASE + '/split/amount')
  await sleep(1000)
  await page.locator('button', { hasText: /^\s*5\s*$/ }).last().dispatchEvent('pointerdown')
  const samples = await sample('.achar-enter-active, .digit-enter-active', [30, 80, 140])
  const saw = samples.some((s) => s !== null)
  record('amount digit pop (enter-active present)', REDUCED ? true : saw, JSON.stringify(samples))
}

// ---------- 6. фильтр кэшбэка: уходящие absolute+fade, остальные FLIP-едут, в конце — без наслоений ----------
{
  await page.goto(BASE + '/cashback')
  await sleep(1600)
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const chip = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Zaytun Crew')
        const out = []
        const t0 = performance.now()
        const tick = () => {
          const leaving = document.querySelector('.alist-leave-active')
          const moving = document.querySelector('.alist-move')
          out.push({
            t: Math.round(performance.now() - t0),
            leave: leaving
              ? { pos: getComputedStyle(leaving).position, op: getComputedStyle(leaving).opacity }
              : null,
            move: moving ? getComputedStyle(moving).transform : null,
          })
          if (performance.now() - t0 < 600) requestAnimationFrame(tick)
          else resolve(out)
        }
        chip?.click()
        tick()
      }),
  )
  const leaveOk = frames.some((f) => f.leave && f.leave.pos === 'absolute' && Number(f.leave.op) < 1)
  const moveOk = frames.some((f) => f.move && f.move !== 'none' && f.move !== 'matrix(1, 0, 0, 1, 0, 0)')
  record(
    'filter FLIP (leaving=absolute+fading, remaining moving)',
    REDUCED ? true : leaveOk && moveOk,
    `leaveOk=${leaveOk} moveOk=${moveOk} frames=${frames.length}`,
  )
  // после успокоения: ни одна пара строк не пересекается
  await sleep(700)
  const overlaps = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.alist-move, [data-v-app] .min-h-\\[72px\\]')]
    const items = [...document.querySelectorAll('div')].filter(
      (d) => d.className && String(d.className).includes('min-h-[72px]'),
    )
    const boxes = items.map((el) => el.getBoundingClientRect()).filter((b) => b.height > 0)
    let bad = 0
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ix > 1 && iy > 1) bad++
      }
    return { count: boxes.length, bad }
  })
  record('filter end-state (no overlapping rows)', overlaps.bad === 0, JSON.stringify(overlaps))
}

// ---------- 7. табы истории: полный своп контейнера out-in ----------
{
  await page.goto(BASE + '/history')
  await sleep(1600)
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const chip = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Кэшбэк')
        const out = []
        const t0 = performance.now()
        const tick = () => {
          const el = document.querySelector('.listswap-leave-active, .listswap-enter-active')
          out.push({
            t: Math.round(performance.now() - t0),
            cls: el ? el.className.split(' ').find((c) => c.startsWith('listswap')) : null,
            op: el ? getComputedStyle(el).opacity : null,
          })
          if (performance.now() - t0 < 500) requestAnimationFrame(tick)
          else resolve(out)
        }
        chip?.click()
        tick()
      }),
  )
  const swapOk = frames.some((f) => f.cls && Number(f.op) < 1)
  record('history tab swap (container out-in mid-flight)', REDUCED ? true : swapOk, `swapOk=${swapOk} frames=${frames.length}`)
}

// ---------- 8. AnimatedAmount: цифры живут (не перемонтируются), глайдят, scale-ступень анимируется ----------
{
  await page.evaluate(() => sessionStorage.removeItem('zap:amount-draft')).catch(() => {})
  await page.goto(BASE + '/split/amount')
  await sleep(1000)
  const res = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const press = (label) => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
          btn?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        }
        const digitsEls = () => [...document.querySelectorAll('.achar')].filter((e) => e.textContent.trim() !== '')
        const run = async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms))
          // 5,5,5 → метим существующие цифры
          press('5')
          await wait(260)
          press('5')
          await wait(260)
          press('5')
          await wait(320)
          const before = digitsEls()
          before.forEach((e) => (e.dataset.marked = '1'))
          // четвёртая пятёрка: «555» → «5 555» — регруппировка
          const frames = []
          const t0 = performance.now()
          press('5')
          const tick = () => {
            const moving = document.querySelector('.achar-move')
            frames.push({ t: Math.round(performance.now() - t0), move: moving ? getComputedStyle(moving).transform : null })
            if (performance.now() - t0 < 350) requestAnimationFrame(tick)
          }
          tick()
          await wait(400)
          const after = digitsEls()
          const markedAlive = after.filter((e) => e.dataset.marked === '1').length
          const glide = frames.some((f) => f.move && f.move !== 'none' && f.move !== 'matrix(1, 0, 0, 1, 0, 0)')
          // добираем до 6 цифр → 7 символов → scale-ступень; ловим промежуточные значения
          press('5')
          await wait(260)
          const scaleFrames = []
          const s0 = performance.now()
          press('5')
          const tick2 = () => {
            const el = document.querySelector('.amount-scale')
            const m = el ? getComputedStyle(el).transform.match(/matrix\(([\d.]+),/) : null
            scaleFrames.push({ t: Math.round(performance.now() - s0), scale: m ? Number(m[1]) : 1 })
            if (performance.now() - s0 < 320) requestAnimationFrame(tick2)
          }
          tick2()
          await wait(380)
          const intermediate = scaleFrames.some((f) => f.scale > 0.82 && f.scale < 0.99)
          const settled = scaleFrames[scaleFrames.length - 1]?.scale ?? 1
          resolve({ markedAlive, total: after.length, glide, intermediate, settled, scaleSample: scaleFrames.filter((_, i) => i % 6 === 0) })
        }
        run()
      }),
  )
  record(
    'amount digits persist (same DOM nodes) + FLIP glide on regroup',
    res.markedAlive >= 3 && (REDUCED ? true : res.glide),
    `markedAlive=${res.markedAlive}/${res.total} glide=${res.glide}`,
  )
  record(
    'amount size step animates scale (not font-size snap)',
    REDUCED ? true : res.intermediate && res.settled < 0.85,
    `intermediate=${res.intermediate} settled=${res.settled} samples=${JSON.stringify(res.scaleSample)}`,
  )
}

// ---------- 9. скролл при переходах: сброс до enter, входящая не прыгает ----------
{
  await page.goto(BASE + '/')
  await sleep(1800)
  const fwd = await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.scrollTo(0, document.body.scrollHeight)
        const savedY = Math.round(window.scrollY)
        const frames = []
        const btn = document.querySelector('button[aria-label="Профиль"]')
        const t0 = performance.now()
        const tick = () => {
          const el = document.querySelector('[class*="-enter-active"]')
          frames.push({
            t: Math.round(performance.now() - t0),
            y: Math.round(window.scrollY),
            top: el ? Math.round(el.getBoundingClientRect().top) : null,
          })
          if (performance.now() - t0 < 500) requestAnimationFrame(tick)
          else resolve({ savedY, frames })
        }
        btn?.click()
        tick()
      }),
  )
  const enterFrames = fwd.frames.filter((f) => f.top !== null)
  // усевшаяся позиция входящей = 0 (документ на нуле); допуск 2px
  const noJump = enterFrames.length > 0 && enterFrames.every((f) => f.top <= 2)
  const yZeroBeforeEnter = enterFrames.length > 0 && enterFrames[0].y === 0
  record(
    'scrolled nav: scroll reset before enter starts + incoming never overshoots (>2px)',
    fwd.savedY > 0 && yZeroBeforeEnter && noJump,
    `savedY=${fwd.savedY} firstEnter=${JSON.stringify(enterFrames[0] ?? null)} maxTop=${Math.max(...enterFrames.map((f) => f.top), -1)}`,
  )

  // ---------- 10. назад: savedPosition восстанавливается ПОСЛЕ enter ----------
  await sleep(600)
  await page.goBack()
  await sleep(1200)
  const backY = await page.evaluate(() => Math.round(window.scrollY))
  record(
    'back nav: savedPosition restored after enter completes',
    Math.abs(backY - fwd.savedY) <= 2,
    `backY=${backY} savedY=${fwd.savedY}`,
  )
}

// ---------- 11-14. install-баннер PWA ----------
{
  const mkCtx = async (init) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: REDUCED ? 'reduce' : 'no-preference' })
    const p = await c.newPage()
    await p.addInitScript((extra) => {
      localStorage.setItem('zap:session:v1', JSON.stringify({ stage: 'authed', phone: '901234221', pin: '7777' }))
      localStorage.setItem('zap:visits', '2') // триггер «2-й визит»
      for (const [k, v] of Object.entries(extra ?? {})) localStorage.setItem(k, v)
    }, init)
    return [c, p]
  }

  // 11: баннер появляется с анимированным входом; стаб beforeinstallprompt ловится
  const [c1, p1] = await mkCtx()
  await p1.goto(BASE + '/')
  await p1.evaluate(() => {
    window.__promptCalled = 0
    const e = new Event('beforeinstallprompt')
    e.prompt = () => {
      window.__promptCalled++
      return Promise.resolve()
    }
    e.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(e)
    // кадры входа баннера
    window.__bannerFrames = []
    const mo = new MutationObserver(() => {
      const el = document.querySelector('[data-install-banner]')
      if (el && !window.__bw) {
        window.__bw = true
        const t0 = performance.now()
        const tick = () => {
          const wrap = el.parentElement
          window.__bannerFrames.push({ t: Math.round(performance.now() - t0), tf: getComputedStyle(wrap).transform, op: getComputedStyle(wrap).opacity })
          if (performance.now() - t0 < 450) requestAnimationFrame(tick)
        }
        tick()
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
  })
  await p1.waitForTimeout(2200)
  const frames = await p1.evaluate(() => window.__bannerFrames ?? [])
  const visible = await p1.locator('[data-install-banner]').isVisible()
  const animated = frames.some((f) => (f.tf && f.tf !== 'none' && f.tf !== 'matrix(1, 0, 0, 1, 0, 0)') || Number(f.op) < 0.99)
  record('install banner appears (animated entrance)', visible && (REDUCED ? true : animated), `visible=${visible} frames=${frames.length}`)

  // 12: «Установить» зовёт prompt() на стабе
  await p1.getByRole('button', { name: 'Установить', exact: true }).click()
  await p1.waitForTimeout(400)
  const promptCalled = await p1.evaluate(() => window.__promptCalled)
  record('install CTA calls prompt() on stubbed event', promptCalled === 1, `promptCalled=${promptCalled}`)
  await c1.close()

  // 13: «×» снузит на 7 дней — после перезагрузки баннера нет
  const [c2, p2] = await mkCtx()
  await p2.goto(BASE + '/')
  await p2.waitForTimeout(2000)
  await p2.locator('[data-install-banner] button[aria-label="Скрыть"]').click()
  await p2.waitForTimeout(400)
  await p2.reload()
  await p2.waitForTimeout(2200)
  const afterSnooze = await p2.locator('[data-install-banner]').count()
  const snoozeTs = await p2.evaluate(() => Number(localStorage.getItem('zap:install-snooze') ?? '0'))
  record('install banner snoozed by «×» (absent after reload, ts persisted)', afterSnooze === 0 && snoozeTs > 0, `count=${afterSnooze} ts=${snoozeTs > 0}`)
  await c2.close()

  // 14: в standalone (установлено) баннер не рендерится никогда
  const [c3, p3] = await mkCtx()
  await p3.addInitScript(() => {
    const orig = window.matchMedia.bind(window)
    window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : orig(q))
  })
  await p3.goto(BASE + '/')
  await p3.waitForTimeout(2400)
  const inStandalone = await p3.locator('[data-install-banner]').count()
  record('install banner never renders in standalone', inStandalone === 0, `count=${inStandalone}`)
  await c3.close()
}

// ---------- 15. пилл-нав: точки → пад суммы кроссфейдом, пилл персистентен, скролл возвращается ----------
{
  await page.goto(BASE + '/')
  await sleep(1800)
  const res = await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.scrollTo(0, document.body.scrollHeight)
        const savedY = Math.round(window.scrollY)
        const nav = document.querySelector('nav .zap-tabbar')
        if (nav) nav.dataset.pillMarked = '1'
        const seen = new Set()
        const t0 = performance.now()
        const tick = () => {
          document.querySelectorAll('[class*="-enter-active"], [class*="-leave-active"]').forEach((el) => {
            el.className.split(' ').filter((c) => c.includes('route-')).forEach((c) => seen.add(c))
          })
          if (performance.now() - t0 < 500) requestAnimationFrame(tick)
          else resolve({ savedY, classes: [...seen] })
        }
        document.querySelector('nav button[aria-label="/split/amount"]')?.click()
        tick()
      }),
  )
  await sleep(500)
  const url = await page.evaluate(() => location.pathname)
  const fadeOk = res.classes.some((c) => c.startsWith('route-fade'))
  const noSlide = !res.classes.some((c) => c.startsWith('route-forward') || c.startsWith('route-back'))
  record(
    'pill nav: dots open /split/amount with crossfade (no slide)',
    url === '/split/amount' && (REDUCED ? true : fadeOk) && noSlide,
    `url=${url} classes=${JSON.stringify(res.classes)}`,
  )
  const pillPersisted = await page.evaluate(() => document.querySelector('nav .zap-tabbar')?.dataset.pillMarked === '1')
  record('pill nav: element identity persists across the switch', pillPersisted, `marked=${pillPersisted}`)

  await page.evaluate(() => document.querySelector('nav button[aria-label="/"]')?.click())
  await sleep(1100)
  const backY = await page.evaluate(() => Math.round(window.scrollY))
  record('pill nav: home scroll restored after returning from pad', Math.abs(backY - res.savedY) <= 2, `backY=${backY} savedY=${res.savedY}`)
}

console.log(REDUCED ? '--- reduced-motion mode: only smoke-level checks ---' : '')
const failed = results.filter((r) => !r.ok)
console.log(failed.length ? 'MOTION PROOF FAILED: ' + failed.map((f) => f.name).join(' | ') : 'MOTION PROOF: ALL PASS')
await browser.close()
process.exit(failed.length ? 1 : 0)
