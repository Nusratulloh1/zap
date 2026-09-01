// Интернационализация: uz (основной рынок) / ru / en.
//
// Локаль выбирается ДО первой отрисовки — иначе виден кадр на чужом языке.
// Порядок: сохранённый выбор → профиль пользователя (приходит позже, см.
// applyLocale) → navigator.language → uz.
import { createI18n } from 'vue-i18n'
import uz from '@zap/locales/uz.json'
import ru from '@zap/locales/ru.json'
import en from '@zap/locales/en.json'

export const LOCALES = ['uz', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Названия на своём языке — так их и показываем в переключателе. */
export const LOCALE_NAMES: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
}

const LS_KEY = 'zap:locale'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

/** Язык браузера → наш; всё, что не ru/en, считаем узбекским рынком. */
function fromNavigator(): Locale {
  if (typeof navigator === 'undefined') return 'uz'
  for (const raw of navigator.languages ?? [navigator.language]) {
    const tag = String(raw).toLowerCase()
    if (tag.startsWith('uz')) return 'uz'
    if (tag.startsWith('ru')) return 'ru'
    if (tag.startsWith('en')) return 'en'
  }
  return 'uz'
}

export function storedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LS_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

export const initialLocale: Locale = storedLocale() ?? fromNavigator()

/**
 * Русская плюрализация: 3 формы (1 файл | 2 файла | 5 файлов).
 * vue-i18n сам такого не умеет — правило задаём явно.
 * uz/en остаются на стандартном правиле (1 | много).
 */
function ruPlural(choice: number, choicesLength: number): number {
  if (choicesLength < 3) return choice === 1 ? 0 : 1
  const n = Math.abs(choice)
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 0
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1
  return 2
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: 'ru',
  messages: { uz, ru, en },
  pluralRules: { ru: ruPlural },
  // отсутствующий ключ на проде не должен ронять экран — покажем сам ключ
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
})

/** Текущая локаль вне компонентов (сторы, api, тосты). */
export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

/** Перевод вне компонентов — та же функция, что и в шаблонах. */
export const t = i18n.global.t

/**
 * Применить локаль: обновляет i18n, <html lang> и сохраняет выбор.
 * `persist: false` — когда локаль приехала с бэкенда и записывать её обратно
 * не нужно (иначе перезатрём более свежий локальный выбор).
 */
export function applyLocale(locale: Locale, opts: { persist?: boolean } = {}) {
  if (!isLocale(locale)) return
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  if (opts.persist !== false) {
    try {
      localStorage.setItem(LS_KEY, locale)
    } catch {
      /* приватный режим — просто не сохраняем */
    }
  }
}

// первичная установка <html lang> до монтирования приложения
if (typeof document !== 'undefined') document.documentElement.lang = initialLocale
