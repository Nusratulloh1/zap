// Смешная статистика (vision §C11) и маленькие титулы (§C12).
//
// Видение особо оговаривает тон: «Не надо превращать всё в leaderboard. Это
// скорее социальные шутки» и «лучше делать их ироничными, а не как банковские
// badges». Поэтому здесь нет очков и рейтингов — только пара наблюдений.
//
// Считается из /bootstrap, как crewStats и moments: сервер не трогаем.
import type { Db, Split } from '@zap/shared/types';
import { themeForMerchant, type ThemeKey } from '@/lib/merchantTheme';

export type StatKind =
  | 'fastest'
  | 'alwaysLast'
  | 'biggest'
  | 'buddy'
  /** платит больше всех по сумме долей */
  | 'bigWallet'
  /** платит меньше всех */
  | 'smallWallet'
  /** чаще всех уходит в долг — «вечно без денег» */
  | 'alwaysBroke';

export interface FunStat {
  kind: StatKind;
  /** участник, к которому относится наблюдение (у 'biggest' его нет) */
  contactId?: string;
  /** секунды у fastest, счётчик у alwaysLast/buddy, сумма у biggest */
  value: number;
  /** название заведения — только у 'biggest' */
  label?: string;
}

export type TitleKey =
  | 'fastestFinger'
  | 'lastPayer'
  | 'reliableOne'
  | 'bigSpender'
  | 'pizzaCFO'
  | 'coffeeAddict';

export interface Title {
  key: TitleKey;
  glyph: string;
}

/** Ниже этого числа совместных счетов любой вывод — случайность, а не шутка. */
const MIN_SAMPLE = 2;

const closedOf = (db: Db, groupId?: string) =>
  db.splits.filter(
    (s) => s.status === 'closed' && s.members.length > 1 && (!groupId || s.groupId === groupId),
  );

/** Сколько секунд участник думал перед оплатой. null — если не платил. */
function payDelay(s: Split, contactId: string): number | null {
  const m = s.members.find((x) => x.contactId === contactId);
  if (!m?.paidAt) return null;
  return Math.max(0, Math.round((m.paidAt - s.createdAt) / 1000));
}

/**
 * Наблюдения по компании (или по всем счетам, если groupId не задан).
 *
 * Возвращаем только то, что реально набралось: лучше две строки, чем четыре
 * с прочерками.
 */
