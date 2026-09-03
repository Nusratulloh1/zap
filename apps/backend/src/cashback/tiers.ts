/**
 * Ступени ставки кэшбэка компании.
 *
 * «Чем больше сплитите вместе, тем выше процент» — ставка растёт от общего
 * накопленного пула компании за всё время (решение руководства: считаем по
 * общей сумме, а не за месяц, иначе в начале каждого месяца ставка падала бы
 * и это читалось бы как наказание).
 *
 * Пороги держим в коде, а не в БД: это продуктовое решение, меняется чаще
 * схемы, и менять его миграцией — дороже, чем правкой одной строки.
 */
export interface Tier {
  /** накопленный пул компании, с которого действует ставка */
  pool: number
  /** ставка в базисных пунктах: 250 = 2.5% */
  bp: number
}

export const TIERS: readonly Tier[] = [
  { pool: 0, bp: 200 },
  { pool: 25_000, bp: 250 },
  { pool: 50_000, bp: 300 },
]

/** Текущая ставка по накопленному пулу. */
export function rateForPool(pool: number): number {
  let bp = TIERS[0]!.bp
  for (const t of TIERS) if (pool >= t.pool) bp = t.bp
  return bp
}

/** Следующая ступень: сколько ещё накопить и какая ставка будет. */
export function nextTier(pool: number): { need: number; bp: number } | null {
  const next = TIERS.find((t) => pool < t.pool)
  return next ? { need: next.pool - pool, bp: next.bp } : null
}
