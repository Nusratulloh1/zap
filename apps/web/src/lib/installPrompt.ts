// Установка PWA — РАННИЙ и ДЕТЕРМИНИРОВАННЫЙ показ баннера.
// Видимость баннера НЕ зависит от beforeinstallprompt: показываем по своим
// правилам на онбординге/авторизации/главной (1.5с после первого eligible-экрана,
// один раз за сессию). Кнопка «Установить»: есть stash-событие → prompt(),
// иначе — инструкция (Android-меню / iOS-Safari-шит). Событие стэшится в main.ts
// ДО маунта приложения — это лечит «иногда срабатывает».
import { reactive } from 'vue'
import { toast } from '@/lib/toast'
import { t } from '@/lib/i18n'

export type SheetVariant = 'ios-safari' | 'ios-other' | 'android-other'

interface BipEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALLED_KEY = 'zap:installed'
const SNOOZE_KEY = 'zap:install-snooze'
const SHOWS_KEY = 'zap:install-shows'
const SESSION_SHOWN_KEY = 'zap:install-shown-session'
const SNOOZE_MS = 7 * 24 * 3600 * 1000
const MAX_SHOWS = 5
const SHOW_DELAY_MS = 1500

// экраны, где баннер РАЗРЕШЁН: онбординг, ввод номера, ввод кода, главная.
// Всё остальное (сканер, пад суммы, участники, шэр, live-статус, пред-оплата
// участника, PIN-шиты) — исключено by design (allowlist).
const ELIGIBLE: RegExp[] = [/^\/onboarding/, /^\/auth\/phone/, /^\/auth\/code/, /^\/$/]

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
const ss = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      /* noop */
    }
  },
}

const dbg = (...a: unknown[]) => {
  if (import.meta.env.DEV) console.debug('[install]', ...a)
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

/** Стэш beforeinstallprompt как можно раньше (слушатель ставится из main.ts до маунта). */
export function initInstallCapture() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BipEvent
    installState.canPrompt = true
    dbg('beforeinstallprompt stashed')
  })
  window.addEventListener('appinstalled', () => {
    ls.set(INSTALLED_KEY, '1')
    deferred = null
    installState.canPrompt = false
    installState.banner = false
    installState.sheet = false
    toast.success(t('common.installedToast'))
  })
}

export function markSplitCreated() {
  ls.set('zap:first-split', '1')
}

export function routeAllowed(path: string): boolean {
  return ELIGIBLE.some((re) => re.test(path))
}

/** Причина, по которой баннер сейчас НЕ показывается (или '' если можно). */
function blockReason(path: string): string {
  if (isInstalled()) return 'installed'
  if (ss.get(SESSION_SHOWN_KEY) === '1' && ls.get('zap:install-force') !== '1') return 'already-shown-this-session'
  if (ls.get('zap:install-force') === '1') return ''
  const snooze = Number(ls.get(SNOOZE_KEY) ?? '0')
  if (snooze && Date.now() - snooze < SNOOZE_MS) return 'snoozed'
  if (Number(ls.get(SHOWS_KEY) ?? '0') >= MAX_SHOWS) return 'max-shows'
  if (!routeAllowed(path)) return 'screen-excluded'
  return ''
}

function actuallyShow() {
  if (isInstalled() || installState.banner) return
  installState.banner = true
  ls.set(SHOWS_KEY, String(Number(ls.get(SHOWS_KEY) ?? '0') + 1))
  ss.set(SESSION_SHOWN_KEY, '1')
  dbg('shown')
}

/** Вызывается при каждой смене роута. Показывает баннер по правилам (не по событию). */
export function requestBanner(path: string, _authed?: boolean) {
  clearTimeout(showTimer)
  // ушли с eligible-экрана в середину задачи — прячем
  if (installState.banner && !routeAllowed(path)) {
    installState.banner = false
    dbg('hidden (screen-excluded):', path)
    return
  }
  if (installState.banner || installState.sheet) return
  const reason = blockReason(path)
  if (reason) {
    dbg('not shown:', reason, path)
    return
  }
  dbg('scheduling show in', SHOW_DELAY_MS, 'ms on', path)
  showTimer = window.setTimeout(actuallyShow, SHOW_DELAY_MS)
}

/** Отдельный eligible-момент: экран успеха участника (после первой оплаты). */
export function participantSuccessMoment() {
  clearTimeout(showTimer)
  if (installState.banner || installState.sheet) return
  if (isInstalled()) return dbg('success moment skipped: installed')
  const snooze = Number(ls.get(SNOOZE_KEY) ?? '0')
  if (snooze && Date.now() - snooze < SNOOZE_MS && ls.get('zap:install-force') !== '1')
    return dbg('success moment skipped: snoozed')
  if (Number(ls.get(SHOWS_KEY) ?? '0') >= MAX_SHOWS && ls.get('zap:install-force') !== '1')
    return dbg('success moment skipped: max-shows')
  showTimer = window.setTimeout(actuallyShow, SHOW_DELAY_MS)
}

/** «Установить»: нативный prompt (если событие есть) или инструкция. Всегда что-то делает. */
export async function install() {
  if (deferred) {
    installState.banner = false
    await deferred.prompt()
    const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }))
    if (choice.outcome === 'accepted') {
      ls.set(INSTALLED_KEY, '1')
      window.setTimeout(() => {
        if (ls.get(INSTALLED_KEY) === '1') toast.success(t('common.installedToast'))
      }, 1500)
    } else {
      snooze()
    }
    deferred = null
    installState.canPrompt = false
    return
  }
  // события нет (Chrome ещё/не выстрелил, iOS Safari) → инструкция
  const p = platform()
  installState.sheetVariant = p === 'ios-safari' ? 'ios-safari' : p === 'ios-other' ? 'ios-other' : 'android-other'
  installState.banner = false
  installState.sheet = true
  dbg('no stashed event → instruction sheet', installState.sheetVariant)
}

export function snooze() {
  installState.banner = false
  ls.set(SNOOZE_KEY, String(Date.now()))
  dbg('snoozed 7d')
}

export function closeSheet() {
  installState.sheet = false
}
