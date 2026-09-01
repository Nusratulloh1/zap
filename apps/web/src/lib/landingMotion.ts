// Движение лендинга: инерционный скролл (Lenis) + появления и привязанные
// к прокрутке эффекты (GSAP ScrollTrigger).
//
// ВАЖНО: в отличие от остального приложения, лендинг НЕ отключает движение
// по prefers-reduced-motion — это осознанное решение владельца продукта.
// У многих пользователей Windows системная анимация выключена по умолчанию,
// и презентационная страница выглядела полностью статичной: без плавного
// скролла, без переходов по якорям, без появлений. Внутри приложения правило
// продолжает работать как прежде (см. reducedMotion в @/lib/motion).
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null
let rafId = 0

const EASE_OUT_EXPO = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))

/** Плавный инерционный скролл + синхронизация со ScrollTrigger. */
export function startSmoothScroll() {
  if (lenis) return
  lenis = new Lenis({
    duration: 1.15,
    easing: EASE_OUT_EXPO,
    smoothWheel: true,
    // Lenis по умолчанию сам глушит плавность при prefers-reduced-motion —
    // для лендинга это выключено вместе с остальными гейтами (см. шапку файла)
    respectReducedMotion: false,
    // на тач-устройствах оставляем нативную инерцию: она лучше и не конфликтует
    // с pull-to-refresh и жестами браузера
    syncTouch: false,
  })
  lenis.on('scroll', ScrollTrigger.update)
  const raf = (time: number) => {
    lenis?.raf(time)
    rafId = requestAnimationFrame(raf)
  }
  rafId = requestAnimationFrame(raf)
}

/** Пересчёт позиций триггеров: после догрузки картинок геометрия меняется. */
export function refreshMotion() {
  ScrollTrigger.refresh()
}

/**
 * Переход по якорю: ведём его через Lenis, иначе браузер прыгает мгновенно
 * и инерционный скролл выглядит сломанным.
 */
