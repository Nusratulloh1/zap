import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.merchant.findMany()
  }

  create(data: { name: string; letter?: string; color?: string; cashbackRate?: number; cashbackX2?: boolean }) {
    return this.prisma.merchant.create({ data })
  }

  async createBill(
    merchantId: string,
    data: { externalRef: string; tableRef?: string; items: { title: string; qty: number; amount: number }[] },
  ) {
    const total = data.items.reduce((s, i) => s + i.amount, 0)
    return this.prisma.bill.create({
      data: {
        merchantId,
        externalRef: data.externalRef,
        tableRef: data.tableRef,
        totalAmount: total,
        qrPayload: `zap:bill:${merchantId}:${data.externalRef}:${Date.now().toString(36)}`,
        items: { create: data.items },
      },
      include: { items: true },
    })
  }

  /** QR-резолв: ZAP-ссылка на сплит → {type:'split'}, зарегистрированный счёт →
   *  {type:'bill'}, иначе {type:'unknown'} — фронт предложит ручную сумму. */
  async resolveQr(payload: string) {
    const linkMatch = payload.match(/\/s\/([\dA-Z-]{5,12})\b/i)
    if (linkMatch) {
      const split = await this.prisma.split.findUnique({ where: { code: linkMatch[1]!.toUpperCase() } })
      if (split) return { type: 'split' as const, code: split.code }
    }
    const bill = await this.prisma.bill.findUnique({
      where: { qrPayload: payload },
      include: { items: true, merchant: true },
    })
    if (bill) {
      return {
        type: 'bill' as const,
        bill: {
          billId: bill.id,
          merchantId: bill.merchantId,
          orderNo: bill.externalRef,
          table: bill.tableRef ?? undefined,
          time: bill.createdAt.toISOString().slice(11, 16),
          items: bill.items.map((i) => ({ id: i.id, title: i.title, qty: i.qty, amount: i.amount })),
          total: bill.totalAmount,
        },
      }
    }
    return { type: 'unknown' as const }
  }

  async featuredBill() {
    const bill = await this.prisma.bill.findFirst({ orderBy: { createdAt: 'desc' }, include: { items: true } })
    if (!bill) throw new NotFoundException('Демо-счёт не загружен (pnpm seed:demo)')
    return bill
  }
}

/** Стаб фискального QR: реальная интеграция с ОФД — следующая фаза.
 *  Контракт: parse(payload) → { fiscalSign, receiptNo, amount } | null. */
export class FiscalQrService {
  parse(_payload: string): { fiscalSign: string; receiptNo: string; amount: number } | null {
    // TODO(next-phase): парсинг фискальных QR (ofd.uz) и подтяжка чека
    return null
  }
}
