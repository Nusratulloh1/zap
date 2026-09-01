// Форматирование — те же функции, что в вебе. Денежные утилиты берём из
// общего пакета, чтобы округление долей нигде не разъехалось.
import { translate, currentLocale, type Locale } from '@/i18n';

export { money, moneySigned, phone, equalShares } from '@zap/shared/money';

/** «3 человека» с правильной формой числа — правило живёт в locales. */
export function peopleCount(n: number): string {
  return translate('common.people', { n });
}

// ── даты ──────────────────────────────────────────────────────────────────
// Таблицы месяцев, а не Intl: нужен родительный падеж («12 августа»),
// узбекские названия и заглавные группы истории — Intl этого не даёт.
type Table = { months: string[]; weekdays: string[]; today: string; yesterday: string };

const TABLES: Record<Locale, Table> = {
  ru: {
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
};

const table = (): Table => TABLES[currentLocale()] ?? TABLES.uz;

/** «12 августа» / «12-avgust» / «August 12» — порядок слов у языков разный. */
export function dayMonth(d: Date): string {
  const t = table();
  const m = t.months[d.getMonth()]!;
  const loc = currentLocale();
  if (loc === 'en') return `${m} ${d.getDate()}`;
  if (loc === 'uz') return `${d.getDate()}-${m}`;
  return `${d.getDate()} ${m}`;
}

/** «мая 2026» / «may 2026» — для чипа «ZAP! с …». */
export function monthYear(ts: number): string {
  const d = new Date(ts);
  return `${table().months[d.getMonth()]} ${d.getFullYear()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Короткая дата: Сегодня / Вчера / Пятница / 12 августа. */
export function humanDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const t = table();
  if (isSameDay(d, now)) return t.today;
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return t.yesterday;
  if (now.getTime() - d.getTime() < 7 * 86400000) return t.weekdays[d.getDay()]!;
  return dayMonth(d);
}

export function humanDateLc(ts: number): string {
  return humanDate(ts).toLowerCase();
}

/** Заголовок группы в истории: СЕГОДНЯ / ВЧЕРА / 9 АВГУСТА. */
export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const t = table();
  if (isSameDay(d, now)) return t.today.toUpperCase();
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return t.yesterday.toUpperCase();
  return dayMonth(d).toUpperCase();
}
