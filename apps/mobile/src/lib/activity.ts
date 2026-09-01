// Лента жизни на главной (vision, часть C §2).
//
// Главная не должна выглядеть как банковский дашборд «Баланс / Транзакции».
// Она должна говорить о людях: кто кого ждёт, что вчера закрылось, с кем вы
// делите счета чаще всего.
//
// Каждая карточка отдаётся РАЗОБРАННОЙ на части — заголовок, сумма, подпись, —
// а не одной готовой строкой. Иначе сумму невозможно выделить: в предложении
// «Said 56 000 kutyapti» деньги тонут в сером тексте, хотя ради них карточка и
// существует.
//
// Всё считается из уже загруженного /bootstrap — отдельных запросов нет.
// Порядок продуман: сперва то, что требует действия, потом приятное.
import type { Db, Split } from '@zap/shared/types';

export type ActivityKind = 'youOwe' | 'waitingForYou' | 'closed' | 'together';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** первая строка: имя человека или название счёта */
  title: string;
  /** сумма — рисуется моноширинным и крупно; без неё карточка «информационная» */
  amount?: number;
  /** вторая строка: ключ i18n и параметры */
  captionKey: string;
  captionParams?: Record<string, string | number>;
  /** контакт, чьё лицо показываем слева */
  contactId?: string;
  /** куда ведёт карточка */
  splitId?: string;
  /** долги, по которым бьёт кнопка «Напомнить» */
  debtIds?: string[];
  /** акцентный эмодзи справа */
  glyph: string;
  /** требует действия — такие карточки выделяются лаймом */
  actionable: boolean;
}

/** Сколько карточек показываем: лента, а не список всего на свете. */
const LIMIT = 4;

const DAY = 86_400_000;

function daysAgo(ts: number, now: number): number {
  return Math.floor((now - ts) / DAY);
}

/** Все ли доли в сплите закрыты. */
function isSettled(s: Split): boolean {
  return s.members.every((m) => m.status === 'paid' || m.status === 'debt');
}

/**
 * @param excludeSplitId  сплит, который уже показан «живой пилюлей» внизу
 *                        главной, — лента не должна рассказывать то же самое
 *                        второй раз
 */
export function buildActivity(
  db: Db | undefined,
  excludeSplitId?: string,
  now = Date.now(),
): ActivityItem[] {
  if (!db) return [];
  const out: ActivityItem[] = [];
  const nameOf = (id: string) => db.contacts.find((c) => c.id === id)?.name ?? '';

  // 1. Ваша доля не закрыта — единственное, что требует денег прямо сейчас
  for (const s of db.splits) {
    if (s.status !== 'active' || s.id === excludeSplitId) continue;
    const mine = s.members.find((m) => m.isYou);
    if (mine && mine.status !== 'paid' && mine.status !== 'debt') {
      out.push({
        id: 'owe:' + s.id,
        kind: 'youOwe',
        title: s.title,
        amount: mine.amount,
        captionKey: 'activity.yourShare',
        splitId: s.id,
        glyph: '⚡',
        actionable: true,
      });
    }
  }

  // 2. Кто должен вам — по ЧЕЛОВЕКУ, а не по каждому долгу: две одинаковые
  // карточки «Shoshiy» подряд читались как задвоившийся баг
  const openDebts = db.debts.filter((d) => d.direction === 'owedToMe' && d.status === 'open');
  const byPerson = new Map<string, { amount: number; ids: string[] }>();
  for (const d of openDebts) {
    const prev = byPerson.get(d.contactId);
    byPerson.set(d.contactId, {
      amount: (prev?.amount ?? 0) + d.amount,
      ids: [...(prev?.ids ?? []), d.id],
    });
  }
  for (const [contactId, agg] of [...byPerson.entries()].slice(0, 2)) {
    const name = nameOf(contactId);
    if (!name) continue;
    out.push({
      id: 'debt:' + contactId,
      kind: 'waitingForYou',
      title: name,
      amount: agg.amount,
      captionKey: agg.ids.length > 1 ? 'activity.waitingMany' : 'activity.waitingOne',
      captionParams: { n: agg.ids.length },
      contactId,
      debtIds: agg.ids,
      glyph: '👀',
      actionable: true,
    });
  }

  // 3. Недавно закрытый счёт — приятная новость, а не строка выписки
  const closed = db.splits
    .filter((s) => s.status === 'closed' && isSettled(s))
    .sort((a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt));
  const last = closed[0];
  if (last) {
    const d = daysAgo(last.closedAt ?? last.createdAt, now);
    if (d <= 7) {
      out.push({
        id: 'closed:' + last.id,
        kind: 'closed',
        title: last.title,
        captionKey: d === 0 ? 'activity.closedToday' : d === 1 ? 'activity.closedYesterday' : 'activity.closedDays',
        captionParams: { n: d },
        splitId: last.id,
        glyph: '✓',
        actionable: false,
      });
    }
  }

  // 4. С кем вы делите чаще всего — общая история, а не статистика
  const together = new Map<string, number>();
  for (const s of db.splits) {
    for (const m of s.members) {
      if (m.isYou) continue;
      together.set(m.contactId, (together.get(m.contactId) ?? 0) + 1);
    }
  }
  const top = [...together.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    const name = nameOf(top[0]);
    if (name) {
      out.push({
        id: 'together:' + top[0],
        kind: 'together',
        title: name,
        captionKey: 'activity.together',
        captionParams: { n: top[1] },
        contactId: top[0],
        glyph: '🤝',
        actionable: false,
      });
    }
  }

  return out.slice(0, LIMIT);
}