export function funStats(db: Db | undefined, groupId?: string): FunStat[] {
  if (!db) return [];
  const splits = closedOf(db, groupId);
  if (splits.length < MIN_SAMPLE) return [];

  const out: FunStat[] = [];

  // средняя скорость оплаты по каждому участнику
  const delays = new Map<string, number[]>();
  // сколько раз участник оплатил последним
  const lasts = new Map<string, number>();
  // с кем чаще всего делим счёт
  const together = new Map<string, number>();

  for (const s of splits) {
    for (const m of s.members) {
      if (!m.isYou) together.set(m.contactId, (together.get(m.contactId) ?? 0) + 1);
      const d = payDelay(s, m.contactId);
      if (d !== null) {
        const arr = delays.get(m.contactId) ?? [];
        arr.push(d);
        delays.set(m.contactId, arr);
      }
    }
    const paid = s.members.filter((m) => m.paidAt).sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
    // «последним» считаем только когда счёт закрыт полностью — иначе это
    // просто тот, кто успел, а не тот, кто тянул
    if (paid.length === s.members.length && paid[0]) {
      lasts.set(paid[0].contactId, (lasts.get(paid[0].contactId) ?? 0) + 1);
    }
  }

  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

  const fastest = [...delays.entries()]
    .filter(([, a]) => a.length >= MIN_SAMPLE)
    .sort((a, b) => avg(a[1]) - avg(b[1]))[0];
  if (fastest) out.push({ kind: 'fastest', contactId: fastest[0], value: Math.round(avg(fastest[1])) });

  const lastly = [...lasts.entries()].filter(([, n]) => n >= MIN_SAMPLE).sort((a, b) => b[1] - a[1])[0];
  // не показываем «вечно последний», если это тот же человек, что и самый
  // быстрый — вышла бы бессмыслица на маленькой выборке
  if (lastly && lastly[0] !== fastest?.[0]) {
    out.push({ kind: 'alwaysLast', contactId: lastly[0], value: lastly[1] });
  }

  const biggest = [...splits].sort((a, b) => b.total - a.total)[0];
  if (biggest) {
    const name = db.merchants.find((m) => m.id === biggest.merchantId)?.name ?? biggest.title;
    out.push({ kind: 'biggest', value: biggest.total, label: name });
  }

  const buddy = [...together.entries()].filter(([, n]) => n >= MIN_SAMPLE).sort((a, b) => b[1] - a[1])[0];
  if (buddy) out.push({ kind: 'buddy', contactId: buddy[0], value: buddy[1] });

  /*
    Кто сколько заносит и кто вечно «потом переведу» (требование руководства:
    в компании должны быть шутки про самого щедрого, самого экономного и того,
    кто всегда без денег). Считаем по долям в закрытых счетах.
  */
  const paidSum = new Map<string, number>();
  const debts = new Map<string, number>();
  for (const s of splits) {
    for (const m of s.members) {
      if (m.status === 'paid') paidSum.set(m.contactId, (paidSum.get(m.contactId) ?? 0) + m.amount);
      if (m.status === 'debt') debts.set(m.contactId, (debts.get(m.contactId) ?? 0) + 1);
    }
  }
  const wallets = [...paidSum.entries()].sort((a, b) => b[1] - a[1]);
  if (wallets.length > 1) {
    out.push({ kind: 'bigWallet', contactId: wallets[0]![0], value: wallets[0]![1] });
    const last = wallets[wallets.length - 1]!;
    out.push({ kind: 'smallWallet', contactId: last[0], value: last[1] });
  }
  const broke = [...debts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (broke) out.push({ kind: 'alwaysBroke', contactId: broke[0], value: broke[1] });

  return out;
}

/**
 * Титулы участника (§C12). Их немного и они ироничные — «Pizza CFO», а не
 * «Уровень 4». Больше трёх не отдаём: коллекция из десяти обесценивает каждый.
 */
const MAX_TITLES = 3;

export function titlesFor(db: Db | undefined, contactId: string): Title[] {
  if (!db) return [];
  const splits = closedOf(db).filter((s) => s.members.some((m) => m.contactId === contactId));
  if (splits.length < MIN_SAMPLE) return [];

  const out: Title[] = [];
  const stats = funStats(db);

  if (stats.find((s) => s.kind === 'fastest' && s.contactId === contactId)) {
    out.push({ key: 'fastestFinger', glyph: '⚡' });
  }
  if (stats.find((s) => s.kind === 'alwaysLast' && s.contactId === contactId)) {
    out.push({ key: 'lastPayer', glyph: '👀' });
  }

  // надёжность: доля закрытых своих долей
  const mine = splits.map((s) => s.members.find((m) => m.contactId === contactId)!);
  const paidRatio = mine.filter((m) => m.status === 'paid' || m.status === 'debt').length / mine.length;
  if (paidRatio === 1 && splits.length >= 3) out.push({ key: 'reliableOne', glyph: '🤝' });

  // сколько всего человек через себя провёл
  const spent = mine.reduce((sum, m) => sum + m.amount, 0);
  if (spent >= 1_000_000) out.push({ key: 'bigSpender', glyph: '💸' });

  // характер по заведениям
  const themeCount = (key: string) =>
    splits.filter((s) => {
      const name = db.merchants.find((m) => m.id === s.merchantId)?.name ?? s.title;
      return themeForMerchant(name)?.key === key;
    }).length;

  if (themeCount('food') >= 3) out.push({ key: 'pizzaCFO', glyph: '🍕' });
  if (themeCount('coffee') >= 3) out.push({ key: 'coffeeAddict', glyph: '☕' });

  return out.slice(0, MAX_TITLES);
}

/** Самая быстрая оплата участника за всё время, в секундах (§C13). */
export function personalBest(db: Db | undefined, contactId: string): number | null {
  if (!db) return null;
  const all = closedOf(db)
    .map((s) => payDelay(s, contactId))
    .filter((d): d is number => d !== null);
  return all.length ? Math.min(...all) : null;
}

/** Любимая категория счетов участника (§C13): «🍕 Dinner». */
export function favouriteTheme(db: Db | undefined, contactId: string): ThemeKey | null {
  if (!db) return null;
  const counts = new Map<ThemeKey, number>();
  for (const s of closedOf(db)) {
    if (!s.members.some((m) => m.contactId === contactId)) continue;
    const name = db.merchants.find((m) => m.id === s.merchantId)?.name ?? s.title;
    const th = themeForMerchant(name);
    if (th) counts.set(th.key, (counts.get(th.key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
