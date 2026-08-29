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

/** Состояние фискального чека: позиции догружаются после сканирования QR. */
export interface FiscalMeta {
  jobId?: string;
  ocr?: boolean;
  merchant?: string;
  receiptTotal?: number;
  status: 'pending' | 'ready' | 'failed';
}

interface DraftState {
  total: number;
  title: string;
  mode: SplitMode;
  bill: Bill | null;
  merchantId?: string;
  members: DraftMember[];
  /** источник черновика: фискальный чек требует экрана проверки позиций */
  fiscal: FiscalMeta | null;
  scannedPayload?: string;

  startManual: (total: number) => void;
  startForBill: (bill: Bill, merchantId?: string) => void;
  startFiscal: (total: number, jobId?: string, payload?: string) => void;
  applyFiscalItems: (r: { merchant?: string; total: number; items: { id: string; name: string; qty: number; amount: number }[] }, ocr: boolean) => void;
  fiscalFailed: () => void;
  startForGroup: (bill: Bill | null, memberIds: string[]) => void;
  setMode: (mode: SplitMode) => void;
  setTitle: (title: string) => void;
  toggleMember: (contactId: string) => void;
  setMemberAmount: (contactId: string, amount: number) => void;
  toggleDebt: (contactId: string) => void;
  toggleItem: (contactId: string, itemId: string) => void;
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
  fiscal: null,
  scannedPayload: undefined,

  startManual: (total) =>
    set({ total, mode: 'equal', bill: null, fiscal: null, merchantId: undefined, members: [{ contactId: ME, amount: total }] }),

  startForBill: (bill, merchantId) =>
    set({
      total: bill.total,
      mode: 'equal',
      bill,
      fiscal: null,
      merchantId,
      members: [{ contactId: ME, amount: bill.total }],
    }),

  /** QR фискального чека: тотал может быть неизвестен, позиции догружаются. */
  startFiscal: (total, jobId, payload) =>
    set({
      total,
      mode: 'equal',
      merchantId: undefined,
      scannedPayload: payload,
      bill: { merchantId: '', orderNo: '', time: '', items: [], total },
      fiscal: { jobId, status: 'pending' },
      members: [{ contactId: ME, amount: total }],
    }),

  /** Позиции пришли (сервер или OCR) — чек заполняется, сплит идёт через проверку. */
  applyFiscalItems: (r, ocr) =>
    set((st) => ({
      total: r.total,
      bill: {
        merchantId: st.bill?.merchantId ?? '',
        orderNo: st.bill?.orderNo ?? '',
        time: st.bill?.time ?? '',
        total: r.total,
        items: r.items.map((i) => ({ id: i.id, title: i.name, qty: i.qty, amount: i.amount })),
      },
      fiscal: { ...(st.fiscal ?? { status: 'ready' }), merchant: r.merchant, receiptTotal: r.total, ocr, status: 'ready' },
      members: [{ contactId: ME, amount: r.total }],
    })),

  fiscalFailed: () => set((st) => ({ fiscal: st.fiscal ? { ...st.fiscal, status: 'failed' } : { status: 'failed' } })),

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
    // «Вручную» стартует с равных долей — дальше редактируется (как в вебе)
    if (mode === 'equal' || mode === 'manual') get().recalcEqual();
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

  toggleItem: (contactId, itemId) =>
    set({
      members: get().members.map((m) => {
        if (m.contactId !== contactId) return m;
        const ids = m.itemIds ?? [];
        return { ...m, itemIds: ids.includes(itemId) ? ids.filter((i) => i !== itemId) : [...ids, itemId] };
      }),
    }),

  /** поровну: остаток от деления достаётся первым участникам, как в вебе */
  recalcEqual: () => {
    const { total, members } = get();
    const shares = equalShares(total, members.length);
    set({ members: members.map((m, i) => ({ ...m, amount: shares[i] ?? 0 })) });
  },

  reset: () =>
    set({ total: 0, title: '', mode: 'equal', bill: null, fiscal: null, scannedPayload: undefined, merchantId: undefined, members: [{ contactId: ME, amount: 0 }] }),
}));

/** Сумма, которую организатор платит сейчас: своя доля + доли взятых в долг. */
export function payNowOf(members: DraftMember[]): number {
  return members.filter((m) => m.contactId === ME || m.debt).reduce((s, m) => s + m.amount, 0);
}

/** Расхождение с итогом — для ручного режима. */
export function mismatchOf(total: number, members: DraftMember[]): number {
  return members.reduce((s, m) => s + m.amount, 0) - total;
}

/** Итоговые доли по режиму, с округлением до 1 000 UZS — как shares в веб-сторе. */
export function sharesOf(st: Pick<DraftState, 'mode' | 'total' | 'members' | 'bill'>): Record<string, number> {
  const out: Record<string, number> = {};
  if (st.mode === 'equal') {
    const list = equalShares(st.total, st.members.length);
    st.members.forEach((m, i) => (out[m.contactId] = list[i] ?? 0));
  } else if (st.mode === 'manual') {
    st.members.forEach((m) => (out[m.contactId] = m.amount));
  } else {
    st.members.forEach((m) => (out[m.contactId] = 0));
    for (const item of st.bill?.items ?? []) {
      const assignees = st.members.filter((m) => (m.itemIds ?? []).includes(item.id));
      if (!assignees.length) continue;
      const parts = equalShares(item.amount, assignees.length);
      assignees.forEach((m, i) => (out[m.contactId] = (out[m.contactId] ?? 0) + (parts[i] ?? 0)));
    }
  }
  return out;
}

/** Сколько позиций чека никому не назначено (режим «По позициям»). */
export function unassignedItemsOf(st: Pick<DraftState, 'mode' | 'members' | 'bill'>): number {
  if (st.mode !== 'items' || !st.bill) return 0;
  return st.bill.items.filter((item) => !st.members.some((m) => (m.itemIds ?? []).includes(item.id))).length;
}
