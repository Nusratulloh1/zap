// Статистика компании — «Crew History» вместо streak (vision, часть C §6).
//
// Видение прямо отвергает «🔥 17-day streak»: для приложения оплаты это
// искусственно. Вместо этого — общая история: сколько ужинов, сколько кофе,
// сколько ZAP'ов вместе, любимое место.
//
// Всё считается из уже загруженного /bootstrap. Отдельной агрегации на
// сервере нет и не нужно: у компании десятки сплитов, не десятки тысяч, а
// лишний endpoint — лишний деплой и лишняя рассинхронизация.
import type { Db, Split } from '@zap/shared/types';
import { themeForMerchant, type ThemeKey } from '@/lib/merchantTheme';

export interface CrewStats {
  /** всего сплитов компании */
  zaps: number;
  /** сумма всего разделённого */
  total: number;
  /** разбивка по категориям заведений: сколько ужинов, кофе, поездок */
  byTheme: { key: ThemeKey; count: number }[];
  /** любимое место: заведение, где были чаще всего */
  favourite?: { name: string; count: number };
  /** кто сейчас не закрыл свою долю в активных сплитах компании */
  owing: { contactId: string; amount: number }[];
  /** кто платил в прошлый раз (vision §C7) */
  lastPayer?: string;
}

/** Сколько категорий показываем: три — это уже характер компании. */
const TOP_THEMES = 3;

export function crewStats(db: Db | undefined, groupId: string): CrewStats {
  const empty: CrewStats = { zaps: 0, total: 0, byTheme: [], owing: [] };
  if (!db) return empty;

  const splits = db.splits.filter((s) => s.groupId === groupId);
  if (!splits.length) return empty;

  const merchantName = (s: Split) =>
    db.merchants.find((m) => m.id === s.merchantId)?.name ?? s.title;

  // категории заведений — по той же эвристике, что и темы экранов
  const themes = new Map<ThemeKey, number>();
  const places = new Map<string, number>();

  for (const s of splits) {
    const name = merchantName(s);
    const th = themeForMerchant(name);
    if (th) themes.set(th.key, (themes.get(th.key) ?? 0) + 1);
    if (s.merchantId) places.set(name, (places.get(name) ?? 0) + 1);
  }

  const byTheme = [...themes.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_THEMES);

  const topPlace = [...places.entries()].sort((a, b) => b[1] - a[1])[0];

  // кто сейчас должен: незакрытые доли в активных сплитах компании
  const owing = new Map<string, number>();
  for (const s of splits) {
    if (s.status !== 'active') continue;
    for (const m of s.members) {
      if (m.status === 'paid' || m.status === 'debt') continue;
      owing.set(m.contactId, (owing.get(m.contactId) ?? 0) + m.amount);
    }
  }

  // кто платил в прошлый раз — по последнему закрытому сплиту компании
  const lastClosed = splits
    .filter((s) => s.status === 'closed')
    .sort((a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt))[0];
  const lastPayer = lastClosed?.members
    .filter((m) => m.status === 'paid' && m.paidAt)
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))[0]?.contactId;

  return {
    zaps: splits.length,
    total: splits.reduce((sum, s) => sum + s.total, 0),
    byTheme,
    favourite: topPlace ? { name: topPlace[0], count: topPlace[1] } : undefined,
    owing: [...owing.entries()].map(([contactId, amount]) => ({ contactId, amount })),
    lastPayer,
  };
}

/**
 * Предложение собрать компанию (vision §C1).
 *
 * Ищем людей, с которыми уже несколько раз делили счета, но группы для них
 * нет. Возвращает состав-кандидат или null. Порог намеренно высокий: предлагать
 * после первого же совместного счёта — навязчиво.
 */
const SUGGEST_MIN_SPLITS = 3;

export function suggestCrew(
  db: Db | undefined,
): { contactIds: string[]; splits: number; splitId: string } | null {
  if (!db || db.splits.length < SUGGEST_MIN_SPLITS) return null;

  // состав каждого сплита без группы, отсортированный — это «подпись» компании
  const signatures = new Map<string, { ids: string[]; n: number; splitId: string }>();
  for (const s of db.splits) {
    if (s.groupId) continue;
    const ids = s.members.filter((m) => !m.isYou).map((m) => m.contactId).sort();
    if (ids.length < 2) continue;
    const key = ids.join('|');
    const prev = signatures.get(key);
    // splitId — самый свежий сплит этой компании: из него и соберём группу
    signatures.set(key, {
      ids,
      n: (prev?.n ?? 0) + 1,
      splitId: prev && prev.splitId ? prev.splitId : s.id,
    });
  }

  const best = [...signatures.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < SUGGEST_MIN_SPLITS) return null;
  return { contactIds: best.ids, splits: best.n, splitId: best.splitId };
}
