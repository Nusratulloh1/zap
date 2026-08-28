import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import type { PaymentProvider, PaymentResult } from './payment.provider'

/** Леджер-заглушка MVP: всегда успешна, но каждая операция — строка Transaction. */
@Injectable()
export class InternalWalletProvider implements PaymentProvider {
  constructor(private readonly prisma: PrismaService) {}

  async charge(userId: string, amountUzs: number, ref: string): Promise<PaymentResult> {
    const tx = await this.prisma.transaction.create({
      data: { userId, amount: -Math.abs(amountUzs), kind: 'charge', ref },
    })
    return { ok: true, txId: tx.id }
  }

  async payout(userId: string, _cardId: string, amountUzs: number, ref: string): Promise<PaymentResult> {
    const tx = await this.prisma.transaction.create({
      data: { userId, amount: Math.abs(amountUzs), kind: 'payout', ref },
    })
    return { ok: true, txId: tx.id }
  }
}
