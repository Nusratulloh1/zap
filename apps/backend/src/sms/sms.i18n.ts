// Шаблоны SMS на трёх языках. Отдельно от packages/locales: у SMS свои
// ограничения (без эмодзи и латиницы вперемешку — иначе сообщение уходит в
// UCS-2 и стоит втрое дороже) и свои формулировки — короче, чем в интерфейсе.
//
// Язык выбирается по ПОЛУЧАТЕЛЮ: его locale из профиля → locale того, кто
// инициировал отправку → uz. Смотри SmsService.localeFor().

export const SMS_LOCALES = ['uz', 'ru', 'en'] as const
export type SmsLocale = (typeof SMS_LOCALES)[number]
export const DEFAULT_SMS_LOCALE: SmsLocale = 'uz'

export function isSmsLocale(v: unknown): v is SmsLocale {
  return typeof v === 'string' && (SMS_LOCALES as readonly string[]).includes(v)
}

/**
 * Первая валидная локаль из списка, иначе uz.
 * Порядок вызова = приоритет: получатель, затем инициатор.
 */
export function resolveSmsLocale(...candidates: (string | null | undefined)[]): SmsLocale {
  for (const c of candidates) if (isSmsLocale(c)) return c
  return DEFAULT_SMS_LOCALE
}

type Params = Record<string, string | number>

const TEMPLATES = {
  otp: {
    uz: 'ZAP! Kod: {code}',
    ru: 'ZAP! Код: {code}',
    en: 'ZAP! Code: {code}',
  },
  splitLink: {
    uz: 'ZAP! {name} «{title}» uchun ulushingizni so‘rayapti: {url}',
    ru: 'ZAP! {name} просит вашу долю в «{title}»: {url}',
    en: 'ZAP! {name} is asking for your share of “{title}”: {url}',
  },
  splitReminder: {
    uz: 'ZAP! Eslatma: «{title}» dagi ulushingiz — {url}',
    ru: 'ZAP! Напоминание: ваша доля в «{title}» — {url}',
    en: 'ZAP! Reminder: your share of “{title}” — {url}',
  },
  debtReminder: {
    uz: 'ZAP! {name} {amount} UZS qarzni eslatmoqda ({reason})',
    ru: 'ZAP! {name} напоминает про долг {amount} UZS ({reason})',
    en: 'ZAP! {name} reminds you about a {amount} UZS debt ({reason})',
  },
  partnerLead: {
    uz: 'ZAP! Hamkor arizasi: {company}. {contact}, +{phone}{city}',
    ru: 'ZAP! Заявка партнёра: {company}. {contact}, +{phone}{city}',
    en: 'ZAP! Partner request: {company}. {contact}, +{phone}{city}',
  },
} as const

export type SmsTemplate = keyof typeof TEMPLATES

/** Имя отправителя, когда в профиле пусто — «Друг» на нужном языке. */
export const FRIEND_FALLBACK: Record<SmsLocale, string> = {
  uz: 'Do‘stingiz',
  ru: 'Друг',
  en: 'A friend',
}

export function smsText(template: SmsTemplate, locale: SmsLocale, params: Params = {}): string {
  const raw = TEMPLATES[template][locale]
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
}

/** Разряды: uz/ru — пробел, en — запятая. */
export function smsAmount(n: number, locale: SmsLocale): string {
  return n.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')
}
