// Леджер долгов: owed-to-me / I-owe, напоминания (SMS, троттлинг 30 мин),
// settlement через ZAP: платёж должника → кредитору, релиз held_debt-кэшбэка.
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { SmsService } from '../sms/sms.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { HistoryService } from '../history/history.service'
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment.provider'

const REMIND_INTERVAL_MS = 30 * 60_000

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly realtime: RealtimeGateway,
    private readonly history: HistoryService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async list(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const [owedToMe, iOwe] = await Promise.all([
      this.prisma.debt.findMany({ where: { creditorId: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.debt.findMany({
        where: { OR: [{ debtorUserId: userId }, { debtorPhone: me.phone }] },
        orderBy: { createdAt: 'desc' },
        include: { creditor: { select: { name: true, phone: true } } },
      }),
    ])
    return { owedToMe, iOwe }
  }

  async remind(userId: string, debtId: string) {
    const debt = await this.prisma.debt.findUnique({ where: { id: debtId } })
    if (!debt || debt.creditorId !== userId) throw new NotFoundException('Долг не найден')
    if (debt.status !== 'open') throw new BadRequestException('Долг уже погашен')
    if (debt.lastRemindedAt && Date.now() - debt.lastRemindedAt.getTime() < REMIND_INTERVAL_MS)
      throw new BadRequestException('Напоминание уже отправлено — подождите 30 минут')
    const creditor = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    await this.sms.send(
      debt.debtorPhone,
      `ZAP! ${creditor.name || 'Друг'} напоминает про долг ${debt.amount.toLocaleString('ru')} UZS (${debt.reason})`,
      'reminder',
    )
    await this.prisma.debt.update({ where: { id: debtId }, data: { lastRemindedAt: new Date() } })
    return { ok: true }
  }

  async remindAll(userId: string) {
    const open = await this.prisma.debt.findMany({ where: { creditorId: userId, status: 'open' } })
    let sent = 0
    for (const d of open) {
      if (d.lastRemindedAt && Date.now() - d.lastRemindedAt.getTime() < REMIND_INTERVAL_MS) continue
      await this.remind(userId, d.id).catch(() => undefined)
      sent++
    }
    return { ok: true, sent }
  }

  /** Погашение через ZAP: платит ДОЛЖНИК (или кредитор помечает возврат).
   *  Закрывает долг, релизит held_debt-кэшбэк, история обеим сторонам, realtime. */
  async settle(actorId: string, debtId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id: debtId }, include: { creditor: true } })
      if (!debt) throw new NotFoundException('Долг не найден')
      const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } })
      const isDebtor = debt.debtorUserId === actorId || debt.debtorPhone === actor.phone
      const isCreditor = debt.creditorId === actorId
      if (!isDebtor && !isCreditor) throw new ForbiddenException()
      if (debt.status !== 'open') return { debt, released: 0, already: true }

      // движение денег: должник платит через ZAP (леджер);
      // кредитор, помечающий возврат «наличными», денег не двигает
      if (isDebtor) {
        await this.payments.charge(actorId, debt.amount, `debt:${debt.id}`)
        await this.payments.payout(debt.creditorId, 'internal', debt.amount, `debt:${debt.id}`)
      }

      const updated = await tx.debt.update({
        where: { id: debtId },
        data: { status: 'settled', settledAt: new Date(), debtorUserId: debt.debtorUserId ?? (isDebtor ? actorId : null) },
      })

      // релиз удержанного кэшбэка должника по этому долгу
      const held = await tx.cashbackEntry.findMany({ where: { releasedByDebtId: debtId, status: 'held_debt' } })
      let released = 0
      for (const e of held) {
        await tx.cashbackEntry.update({ where: { id: e.id }, data: { status: 'available' } })
        released += e.amount
      }

      await this.history.record(tx, debt.creditorId, 'debt', {
        refId: debtId,
        amountSigned: debt.amount,
        meta: { title: `${debt.debtorName || 'Должник'} вернул долг`, subtitle: debt.reason, splitId: debt.splitId, phone: debt.debtorPhone },
      })
      if (debt.debtorUserId ?? (isDebtor ? actorId : null)) {
        await this.history.record(tx, debt.debtorUserId ?? actorId, 'debt', {
          refId: debtId,
          amountSigned: -debt.amount,
          meta: { title: 'Долг погашен', subtitle: debt.reason, splitId: debt.splitId },
        })
      }
      return { debt: updated, released, already: false }
    })

    if (!result.already) {
      this.realtime.emitUser(result.debt.creditorId, 'debt_settled', { debtId, amount: result.debt.amount })
      if (result.debt.debtorUserId)
        this.realtime.emitUser(result.debt.debtorUserId, 'debt_settled', { debtId, releasedCashback: result.released })
      if (result.debt.splitId) {
        const split = await this.prisma.split.findUnique({ where: { id: result.debt.splitId } })
        if (split) this.realtime.emitSplit(split.code, 'debt_settled', { debtId })
      }
    }
    return { ok: true, releasedCashback: result.released }
  }
}
