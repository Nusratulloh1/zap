// Единая система движения (GSAP): токены + глобальный пресс-фидбек.
// Всё на transform/opacity; prefers-reduced-motion отключает несущественное.
import gsap from 'gsap'

export const DUR = {
  fast: 0.12,
  base: 0.2,
  slow: 0.28,
  page: 0.36,
} as const

/** стандартная кривая приложения (совпадает с CSS ease-zap) */
export const EASE = 'power3.out'
export const EASE_SPRING_GENTLE = 'back.out(1.4)' // ~{stiffness:260,damping:24}
export const EASE_SPRING_SNAPPY = 'back.out(2)' // ~{stiffness:420,damping:30}

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Глобальный пресс-фидбек: любой button/.press сжимается при нажатии
 * и пружинит обратно. Один делегированный слушатель на всё приложение.
 */
export function initPressFeedback() {
  // reduce-режим не выключает отклик, а смягчает его: без пружины и y-сдвига
  let active: HTMLElement | null = null

  const release = () => {
    if (!active) return
    const soft = reducedMotion()
    gsap.to(active, {
      scale: 1,
      y: 0,
      duration: soft ? 0.12 : 0.4,
      ease: soft ? 'power2.out' : EASE_SPRING_SNAPPY,
      overwrite: 'auto',
    })
    active = null
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        'button, [role="button"], .press',
      ) as HTMLElement | null
      if (!el || (el as HTMLButtonElement).disabled) return
      active = el
      const soft = reducedMotion()
      const small = el.offsetWidth <= 56 && el.offsetHeight <= 56
      const primary = el.classList.contains('bg-lime') || el.classList.contains('bg-ink')
      gsap.to(el, {
        scale: soft ? 0.97 : small ? 0.9 : 0.96,
        y: !soft && primary && !small ? 1 : 0,
        duration: soft ? 0.1 : DUR.fast,
        ease: 'power2.out',
        overwrite: 'auto',
      })
    },
    { capture: true, passive: true },
  )
  document.addEventListener('pointerup', release, { capture: true, passive: true })
  document.addEventListener('pointercancel', release, { capture: true, passive: true })
}

/** стаггер появления детей контейнера (для контента шитов и т.п.) */
export function staggerIn(container: HTMLElement, delay = 0.03, startDelay = 0) {
  if (reducedMotion()) return
  const children = Array.from(container.children) as HTMLElement[]
  // immediateRender у fromTo прячет детей сразу, даже с startDelay —
  // контент не успевает мигнуть видимым до начала анимации
  gsap.fromTo(
    children,
    { opacity: 0, y: 10 },
    {
      opacity: 1,
      y: 0,
      duration: DUR.slow,
      ease: EASE,
      stagger: delay,
      delay: startDelay,
      overwrite: 'auto',
      clearProps: 'opacity,transform',
    },
  )
}

export { gsap }
