// Уклонение от нативной клавиатуры: держим CSS-переменную --kb-inset равной
// перекрытию layout-вьюпорта клавиатурой (visualViewport) и подскрол­ливаем поля.
export function initKeyboardAvoidance() {
  const vv = window.visualViewport
  if (!vv) return

  const update = () => {
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--kb-inset', `${Math.round(inset)}px`)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  update()

  // Коррекция скролла под клавиатурой — МИНИМАЛЬНАЯ, не «в центр»:
  // если поле и так видно при скролле 0 (наши экраны ввода держат поля в
  // верхней половине) — возвращаемся к 0, чтобы шапка не уезжала;
  // иначе скроллим ровно настолько, чтобы поле встало с запасом сверху.
  const correct = () => {
    const el = document.activeElement as HTMLElement | null
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return
    const scroller = document.scrollingElement ?? document.documentElement
    const vvH = window.visualViewport?.height ?? window.innerHeight
    const rect = el.getBoundingClientRect()
    const absTop = rect.top + scroller.scrollTop
    const kb = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb-inset')) || 0
    const visibleH = vvH - kb || vvH
    const target = absTop + rect.height < visibleH - 90 ? 0 : absTop - 120
    if (Math.abs(scroller.scrollTop - Math.max(0, target)) > 2) {
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }
  }

  window.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return
    // браузер сам скроллит поле «в вид» при открытии клавиатуры — правим после
    setTimeout(correct, 250)
    setTimeout(correct, 550)
  })
  vv.addEventListener('resize', () => setTimeout(correct, 60))
}
