// Чистая математика чипов на экране участника /s/:code — единый контракт
// с фронтом (ParticipantPage.vue). Всё выводится СТРОГО из доли участника.
//   myShare — доля участника (member.shareAmount)
//   half    — половина, округлённая до 1000
//   double  — «за двоих», зажатая остатком неоплаченного сплита
//   quick   — фиксированные суммы только если они МЕНЬШЕ доли
export const round1000 = (n: number) => Math.round(n / 1000) * 1000

export interface ChipInput {
  share: number
  total: number
  paidTotal: number
  quick?: number[]
}

export interface Chips {
  myShare: number
  half: number
  double: number
  quick: number[]
  remaining: number
}

export function participantChips({ share, total, paidTotal, quick = [100000, 250000] }: ChipInput): Chips {
  const remaining = Math.max(0, total - paidTotal)
  return {
    myShare: share,
    half: round1000(share / 2),
    double: Math.min(share * 2, remaining),
    quick: quick.filter((q) => q < share),
    remaining,
  }
}

/** Кламп суммы оплаты — ровно как в SplitsService.payPublic. */
export function clampCharge(amount: number, total: number, effectivePaid: number): number {
  const remaining = total - effectivePaid
  return Math.max(0, Math.min(amount, remaining))
}
