// Темы: light = утверждённый дизайн, dark = свой дизайн в бренд-языке.
// Плюс динамический <meta name="theme-color"> — статус-бар подхватывает
// цвет верхней зоны текущего экрана в активной теме.
import { reactive } from 'vue'
import { reducedMotion } from '@/lib/motion'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'zap:theme'

function initialTheme(): Theme {
  // дефолт — светлая (утверждённый дизайн); тёмная только по явному выбору
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return 'light'
  } catch {
    return 'light'
  }
}

export const themeState = reactive({ theme: initialTheme() })

const LIME = '#DDFF33'
const DARK_BG = '#0E0E0C'

// верх экрана в светлой теме; первый матч выигрывает
const LIGHT_TOP: Array<[RegExp, string]> = [
  [/^\/onboarding/, LIME],
  [/^\/split\/amount/, LIME],
  [/^\/split\/[^/]+\/closed/, LIME],
  [/^\/split\/scan/, '#151513'],
  [/^\/split\/[^/]+\/save-group/, '#F2F0EA'],
  [/^\/split\/[^/]+\/cashback/, '#FFFFFF'],
  [/^\/split\/[^/]+\/share/, '#FFFFFF'],
  [/^\/auth\//, '#FFFFFF'],
  [/^\/s\//, '#FFFFFF'],
  [/^\/$/, DARK_BG], // главная: тёмный hero сверху
  // разделы и остальной сплит-флоу — белые страницы (bg-paper)
  [/^\/(history|debts|cashback|profile|groups)/, '#FFFFFF'],
  [/^\/split\//, '#FFFFFF'],
]
const LIGHT_DEFAULT = '#EFEDE6'

// statement-экраны выглядят одинаково в обеих темах
const THEME_AGNOSTIC = [/^\/onboarding/, /^\/split\/amount/, /^\/split\/[^/]+\/closed/, /^\/split\/scan/, /^\/$/]

// верх тёмной темы повторяет реальный фон: paper → surface, cream/dune → bg
const DARK_OF: Record<string, string> = {
  '#FFFFFF': '#1A1916',
  '#F2F0EA': DARK_BG,
  '#EFEDE6': DARK_BG,
}

export function themeColorFor(path: string, theme: Theme = themeState.theme): string {
  const light = LIGHT_TOP.find(([re]) => re.test(path))?.[1] ?? LIGHT_DEFAULT
  if (theme === 'light') return light
  if (THEME_AGNOSTIC.some((re) => re.test(path))) return light
  return DARK_OF[light] ?? DARK_BG
}

let lastPath = '/'

export function applyThemeColor(path?: string) {
  if (path !== undefined) lastPath = path
  const color = themeColorFor(lastPath)
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = color
  })
}

function applyTheme(theme: Theme) {
  themeState.theme = theme
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* noop */
  }
  applyThemeColor()
}

export function setTheme(theme: Theme) {
  applyTheme(theme)
}

/** Переключение с круговым раскрытием от координат кнопки (View Transitions);
 *  фолбэк — кроссфейд 250ms; при reduce — мгновенно. */
export function toggleTheme(x?: number, y?: number) {
  const next: Theme = themeState.theme === 'dark' ? 'light' : 'dark'

  if (reducedMotion()) {
    applyTheme(next)
    return
  }

  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
  if (doc.startViewTransition && x !== undefined && y !== undefined) {
    const vt = doc.startViewTransition(() => applyTheme(next))
    void vt.ready.then(() => {
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    return
  }

  // фолбэк: плавный переход цветов без вспышки
  document.documentElement.classList.add('theme-xfade')
  applyTheme(next)
  window.setTimeout(() => document.documentElement.classList.remove('theme-xfade'), 300)
}

/** Применить тему при старте (data-theme уже выставлен inline-скриптом в index.html). */
export function initTheme() {
  applyTheme(themeState.theme)
}
