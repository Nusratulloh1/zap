// Аналитика расходов для истории (редизайн): сколько потрачено, на что и с кем.
//
// Считаем из /bootstrap — данные уже пришли, отдельная ручка ради четырёх
// цифр не нужна. Категорию берём у мерчанта: она теперь приходит с сервера,
// а не угадывается по названию, поэтому «Коммуналка» и «Такси» наконец
// отделяются от «Еды».
import type { Db, MerchantCategory } from '@zap/shared/types';

export interface SpendSummary {
  /** мои доли в закрытых сплитах за период */
  spent: number;
  /** кэшбэк за период */
  cashback: number;
  /** покрытые мне доли (вернули) */
  returned: number;
  /** средний чек сплита */
  avgBill: number;
  /** изменение к прошлому периоду, %; null — не с чем сравнивать */
  deltaPct: number | null;
  splits: number;
  groups: number;
}

export interface CategorySlice {
  key: MerchantCategory;
  glyph: string;
  amount: number;
  share: number;
}

export interface PersonSlice {
  contactId: string;
  amount: number;
  splits: number;
}

export const CATEGORY_GLYPH: Record<MerchantCategory, string> = {
  food: '🍕',
  coffee: '☕',
  grocery: '🛒',
  utilities: '🏠',
  taxi: '🚕',
  shopping: '🛍️',
  fun: '🎬',
  other: '✨',
};

/** Границы периода: 'week' — последние 7 дней, 'month' — календарный месяц. */
function bounds(period: 'week' | 'month'): { from: number; prevFrom: number } {
  const now = new Date();
  if (period === 'week') {
    const from = now.getTime() - 7 * 86400_000;
    return { from, prevFrom: from - 7 * 86400_000 };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  return { from, prevFrom };
}

const myShare = (s: Db['splits'][number]) =>
  s.members.find((m) => m.isYou)?.amount ?? 0;

export function spendSummary(db: Db | undefined, period: 'week' | 'month'): SpendSummary {
  const empty: SpendSummary = {
    spent: 0, cashback: 0, returned: 0, avgBill: 0, deltaPct: null, splits: 0, groups: 0,
  };
  if (!db) return empty;

  const { from, prevFrom } = bounds(period);
  const closed = db.splits.filter((s) => s.status === 'closed');
  const inPeriod = closed.filter((s) => (s.closedAt ?? s.createdAt) >= from);
  const prev = closed.filter((s) => {
    const t = s.closedAt ?? s.createdAt;
    return t >= prevFrom && t < from;
  });

  const sum = (list: typeof closed) => list.reduce((acc, s) => acc + myShare(s), 0);
  const spent = sum(inPeriod);
  const prevSpent = sum(prev);

  return {
    spent,
    cashback: db.cashbackEntries.filter((e) => e.createdAt >= from).reduce((a, e) => a + e.amount, 0),
    // «вернули вам» — доли, которые за меня закрыли другие
    returned: inPeriod.reduce(
      (a, s) => a + (s.members.find((m) => m.isYou && m.status === 'debt') ? myShare(s) : 0),
      0,
    ),
    avgBill: inPeriod.length ? Math.round(inPeriod.reduce((a, s) => a + s.total, 0) / inPeriod.length) : 0,
    deltaPct: prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null,
    splits: inPeriod.length,
    groups: new Set(inPeriod.map((s) => s.groupId).filter(Boolean)).size,
  };
}

export function byCategory(db: Db | undefined, period: 'week' | 'month'): CategorySlice[] {
  if (!db) return [];
  const { from } = bounds(period);
  const acc = new Map<MerchantCategory, number>();
  for (const s of db.splits) {
    if (s.status !== 'closed' || (s.closedAt ?? s.createdAt) < from) continue;
    const cat = db.merchants.find((m) => m.id === s.merchantId)?.category ?? 'other';
    acc.set(cat, (acc.get(cat) ?? 0) + myShare(s));
  }
  const total = [...acc.values()].reduce((a, b) => a + b, 0);
  return [...acc.entries()]
    .map(([key, amount]) => ({
      key,
      glyph: CATEGORY_GLYPH[key],
      amount,
      share: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function byPerson(db: Db | undefined, period: 'week' | 'month'): PersonSlice[] {
  if (!db) return [];
  const { from } = bounds(period);
  const acc = new Map<string, PersonSlice>();
  for (const s of db.splits) {
    if (s.status !== 'closed' || (s.closedAt ?? s.createdAt) < from) continue;
    if (s.members.length < 2) continue;
    for (const m of s.members) {
      if (m.isYou) continue;
      const cur = acc.get(m.contactId) ?? { contactId: m.contactId, amount: 0, splits: 0 };
      // «с кем тратишь» — общая сумма счетов, а не чужая доля
      cur.amount += s.total;
      cur.splits += 1;
      acc.set(m.contactId, cur);
    }
  }
  return [...acc.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
}

/** Траты по дням недели за последние 7 дней — для столбиков в шапке. */
export function daily(db: Db | undefined): { label: string; amount: number; today: boolean }[] {
  const days = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
  const out: { label: string; amount: number; today: boolean }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const from = d.getTime();
    const to = from + 86400_000;
    const amount = (db?.splits ?? [])
      .filter((s) => {
        const t = s.closedAt ?? s.createdAt;
        return s.status === 'closed' && t >= from && t < to;
      })
      .reduce((acc, s) => acc + myShare(s), 0);
    out.push({ label: days[d.getDay()]!, amount, today: i === 0 });
  }
  return out;
}

/** Заведение, где были чаще всего: «Bellissimo ×5». */
export function topPlace(db: Db | undefined, period: 'week' | 'month'): { name: string; times: number } | null {
  if (!db) return null;
  const { from } = bounds(period);
  const acc = new Map<string, number>();
  for (const s of db.splits) {
    if (s.status !== 'closed' || (s.closedAt ?? s.createdAt) < from) continue;
    const name = db.merchants.find((m) => m.id === s.merchantId)?.name ?? s.title;
    acc.set(name, (acc.get(name) ?? 0) + 1);
  }
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { name: top[0], times: top[1] } : null;
}
