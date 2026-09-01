// Живые напоминания вместо «Payment request pending» (vision, часть B §4).
//
// Одна и та же строка при каждом пинге быстро надоедает и перестаёт работать,
// поэтому фраза выбирается из набора. Выбор не случайный, а детерминированный
// по участнику и номеру попытки: один и тот же человек при первом пинге всегда
// получит одну фразу, при втором — другую. Так это выглядит живым, но не
// прыгает при каждом ререндере.
import { translate } from '@/i18n';

/** Сколько фраз в библиотеке (reminders.l1 … l6). */
const LINES = 6;

/** Простая стабильная свёртка строки в число. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Фраза напоминания.
 *
 * @param seed  что-то постоянное для получателя — memberId или contactId
 * @param nth   какой это по счёту пинг (0 — первый)
 */
export function reminderLine(seed: string, nth: number, params: { name: string; amount: string }): string {
  const i = (hash(seed) + nth) % LINES + 1;
  return translate(`reminders.l${i}`, params);
}
