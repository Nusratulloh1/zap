import { BadRequestException } from '@nestjs/common'

/** Нормализация телефона Узбекистана → 998XXXXXXXXX (12 цифр). */
export function normalizePhone(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  const full = d.length === 9 ? '998' + d : d
  if (!/^998\d{9}$/.test(full)) throw new BadRequestException('Неверный номер телефона')
  return full
}

/** маска для логов/ответов: 998******221 */
export function maskPhone(phone: string): string {
  return phone.replace(/^(998)\d{6}(\d{3})$/, '$1******$2')
}

/** округление доли до 1000 UZS */
export function round1000(v: number): number {
  return Math.round(v / 1000) * 1000
}

export function assertIntUzs(v: number, field = 'amount') {
  if (!Number.isInteger(v) || v < 0) throw new BadRequestException(`${field}: только целые UZS >= 0`)
}

/** короткий код сплита вида 481-FRD */
export function makeSplitCode(orderNo?: string | null): string {
  const base = orderNo && /^\d{2,4}$/.test(orderNo) ? orderNo : String(100 + Math.floor(Math.random() * 900))
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const tag = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
  return `${base}-${tag}`
}

export function cursorPage<T extends { id: string }>(rows: T[], limit: number) {
  const page = rows.slice(0, limit)
  return { items: page, nextCursor: rows.length > limit ? page[page.length - 1]?.id : null }
}

export function clampLimit(limit?: number): number {
  const n = Number(limit ?? 30)
  return Math.min(Math.max(1, Number.isFinite(n) ? n : 30), 50)
}
