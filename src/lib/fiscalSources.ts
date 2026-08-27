// ЕДИНЫЙ конфиг источников фискальных QR-чеков: host → парсер.
// Клиентские парсеры воспроизводят поведение публичного фронт-бандла
// соответствующего сервиса (клиентская подпись — НЕ серверный секрет) для
// СОБСТВЕННОГО чека пользователя. Схемы недокументированы и МОГУТ измениться —
// при падении success-rate источник тихо уходит на Gemini-фото (см. FISCAL.md).

export type FiscalSourceId = 'mysoliq' | 'rahmat'

export interface FiscalSource {
  id: FiscalSourceId
  label: string
  /** хосты QR-ссылки этого источника */
  hosts: RegExp
  /** реализован ли клиентский фетч (иначе QR уходит на Gemini-фото) */
  clientFetch: boolean
}

export const FISCAL_SOURCES: FiscalSource[] = [
  {
    id: 'mysoliq',
    label: 'MySoliq',
    // ofd.soliq.uz/check?t&r&c&s — данные из new-ofd.soliq.uz/api/payment,
    // клиентская подпись HMAC (см. fiscalClient.ts). Выведено из бандла ofd.soliq.uz.
    hosts: /(^|\.)((new-)?ofd)\.soliq\.uz$/i,
    clientFetch: true,
  },
  {
    id: 'rahmat',
    label: 'Rahmat',
    // Базовый домен Rahmat — rhmt.uz (ссылка может прийти с любого поддомена,
    // напр. check.rhmt.uz / r.rhmt.uz), поэтому матчим домен и все поддомены.
    // clientFetch=false: механизм их API ещё НЕ исследован (нужен живой QR),
    // поэтому такой чек уходит на фото → Gemini. Как только API будет вскрыт —
    // включаем клиентский фетч здесь (см. FISCAL.md).
    hosts: /(^|\.)rhmt\.uz$/i,
    clientFetch: false,
  },
]

/** Источник по URL чека (или null — неизвестный QR → Gemini/ручной ввод). */
export function sourceForUrl(url: string): FiscalSource | null {
  let host = ''
  try {
    host = new URL(url).host
  } catch {
    return null
  }
  return FISCAL_SOURCES.find((s) => s.hosts.test(host)) ?? null
}
