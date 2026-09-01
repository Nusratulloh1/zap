import type { SmsLocale } from '../sms/sms.i18n'

/**
 * Тексты пушей на трёх языках.
 *
 * Отдельно от SMS: у пуша нет ограничения по алфавиту и цене, поэтому здесь
 * живут эмодзи и голос продукта (vision §B4 — «не сухой банковский push»).
 * Отдельно от packages/locales: те строки идут в бандл приложения, а эти
 * нужны серверу.
 */
type Params = Record<string, string | number>

const T = {
  /** «⚡ Пингануть» — ручное напоминание. Фраза выбирается по кругу. */
  remind: {
    uz: [
      { title: '👀 Sizni kutishyapti', body: 'ZAP da {amount} to‘lash qoldi' },
      { title: '⚡ {name}, esladikmi?', body: '«{title}» uchun {amount}' },
      { title: '🍕 Pitsa tugadi', body: 'Hisob esa yo‘q — {amount}' },
    ],
    ru: [
      { title: '👀 Тебя ждут', body: 'В ZAP осталось оплатить {amount}' },
      { title: '⚡ {name}, мы всё помним', body: 'За «{title}» — {amount}' },
      { title: '🍕 Пицца закончилась', body: 'А счёт ещё нет — {amount}' },
    ],
    en: [
      { title: '👀 You are being waited for', body: '{amount} left to pay in ZAP' },
      { title: '⚡ {name}, we remember', body: '{amount} for “{title}”' },
      { title: '🍕 The pizza is gone', body: 'The bill is not — {amount}' },
    ],
  },
  /** Кто-то закрыл свою долю — организатору. */
  memberPaid: {
    uz: { title: '⚡ {name} to‘ladi', body: '«{title}» — {amount}' },
    ru: { title: '⚡ {name} оплатил', body: '«{title}» — {amount}' },
    en: { title: '⚡ {name} paid', body: '“{title}” — {amount}' },
  },
  /** Счёт закрыт полностью — всем участникам. */
  splitClosed: {
    uz: { title: '🎉 Hammasi to‘ladi', body: '«{title}» to‘liq yopildi' },
    ru: { title: '🎉 Все оплатили', body: '«{title}» полностью закрыт' },
    en: { title: '🎉 Everyone paid', body: '“{title}” is fully settled' },
  },
  /** Кэшбек начислен. */
  cashback: {
    uz: { title: '💸 Keshbek tushdi', body: '{amount} allaqachon ZAP da' },
    ru: { title: '💸 Кэшбек начислен', body: '{amount} уже в ZAP' },
    en: { title: '💸 Cashback credited', body: '{amount} is already in ZAP' },
  },
} as const

function fill(s: string, p: Params): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? ''))
}

export type PushKind = keyof typeof T

/**
 * Текст пуша.
 *
 * @param nth  для remind — какой это по счёту пинг; фразы чередуются, чтобы
 *             одно и то же уведомление не приедалось
 */
export function pushText(
  kind: PushKind,
  locale: SmsLocale,
  params: Params,
  nth = 0,
): { title: string; body: string } {
  const block = T[kind][locale] as { title: string; body: string } | readonly { title: string; body: string }[]
  const tpl = Array.isArray(block) ? block[nth % block.length]! : (block as { title: string; body: string })
  return { title: fill(tpl.title, params), body: fill(tpl.body, params) }
}
