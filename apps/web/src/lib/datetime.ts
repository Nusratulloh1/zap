// Локализованные даты. Небольшие таблицы вместо Intl: нужны родительный
// падеж («12 августа»), узбекские названия и заглавные группы истории —
// Intl этого не даёт, а таблицы читаются и правятся за секунду.
import { currentLocale, type Locale } from '@/lib/i18n'

type Table = { months: string[]; weekdays: string[]; today: string; yesterday: string }

const TABLES: Record<Locale, Table> = {
  ru: {
    // родительный падеж: «12 августа»
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    weekdays: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    today: 'Сегодня',
    yesterday: 'Вчера',
  },
  uz: {
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    weekdays: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
    today: 'Bugun',
    yesterday: 'Kecha',
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    today: 'Today',
    yesterday: 'Yesterday',
  },
}

const table = (): Table => TABLES[currentLocale()] ?? TABLES.uz

/** «12 августа» / «12-avgust» / «August 12» — порядок слов у языков разный. */
export function dayMonth(d: Date): string {
  const t = table()
  const m = t.months[d.getMonth()]!
  if (currentLocale() === 'en') return `${m} ${d.getDate()}`
  if (currentLocale() === 'uz') return `${d.getDate()}-${m}`
  return `${d.getDate()} ${m}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Заголовок группы в истории: СЕГОДНЯ / ВЧЕРА / 9 АВГУСТА. */
export function dayLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const t = table()
  if (isSameDay(d, now)) return t.today.toUpperCase()
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return t.yesterday.toUpperCase()
  return dayMonth(d).toUpperCase()
}

/** Короткая дата: Сегодня / Вчера / Пятница / 12 августа. */
export function humanDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const t = table()
  if (isSameDay(d, now)) return t.today
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return t.yesterday
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) return t.weekdays[d.getDay()]!
  return dayMonth(d)
}

/** «12 августа» по метке времени — для «группа с …». */
export function dateShort(ts: number): string {
  return dayMonth(new Date(ts))
}

/** Дата в нижнем регистре для подписей карточек. */
export function humanDateLc(ts: number): string {
  return humanDate(ts).toLowerCase()
}

export function timeLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** «мая 2026» — для «ZAP! с …» в профиле. */
export function monthYear(ts: number): string {
  const d = new Date(ts)
  return `${table().months[d.getMonth()]} ${d.getFullYear()}`
}
