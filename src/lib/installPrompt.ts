// Система установки PWA: детекция платформы, захват beforeinstallprompt,
// баннер в стиле ZAP + iOS-инструкция. Показ: после онбординга, со 2-го визита
// или после первого сплита; «×» — снуз 7 дней; максимум 3 показа за всё время.
import { reactive } from 'vue'
import { toast } from '@/lib/toast'

export type SheetVariant = 'ios-safari' | 'ios-other' | 'android-other'

interface BipEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALLED_KEY = 'zap:installed'
const SNOOZE_KEY = 'zap:install-snooze'
const SHOWS_KEY = 'zap:install-shows'
const VISITS_KEY = 'zap:visits'
const SPLIT_KEY = 'zap:first-split'
const SNOOZE_MS = 7 * 24 * 3600 * 1000
const MAX_SHOWS = 3

export const installState = reactive({
  banner: false,
  sheet: false,
  sheetVariant: 'ios-safari' as SheetVariant,
  canPrompt: false,
})

let deferred: BipEvent | null = null
let showTimer = 0

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* noop */
    }
  },
}

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function isInstalled(): boolean {
  return isStandalone() || ls.get(INSTALLED_KEY) === '1'
}

type Platform = 'ios-safari' | 'ios-other' | 'android' | 'other'

export function platform(): Platform {
  const forced = ls.get('zap:force-platform')
  if (forced === 'ios-safari' || forced === 'ios-other' || forced === 'android' || forced === 'other')
    return forced
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  if (ios) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua)
    return otherBrowser ? 'ios-other' : 'ios-safari'
  }
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

// ранний захват события установки (модуль импортируется до маунта приложения)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BipEvent
    installState.canPrompt = true
  })
  window.addEventListener('appinstalled', () => {
    ls.set(INSTALLED_KEY, '1')
    installState.banner = false
    installState.sheet = false
    toast.success('ZAP! установлен 🎉')
  })
  // счётчик визитов: один инкремент на браузерную сессию
  try {
    if (!sessionStorage.getItem('zap:visit-counted')) {
      sessionStorage.setItem('zap:visit-counted', '1')
      ls.set(VISITS_KEY, String(Number(ls.get(VISITS_KEY) ?? '0') + 1))
    }
  } catch {
    /* noop */
  }
}

export function markSplitCreated() {
  ls.set(SPLIT_KEY, '1')
}

/** экраны, где баннер запрещён: сканер, оплата/PIN-флоу, такеоверы, гостевая доля */
const DENIED = [/^\/split\/scan/, /^\/split\/amount/, /^\/split\/[^/]+\/(closed|cashback)/, /^\/s\//, /^\/auth\//, /^\/onboarding/]

export function routeAllowed(path: string): boolean {
  return !DENIED.some((re) => re.test(path))
}

function frequencyAllowed(): boolean {
  if (ls.get('zap:install-force') === '1') return true
  const snooze = Number(ls.get(SNOOZE_KEY) ?? '0')
  if (snooze && Date.now() - snooze < SNOOZE_MS) return false
  if (Number(ls.get(SHOWS_KEY) ?? '0') >= MAX_SHOWS) return false
  const visits = Number(ls.get(VISITS_KEY) ?? '0')
  return visits >= 2 || ls.get(SPLIT_KEY) === '1'
}

/** Запросить показ баннера (после 1.2с покоя) — вызывается из App при смене роута. */
export function requestBanner(path: string, authed: boolean) {
  clearTimeout(showTimer)
  if (installState.banner && !routeAllowed(path)) installState.banner = false
  if (installState.banner || installState.sheet) return
  if (!authed || isInstalled() || !routeAllowed(path) || !frequencyAllowed()) return
  showTimer = window.setTimeout(() => {
    if (isInstalled() || installState.banner) return
    installState.banner = true
    ls.set(SHOWS_KEY, String(Number(ls.get(SHOWS_KEY) ?? '0') + 1))
  }, 1200)
}

/** «Установить»: нативный prompt (Android/Chromium) или инструкция (iOS/прочие). */
export async function install() {
  if (deferred) {
    installState.banner = false
    await deferred.prompt()
    const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }))
    if (choice.outcome === 'accepted') {
      ls.set(INSTALLED_KEY, '1')
      // тост придёт из appinstalled; на случай, если событие не сработает:
      window.setTimeout(() => {
        if (ls.get(INSTALLED_KEY) === '1') toast.success('ZAP! установлен 🎉')
      }, 1500)
    } else {
      snooze()
    }
    deferred = null
    installState.canPrompt = false
    return
  }
  const p = platform()
  installState.sheetVariant = p === 'ios-safari' ? 'ios-safari' : p === 'ios-other' ? 'ios-other' : 'android-other'
  installState.banner = false
  installState.sheet = true
}

export function snooze() {
  installState.banner = false
  ls.set(SNOOZE_KEY, String(Date.now()))
}

export function closeSheet() {
  installState.sheet = false
}