export function scrollToTarget(selector: string) {
  const el = document.querySelector(selector)
  if (!el) return
  if (lenis) {
    lenis.scrollTo(el as HTMLElement, { duration: 1.15, easing: EASE_OUT_EXPO })
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

let snapCleanup: (() => void) | null = null

/**
 * Посекционная прокрутка: когда колесо останавливается рядом с началом
 * секции, Lenis доводит страницу до неё. Порог намеренно мягкий — далеко
 * прокрутку не «утаскивает», так что читать длинные секции ничего не мешает.
 */
export function snapSections(sections: HTMLElement[]) {
  if (!lenis || !sections.length) return
  const engine = lenis
  let timer = 0
  let settling = false

  const settle = () => {
    if (settling) return
    const y = window.scrollY
    const max = document.documentElement.scrollHeight - window.innerHeight
    // у краёв страницы не мешаем: там снап только раздражает
    if (y < 40 || y > max - 40) return

    let best = 0
    let bestDist = Infinity
    for (const s of sections) {
      const top = s.getBoundingClientRect().top + y
      const dist = Math.abs(top - y)
      if (dist < bestDist) {
        bestDist = dist
        best = top
      }
    }
    if (bestDist < 6 || bestDist > window.innerHeight * 0.34) return
    settling = true
    engine.scrollTo(best, {
      duration: 0.65,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      onComplete: () => {
        settling = false
      },
    })
  }

  const onScroll = () => {
    if (settling) return
    clearTimeout(timer)
    timer = window.setTimeout(settle, 140)
  }

  engine.on('scroll', onScroll)
  snapCleanup = () => {
    clearTimeout(timer)
    engine.off('scroll', onScroll)
  }
}

export function stopSmoothScroll() {
  cancelAnimationFrame(rafId)
  snapCleanup?.()
  snapCleanup = null
  lenis?.destroy()
  lenis = null
  ScrollTrigger.getAll().forEach((t) => t.kill())
}

/**
 * Строки заголовка выезжают из-под маски: каждая строка обрезана своим
 * контейнером и поднимается снизу. Ключевой приём заглавных блоков референса.
 */
export function revealLines(lines: Element[], opts: { delay?: number; scroll?: boolean } = {}) {
  if (!lines.length) return
  const tween = {
    yPercent: 108,
    opacity: 0,
    duration: 1.05,
    ease: 'expo.out',
    stagger: 0.11,
    delay: opts.delay ?? 0,
  }
  if (opts.scroll === false) {
    gsap.from(lines, tween)
    return
  }
  gsap.from(lines, {
    ...tween,
    scrollTrigger: { trigger: lines[0].parentElement ?? lines[0], start: 'top 88%', once: true },
  })
}

/** Появление блока: подъём + расфокус, как у текстовых колонок референса. */
export function revealOnScroll(
  el: Element | Element[],
  opts: { y?: number; stagger?: number; delay?: number; scroll?: boolean } = {},
) {
  const targets = Array.isArray(el) ? el : [el]
  if (!targets.length) return
  const tween = {
    y: opts.y ?? 30,
    opacity: 0,
    filter: 'blur(9px)',
    duration: 0.95,
    ease: 'power3.out',
    delay: opts.delay ?? 0,
    stagger: opts.stagger ?? 0.09,
    clearProps: 'filter',
  }
  if (opts.scroll === false) {
    gsap.from(targets, tween)
    return
  }
  gsap.from(targets, {
    ...tween,
    scrollTrigger: { trigger: targets[0] as Element, start: 'top 86%', once: true },
  })
}

/** Лёгкий параллакс: элемент едет медленнее полосы прокрутки. */
export function parallax(el: Element, amount = 60) {
  gsap.to(el, {
    y: -amount,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
  })
}

/**
 * Закреплённая секция: страница «останавливается», а слайды внутри сменяют
 * друг друга по мере прокрутки. Текст и аппарат уезжают в разные стороны,
 * поэтому переход читается как смена кадра, а не как простое затухание.
 * Один экран прокрутки — один переход.
 */
export function pinnedSlides(section: HTMLElement, inner: HTMLElement, rows: HTMLElement[]) {
  if (rows.length < 2) return

  const slides = rows.map((r) => {
    const device = r.querySelector('.lp-device') as HTMLElement | null
    return {
      col: r.querySelector('.lp-col') as HTMLElement | null,
      // прячем именно сцену: на ней лежит подсветка «от пола», иначе от
      // невидимых слайдов остаются три наложенных пятна света
      stage: r.querySelector('.lp-stage') as HTMLElement | null,
      device,
      // базовый наклон аппарата: слайд стоит «в три четверти», а не анфас
      deg: Number(device?.dataset.tilt ?? 0),
    }
  })

  // Все состояния задаём явными fromTo: при обычных to() GSAP берёт за
  // начало текущее значение в DOM, и после ScrollTrigger.refresh() посреди
  // перехода слайды застревали полупрозрачными друг на друге.
  const hidden = (s: (typeof slides)[number], dir: 1 | -1) => ({
    col: { autoAlpha: 0, y: 70 * dir },
    stage: { autoAlpha: 0, y: 96 * dir },
    device: { scale: 0.9, rotateY: s.deg * (dir > 0 ? 1.9 : 0.2) },
  })
  const shown = (s: (typeof slides)[number]) => ({
    col: { autoAlpha: 1, y: 0 },
    stage: { autoAlpha: 1, y: 0 },
    device: { scale: 1, rotateY: s.deg },
  })

  slides.forEach((s, i) => {
    const state = i === 0 ? shown(s) : hidden(s, 1)
    gsap.set(s.col, state.col)
    gsap.set(s.stage, state.stage)
    gsap.set(s.device, state.device)
  })

  // на каждый слайд — один экран прокрутки; переход занимает его часть,
  // остальное слайд просто стоит, иначе кадр не успевает прочитаться
  const HOLD = 0.4
  const total = rows.length - 1 + HOLD

  // высоту под закрепление резервируем сами: автоматическая распорка
  // ScrollTrigger в этой вёрстке оставалась нулевой, и следующая секция
  // наезжала на закреплённую
  const setHeight = () => {
    section.style.height = (total + 1) * window.innerHeight + 'px'
  }
  setHeight()

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + total * window.innerHeight,
      scrub: 1.1,
      pin: inner,
      pinSpacing: false,
      anticipatePin: 1,
      onRefreshInit: setHeight,
    },
  })

  const OUT = 'power2.inOut'
  const IN = 'power3.out'

  for (let i = 1; i < slides.length; i++) {
    const prev = slides[i - 1]
    const next = slides[i]
    const at = i - 1 + HOLD

    tl.fromTo(prev.col, shown(prev).col, { ...hidden(prev, -1).col, duration: 0.4, ease: OUT }, at)
      .fromTo(prev.stage, shown(prev).stage, { ...hidden(prev, -1).stage, duration: 0.4, ease: OUT }, at)
      .fromTo(prev.device, shown(prev).device, { ...hidden(prev, -1).device, duration: 0.4, ease: OUT }, at)
      .fromTo(next.col, hidden(next, 1).col, { ...shown(next).col, duration: 0.5, ease: IN }, at + 0.3)
      .fromTo(next.stage, hidden(next, 1).stage, { ...shown(next).stage, duration: 0.5, ease: IN }, at + 0.3)
      .fromTo(next.device, hidden(next, 1).device, { ...shown(next).device, duration: 0.5, ease: IN }, at + 0.3)
  }
  // хвост: последний слайд стоит перед тем, как секция отпустит прокрутку
  tl.to({}, { duration: HOLD })
}

/** Прокрутка к произвольной позиции — используется для слайдов внутри пина. */
export function scrollToY(y: number) {
  if (lenis) {
    lenis.scrollTo(y, { duration: 1.15, easing: EASE_OUT_EXPO })
    return
  }
  window.scrollTo({ top: y, behavior: 'smooth' })
}

/** Первое появление аппарата: поднимается и «встаёт» на место. */
export function riseIn(el: Element, opts: { delay?: number } = {}) {
  gsap.from(el, {
    y: 90,
    scale: 0.92,
    opacity: 0,
    duration: 1.35,
    ease: 'expo.out',
    delay: opts.delay ?? 0,
  })
}

/**
 * Герой уходит «вглубь»: при прокрутке заголовок отдаляется и гаснет,
 * оставаясь фоном для следующей секции — узнаваемый приём референса.
 */
export function heroOut(el: Element) {
  gsap.to(el, {
    scale: 0.88,
    opacity: 0.1,
    y: -30,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 10%', end: '+=560', scrub: 0.5 },
  })
}

/** Горизонтальный дрейф ленты экранов на прокрутке. */
export function drift(el: Element, amount = 120) {
  gsap.fromTo(
    el,
    { x: amount },
    {
      x: -amount,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    },
  )
}

/** Счётчик, «докручивающийся» при появлении. */
export function countUpOnScroll(el: Element, to: number, suffix = '') {
  const obj = { v: 0 }
  const write = () => {
    el.textContent = Math.round(obj.v).toLocaleString('ru-RU') + suffix
  }
  gsap.to(obj, {
    v: to,
    duration: 1.6,
    ease: 'power2.out',
    onUpdate: write,
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
  })
}
