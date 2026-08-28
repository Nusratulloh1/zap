import { t } from '@/lib/i18n'

// Чистые денежные утилиты переехали в @zap/shared/money — их использует и RN.
// Реэкспорт оставлен, чтобы не переписывать 25 импортов разом.
export { money, moneySigned, phone, equalShares } from '@zap/shared/money'

/** «3 человека» / «5 человек» / «3 kishi» — плюрализация из локали. */
export function peopleCount(n: number): string {
  return t('common.people', n, { named: { n } })
}

// Даты — в @/lib/datetime: они тоже зависят от локали.
export { isSameDay, dayLabel, humanDate, humanDateLc, timeLabel, monthYear, dateShort } from '@/lib/datetime'
