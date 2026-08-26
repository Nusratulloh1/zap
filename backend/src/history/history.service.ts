// Лента активности пишется доменным подписчиком (этот сервис), никогда не
// вычисляется ад-хок. meta несёт презентационные поля для клиента.
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'

type Tx = Prisma.TransactionClient

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tx: Tx | null,
    userId: string,
    type: 'split' | 'cashback' | 'debt' | 'payment',
    data: { refId?: string; amountSigned: number; meta?: Record<string, unknown> },
  ) {
    const client = tx ?? this.prisma
    await client.historyEvent.create({
      data: {
        userId,
        type,
        refId: data.refId,
        amountSigned: data.amountSigned,
        meta: (data.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
  }

  async list(userId: string, cursor?: string, limit = 30) {
    const rows = await this.prisma.historyEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const items = rows.slice(0, limit)
    return { items, nextCursor: rows.length > limit ? items[items.length - 1]?.id : null }
  }
}
