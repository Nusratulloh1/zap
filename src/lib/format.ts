import { t } from '@/lib/i18n'

/** 1200000 -> "1 200 000" */
export function money(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return sign + Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** signed variant: 60000 -> "+60 000" */
export function moneySigned(amount: number): string {
  return (amount > 0 ? '+' : '') + money(amount)
}

/** "901234221" -> "+998 90 123 42 21" */
export function phone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9)
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return ('+998 ' + parts.join(' ')).trim()
}

/** Equal shares rounded to 1 000 UZS; remainder goes to the first members. */
export function equalShares(total: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(total / count / 1000) * 1000
  const shares = Array.from({ length: count }, () => base)
  let remainder = total - base * count
  let i = 0
  while (remainder >= 1000) {
    shares[i % count]! += 1000
    remainder -= 1000
    i++
  }
  if (remainder > 0) shares[0]! += remainder
  return shares
}

/** «3 человека» / «5 человек» / «3 kishi» — плюрализация из локали. */
export function peopleCount(n: number): string {
  return t('common.people', n, { named: { n } })
}

// Даты переехали в @/lib/datetime — они зависят от локали.
// Реэкспорт оставлен, чтобы не переписывать все импорты разом.
export { isSameDay, dayLabel, humanDate, humanDateLc, timeLabel, monthYear } from '@/lib/datetime'
