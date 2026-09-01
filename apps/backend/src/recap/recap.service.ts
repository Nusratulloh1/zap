import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'

/** Одна панель «итогов месяца» отдаётся сырыми числами — верстает клиент. */
export interface MonthlyRecap {
  /** YYYY-MM, за который посчитано */
  month: string
  /** сколько сплитов закрыто с участием пользователя */
  zaps: number
  /** сумма закрытых сплитов, в тийинах — как и везде в API */
  totalSplit: number
  /**
   * Разбивка по заведениям. Тему (еда/кофе/такси) выбирает клиент по
   * названию: словарь ключевых слов живёт в мобильном merchantTheme.ts, и
   * дублировать его на сервере, пока у Merchant нет поля category, — значит
   * заводить второй источник правды.
   */
  byMerchant: { name: string; count: number; amount: number }[]
  /** С кем чаще всего делили. null, если месяц был одиночным. */
  topBuddy: { name: string; count: number } | null
  /** Куда чаще всего ходили. */
  favouriteSpot: { name: string; count: number } | null
  /** Пустой месяц: клиент показывает заглушку, а не пустые панели. */
  empty: boolean
}

@Injectable()
export class RecapService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Кэш на процесс: месяц уже закрыт и его цифры не меняются, а панели
   * открывают часто (карточка на главной). Ключ — пользователь+месяц.
   * Текущий месяц не кэшируем: он ещё дописывается.
   */
  private cache = new Map<string, MonthlyRecap>()

  /** `month` — YYYY-MM. По умолчанию предыдущий месяц. */
  async forUser(userId: string, month?: string): Promise<MonthlyRecap> {
    const key = month ?? previousMonth()
    const cacheKey = `${userId}:${key}`
    if (!isCurrentMonth(key)) {
      const hit = this.cache.get(cacheKey)
      if (hit) return hit
    }

    const { from, to } = monthRange(key)

    // Берём сплиты, где пользователь состоял участником и которые закрылись
    // внутри месяца. Именно closedAt, а не createdAt: месяц подводит итог по
    // завершённым историям, иначе в отчёт попадут висящие сплиты.
    const splits = await this.prisma.split.findMany({
      where: {
        status: 'closed',
        closedAt: { gte: from, lt: to },
        members: { some: { userId } },
      },
      select: {
        totalAmount: true,
        merchant: { select: { name: true } },
        title: true,
        members: { select: { userId: true, displayName: true } },
      },
    })

    const byMerchant = new Map<string, { count: number; amount: number }>()
    const buddies = new Map<string, number>()
    let totalSplit = 0

    for (const s of splits) {
      totalSplit += s.totalAmount
      // без мерчанта заведением считаем название сплита — иначе «любимое
      // место» потеряет половину месяца на ручных счетах
      const spot = s.merchant?.name ?? s.title
      const cur = byMerchant.get(spot) ?? { count: 0, amount: 0 }
      byMerchant.set(spot, { count: cur.count + 1, amount: cur.amount + s.totalAmount })

      for (const m of s.members) {
        if (!m.userId || m.userId === userId) continue
        buddies.set(m.displayName, (buddies.get(m.displayName) ?? 0) + 1)
      }
    }

    const merchants = [...byMerchant.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount)

    const topBuddyEntry = [...buddies.entries()].sort((a, b) => b[1] - a[1])[0]

    const recap: MonthlyRecap = {
      month: key,
      zaps: splits.length,
      totalSplit,
      byMerchant: merchants,
      topBuddy: topBuddyEntry ? { name: topBuddyEntry[0], count: topBuddyEntry[1] } : null,
      favouriteSpot: merchants[0] ? { name: merchants[0].name, count: merchants[0].count } : null,
      empty: splits.length === 0,
    }

    if (!isCurrentMonth(key)) this.cache.set(cacheKey, recap)
    return recap
  }
}

// --- работа с месяцами -----------------------------------------------------

function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number)
  const from = new Date(Date.UTC(y!, (m ?? 1) - 1, 1))
  const to = new Date(Date.UTC(y!, m ?? 1, 1))
  return { from, to }
}

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function isCurrentMonth(month: string): boolean {
  return month === ym(new Date())
}

/** Рекап показываем за прошедший месяц — текущий ещё не закончился. */
function previousMonth(): string {
  const d = new Date()
  return ym(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))
}
