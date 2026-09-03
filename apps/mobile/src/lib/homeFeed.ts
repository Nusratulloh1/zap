// Лента новой главной (прототип «Главная»): кто что сделал за столом.
//
// Прототип показывает ленту сообщениями — «Shoshiy закрыл 400 000 за пиццу»,
// «Crew словил +10 000 кэшбэка», «Ислам ещё не оплатил». Собираем её из уже
// загруженного /bootstrap: сначала то, что требует действия (кто не заплатил),
// потом история.
//
// Ничего не выдумываем: если данных нет, лента просто короче.
import { translate } from '@/i18n';
import { entryText } from '@/lib/entryText';
import { humanDateLc, money } from '@/lib/format';
import type { Db } from '@zap/shared/types';

export interface FeedItem {
  id: string;
  /** имя человека или «Crew» */
  who: string;
  /** что сделал — основная строка */
  text: string;
  /** хвост серым: название компании или «3 часа» */
  tail?: string;
  /** «12:05 · Bellissimo» */
  time: string;
  contactId?: string;
  /** вместо аватара — лаймовый кружок с молнией (события самого ZAP) */
  bolt?: boolean;
  /** аватар приглушён: человек ещё не оплатил */
  dim?: boolean;
  /** относится к компании — по этому фильтруется лента */
  crew: boolean;
  splitId?: string;
  /** кого пингуем: id участника сплита */
  memberId?: string;
}

const LIMIT = 24;

export function homeFeed(db: Db | undefined, nameOf: (id: string) => string): FeedItem[] {
  if (!db) return [];

  const out: FeedItem[] = [];
  const groupName = (id?: string) => db.groups.find((g) => g.id === id)?.name;
  const merchantOf = (merchantId?: string, title?: string) =>
    db.merchants.find((m) => m.id === merchantId)?.name ?? title ?? '';

  // 1. Кто держит стол: незакрытые доли в активных сплитах
  for (const s of db.splits.filter((x) => x.status === 'active')) {
    for (const m of s.members) {
      if (m.status === 'paid' || m.status === 'debt' || m.isYou) continue;
      out.push({
        id: `wait:${s.id}:${m.contactId}`,
        who: nameOf(m.contactId),
        text: translate('home2.feedWaiting', { amount: money(m.amount) }),
        tail: groupName(s.groupId) ? `· ${groupName(s.groupId)}` : undefined,
        time: `${humanDateLc(s.createdAt)} · ${merchantOf(s.merchantId, s.title)}`,
        contactId: m.contactId,
        dim: true,
        crew: !!s.groupId,
        splitId: s.id,
        memberId: (m as { memberId?: string }).memberId ?? m.contactId,
      });
    }
  }

  // 2. История: оплаты, кэшбэк, закрытые счета
  for (const h of db.history) {
    const title = entryText(h.title, h.titleKey);
    const sub = entryText(h.subtitle, h.subtitleKey);
    const isCashback = h.kind === 'cashback';
    out.push({
      id: `h:${h.id}`,
      who: h.contactId ? nameOf(h.contactId) : translate('home2.feedZap'),
      text: isCashback
        ? translate('home2.feedCashback', { amount: money(Math.abs(h.amount)) })
        : translate('home2.feedPaid', { amount: money(Math.abs(h.amount)), what: title }),
      tail: sub ? `· ${sub}` : undefined,
      time: `${humanDateLc(h.createdAt)} · ${title}`,
      contactId: h.contactId,
      bolt: !h.contactId,
      crew: !!db.splits.find((s) => s.id === h.splitId)?.groupId,
      splitId: h.splitId,
    });
  }

  return out.slice(0, LIMIT);
}
