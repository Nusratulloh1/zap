// Черновик сплита между экранами: сумма → участники → PIN → создание.
// Повторяет entities/stores/draft.ts из веба, включая пересчёт долей.
import { create } from 'zustand';
import { equalShares } from '@zap/shared/money';
import type { Bill, SplitMode } from '@zap/shared/types';

export interface DraftMember {
  contactId: string;
  amount: number;
  /** участник берёт свою долю в долг у организатора */
  debt?: boolean;
  itemIds?: string[];
}

interface DraftState {
  total: number;
  title: string;
  mode: SplitMode;
  bill: Bill | null;
  merchantId?: string;
  members: DraftMember[];

  startManual: (total: number) => void;
  startForBill: (bill: Bill, merchantId?: string) => void;
  startForGroup: (bill: Bill | null, memberIds: string[]) => void;
  setMode: (mode: SplitMode) => void;
  setTitle: (title: string) => void;
  toggleMember: (contactId: string) => void;
  setMemberAmount: (contactId: string, amount: number) => void;
  toggleDebt: (contactId: string) => void;
  recalcEqual: () => void;
  reset: () => void;
}

const ME = 'me';

export const useDraft = create<DraftState>((set, get) => ({
  total: 0,
  title: '',
  mode: 'equal',
  bill: null,
  members: [{ contactId: ME, amount: 0 }],

  startManual: (total) =>
    set({ total, mode: 'equal', bill: null, merchantId: undefined, members: [{ contactId: ME, amount: total }] }),

  startForBill: (bill, merchantId) =>
    set({
      total: bill.total,
      mode: 'equal',
      bill,
      merchantId,
      members: [{ contactId: ME, amount: bill.total }],
    }),

  startForGroup: (bill, memberIds) => {
    const total = bill?.total ?? 0;
    const ids = [ME, ...memberIds.filter((id) => id !== ME)];
    const shares = equalShares(total, ids.length);
    set({
      total,
      bill: bill ?? null,
      mode: 'equal',
      members: ids.map((contactId, i) => ({ contactId, amount: shares[i] ?? 0 })),
    });
  },

  setMode: (mode) => {
    set({ mode });
    if (mode === 'equal') get().recalcEqual();
  },

  setTitle: (title) => set({ title }),

  toggleMember: (contactId) => {
    const { members } = get();
    const exists = members.some((m) => m.contactId === contactId);
    const next = exists
      ? members.filter((m) => m.contactId !== contactId)
      : [...members, { contactId, amount: 0 }];
    set({ members: next.length ? next : [{ contactId: ME, amount: 0 }] });
    if (get().mode === 'equal') get().recalcEqual();
  },

  setMemberAmount: (contactId, amount) =>
    set({ members: get().members.map((m) => (m.contactId === contactId ? { ...m, amount } : m)) }),

  toggleDebt: (contactId) =>
    set({ members: get().members.map((m) => (m.contactId === contactId ? { ...m, debt: !m.debt } : m)) }),

  /** поровну: остаток от деления достаётся первым участникам, как в вебе */
  recalcEqual: () => {
    const { total, members } = get();
    const shares = equalShares(total, members.length);
    set({ members: members.map((m, i) => ({ ...m, amount: shares[i] ?? 0 })) });
  },

  reset: () =>
    set({ total: 0, title: '', mode: 'equal', bill: null, merchantId: undefined, members: [{ contactId: ME, amount: 0 }] }),
}));

/** Сумма, которую организатор платит сейчас: своя доля + доли взятых в долг. */
export function payNowOf(members: DraftMember[]): number {
  return members.filter((m) => m.contactId === ME || m.debt).reduce((s, m) => s + m.amount, 0);
}

/** Расхождение с итогом — для ручного режима. */
export function mismatchOf(total: number, members: DraftMember[]): number {
  return members.reduce((s, m) => s + m.amount, 0) - total;
}
