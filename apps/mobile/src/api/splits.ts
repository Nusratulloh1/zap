// Ручки сплита. Контракт тот же, что у веба (web/src/api/real.ts): участники
// уходят телефоном и именем, а не нашим локальным contactId, сумма — только
// когда сплит не привязан к чеку.
import { http } from './client';
import type { Contact, Split, SplitMode } from '@zap/shared/types';

export interface DraftMemberInput {
  contactId: string;
  amount: number;
  debt?: boolean;
  itemIds?: string[];
}

export interface CreateSplitInput {
  total: number;
  title: string;
  mode: SplitMode;
  merchantId?: string;
  billId?: string;
  members: DraftMemberInput[];
}

/**
 * Организатор («me») в запрос не попадает — сервер добавляет его сам.
 * Idempotency-Key защищает от двойного создания при ретрае.
 */
export async function createSplit(input: CreateSplitInput, contacts: Contact[] = []): Promise<Split> {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const members = input.members
    .filter((m) => m.contactId !== 'me')
    .map((m) => {
      const c = byId.get(m.contactId);
      return {
        phone: c?.phone ?? m.contactId,
        name: c?.name ?? '?',
        shareAmount: m.amount,
        inDebt: m.debt || undefined,
        itemIds: m.itemIds,
      };
    });

  return http<Split>('/splits', {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `create-${Date.now().toString(36)}` },
    body: JSON.stringify({
      billId: input.billId,
      totalAmount: input.billId ? undefined : input.total,
      title: input.title,
      mode: input.mode,
      merchantId: input.merchantId,
      members,
    }),
  });
}

/**
 * Как в вебе: сплит читается из /bootstrap — сервер там уже отдал сплиты в
 * локальной форме (total/amount/contactId + memberNames). Прямая ручка
 * /splits/:id отдаёт сырую форму (totalAmount/shareAmount) и ломала экран.
 */
export async function fetchSplit(id: string): Promise<Split> {
  const db = await http<{ splits: Split[] }>('/bootstrap');
  const split = db.splits.find((s) => s.id === id);
  if (!split) throw new Error('split not found');
  return split;
}

export function remindMember(splitId: string, memberId: string): Promise<{ ok: boolean }> {
  return http(`/splits/${splitId}/remind/${memberId}`, { method: 'POST' });
}

export function sendSplitLinkSms(splitId: string): Promise<{ sent: number }> {
  return http(`/splits/${splitId}/send-link`, { method: 'POST' });
}

/**
 * Закрыть чужие доли. Без `memberIds` — весь остаток; со списком — доли
 * конкретных людей: в макете «Дать в долг» стоит у каждого корешка отдельно.
 */
export function coverRemainder(splitId: string, memberIds?: string[]): Promise<Split> {
  return http(`/splits/${splitId}/cover`, {
    method: 'POST',
    pt: true,
    ...(memberIds ? { body: JSON.stringify({ memberIds }) } : {}),
  });
}

export function saveGroup(
  splitId: string,
  name: string,
  accrueCashback: boolean,
  memberIds?: string[],
): Promise<{ id: string }> {
  return http(`/splits/${splitId}/save-group`, {
    method: 'POST',
    body: JSON.stringify({ name, accrueCashback, memberIds }),
  });
}

/**
 * Реакция на оплату участника: ⚡ 😂 ❤️ 🫡 🤝 (vision §16).
 * Повторный тап тем же эмодзи снимает реакцию — сервер вернёт emoji: null.
 */
export function reactToMember(splitId: string, memberId: string, emoji: string): Promise<{ emoji: string | null }> {
  return http(`/splits/${splitId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ memberId, emoji }),
  });
}

/** Своё название счёта: «🍕 Boys Dinner» вместо мерчанта (vision §14). */
export function renameSplit(splitId: string, title: string): Promise<{ title: string }> {
  return http(`/splits/${splitId}`, { method: 'PATCH', body: JSON.stringify({ title }) });
}
