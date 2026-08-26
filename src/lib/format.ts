const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

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

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Day group label: СЕГОДНЯ / ВЧЕРА / 9 АВГУСТА */
export function dayLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  if (isSameDay(d, now)) return 'СЕГОДНЯ'
  if (isSameDay(d, yesterday)) return 'ВЧЕРА'
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]!.toUpperCase()}`
}

/** Short human date: Сегодня / Вчера / Пятница / 12 августа */
export function humanDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (isSameDay(d, now)) return 'Сегодня'
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return 'Вчера'
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) return WEEKDAYS[d.getDay()]!
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}

export function timeLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
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

/** "3 человека" / "5 человек" */
export function peopleCount(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} человек`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} человека`
  return `${n} человек`
}
