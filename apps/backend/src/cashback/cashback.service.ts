import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { HistoryService } from '../history/history.service'
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment.provider'

@Injectable()
export class CashbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async balance(userId: string): Promise<number> {
    const agg = await this.prisma.cashbackEntry.aggregate({
      where: { userId, status: { in: ['available', 'spent', 'withdrawn'] } },
      _sum: { amount: true },
    })
    return Math.max(0, agg._sum.amount ?? 0)
  }

  async overview(userId: string, cursor?: string, limit = 30) {
    const rows = await this.prisma.cashbackEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const items = rows.slice(0, limit)
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } })
    return {
      balance: await this.balance(userId),
      pendingNextSplit: settings?.pendingCashback ?? 0,
      entries: items,
      nextCursor: rows.length > limit ? items[items.length - 1]?.id : null,
    }
  }

  /** Резерв доступного баланса на следующий сплит (применится при создании). */
  async spendOnNext(userId: string) {
    const balance = await this.balance(userId)
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, pendingCashback: balance },
      update: { pendingCashback: balance },
    })
    return { pendingCashback: balance }
  }

  async withdraw(userId: string, cardId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Сумма должна быть больше нуля')
    const card = await this.prisma.card.findFirst({ where: { id: cardId, userId } })
    if (!card) throw new NotFoundException('Карта не найдена')
    const balance = await this.balance(userId)
    if (amount > balance) throw new BadRequestException('Недостаточно кэшбэка')

    await this.prisma.$transaction(async (tx) => {
      await tx.cashbackEntry.create({
        data: {
          userId,
          amount: -amount,
          status: 'withdrawn',
          title: 'Вывод на карту',
          badge: `·· ${card.last4}`,
        },
      })
      await this.history.record(tx, userId, 'cashback', {
        amountSigned: -amount,
        meta: { title: 'Вывод кэшбэка', subtitle: `${card.brand} ·· ${card.last4}`, letter: '%' },
      })
    })
    await this.payments.payout(userId, cardId, amount, `cashback:withdraw:${Date.now()}`)
    return { ok: true, balance: await this.balance(userId) }
  }
}
