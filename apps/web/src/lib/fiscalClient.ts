// КЛИЕНТСКИЙ фетч фискального чека: телефон пользователя (узбекский IP) не
// заблокирован соликом, в отличие от нашего сервера. Данные забираем с устройства,
// парсим локально и отправляем СТРУКТУРУ на бэкенд (он перепроверяет суммы).
//
// Диагностика (26.08.2026, см. docs/FISCAL.md) — доказано живым 200-ответом:
//   • CORS у new-ofd.soliq.uz/api/payment ОТКРЫТ (отражает наш origin,
//     разрешает POST + content-type/x-signature/x-timestamp);
//   • подпись запроса = ровно то, что делает сама страница ОФД в браузере
//     пользователя: x-timestamp = unix-секунды, x-signature =
//     HMAC-SHA256(SECRET, `${terminalId}:${paymentNo}:${timestamp}`),
//     где SECRET — публичная константа из их фронт-бандла (клиентская
//     обфускация, не серверный ключ). Мы воспроизводим клиентское поведение
//     для СОБСТВЕННОГО чека пользователя.

import { sourceForUrl } from './fiscalSources'

const OFD_API_URL = 'https://new-ofd.soliq.uz/api/payment'
// публичная константа подписи из фронт-бандла ofd.soliq.uz (не секрет сервера)
const OFD_CLIENT_KEY = 'thisIsPaymentSecretKey123@#'
const CLIENT_TIMEOUT_MS = 6000

export interface ClientReceipt {
  sourceUrl: string
  merchantName?: string
  merchantInn?: string
  datetime?: string
  totalAmount: number
  items: { name: string; qtyMilli: number; unitPrice: number; lineTotal: number }[]
}

interface OfdPaymentJson {
  data?: {
    tin?: number | string
    paymentDate?: string
    cashTotal?: number
    cardTotal?: number
    extraInfo?: { companyName?: string }
    paymentDetails?: { name?: string; productName?: string; price?: number; amount?: number }[]
  }
}

/** DD.MM.YYYY HH:MM:SS → ISO */
function ofdDateToIso(s?: string): string | undefined {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s ?? '')
  if (!m) return undefined
  const [, dd, mm, yyyy, hh, mi, ss] = m
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss ?? '00'}`
}

/** Разбор JSON ОФД → структура чека (та же семантика, что на сервере:
 *  `price` в позиции — это СТОИМОСТЬ СТРОКИ, `amount` — количество). */
export function parseOfdJson(raw: string, sourceUrl: string): ClientReceipt | null {
  let json: OfdPaymentJson
  try {
    json = JSON.parse(raw) as OfdPaymentJson
  } catch {
    return null
  }
  const d = json.data
  if (!d) return null
  const items = (d.paymentDetails ?? []).map((it) => {
    const qty = typeof it.amount === 'number' && it.amount > 0 ? it.amount : 1
    const lineTotal = Math.round(it.price ?? 0)
    return {
      name: String(it.name ?? it.productName ?? 'Товар').trim().slice(0, 200),
      qtyMilli: Math.round(qty * 1000),
      unitPrice: Math.round((it.price ?? 0) / qty),
      lineTotal,
    }
  })
  const totalAmount = Math.round((d.cardTotal ?? 0) + (d.cashTotal ?? 0))
  if (!items.length || totalAmount <= 0) return null
  // та же валидация, что на сервере: сумма позиций == итог (±1000 или ±1 на позицию)
  const sum = items.reduce((s, i) => s + i.lineTotal, 0)
  if (Math.abs(sum - totalAmount) > Math.max(1000, items.length)) return null
  return {
    sourceUrl,
    merchantName: d.extraInfo?.companyName?.trim(),
    merchantInn: d.tin ? String(d.tin) : undefined,
    datetime: ofdDateToIso(d.paymentDate),
    totalAmount,
    items,
  }
}

/** HMAC-SHA256 hex через Web Crypto (как в бандле ОФД). */
async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function clientFetchAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

/** Диспетчер по источнику QR: MySoliq → клиентский фетч; Rahmat/неизвестный →
 *  null (UI уходит на Gemini-фото / ручной ввод). Маппинг — в fiscalSources.ts. */
export async function fetchReceiptForUrl(checkUrl: string): Promise<ClientReceipt | null> {
  const src = sourceForUrl(checkUrl)
  if (!src?.clientFetch || !clientFetchAvailable()) return null
  if (src.id === 'mysoliq') return fetchReceiptOnDevice(checkUrl)
  // if (src.id === 'rahmat') return fetchRahmatOnDevice(checkUrl)  // §3: после исследования
  return null
}

/** Забрать чек с устройства пользователя. null — если нельзя/не вышло (UI
 *  уходит на фото/ручной ввод; поток НИКОГДА не блокируется). */
export async function fetchReceiptOnDevice(checkUrl: string): Promise<ClientReceipt | null> {
  let params: URLSearchParams
  try {
    params = new URL(checkUrl).searchParams
  } catch {
    return null
  }
  const t = params.get('t') ?? ''
  const r = params.get('r') ?? ''
  if (!t || !r || !clientFetchAvailable()) return null

  const body = JSON.stringify({
    terminalId: t,
    paymentNo: r,
    paymentDate: params.get('c'),
    paymentType: 'CHECK',
    fiscalSign: params.get('s'),
  })
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const signature = await hmacHex(OFD_CLIENT_KEY, `${t}:${r}:${ts}`)
    const res = await fetch(OFD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-timestamp': ts, 'x-signature': signature },
      body,
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return parseOfdJson(await res.text(), checkUrl)
  } catch {
    return null // CORS/сеть/таймаут — тихо в фолбэк
  }
}
