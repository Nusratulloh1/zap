// Движок сплитов: создание, публичный просмотр/оплата по коду, cover, remind,
// автозакрытие с начислением кэшбэка. Денежные операции — в транзакциях
// с row-lock на Split (SELECT ... FOR UPDATE) против гонок двойной оплаты.
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { MemberStatus, Prisma, SplitMode } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { SmsService } from '../sms/sms.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { PushService } from '../push/push.service'
import { pushText } from '../push/push.i18n'
import { HistoryService } from '../history/history.service'
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment.provider'
import { makeSplitCode, normalizePhone, round1000 } from '../common/utils'
import { FRIEND_FALLBACK, smsText } from '../sms/sms.i18n'

export interface CreateSplitMemberInput {
  phone: string
  name: string
  shareAmount?: number
  inDebt?: boolean
  itemIds?: string[]
}

export interface CreateSplitInput {
  billId?: string
  totalAmount?: number
  title: string
  mode: SplitMode
  merchantId?: string
  members: CreateSplitMemberInput[]
}

type Tx = Prisma.TransactionClient

const REMIND_INTERVAL_MS = 30 * 60_000

/** Набор реакций продукта (vision §3). Свободный ввод не принимаем. */
export const REACTION_EMOJI: readonly string[] = ['⚡', '😂', '❤️', '🫡', '🤝']


/** Сумма для текста уведомления: «167 283». Валюту добавляет сам шаблон. */
function fmtSum(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

@Injectable()
export class SplitsService {
  private readonly log = new Logger(SplitsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
    private readonly history: HistoryService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  // ---------- создание ----------

  async create(creatorId: string, input: CreateSplitInput) {
    const creator = await this.prisma.user.findUniqueOrThrow({ where: { id: creatorId } })
    const bill = input.billId
      ? await this.prisma.bill.findUniqueOrThrow({ where: { id: input.billId }, include: { items: true } })
      : null
    const total = bill?.totalAmount ?? input.totalAmount
    if (!total || total <= 0) throw new BadRequestException('Сумма сплита не задана')

    // участники: создатель всегда member[0]
    const others = input.members
      .filter((m) => normalizePhone(m.phone) !== creator.phone)
      .map((m) => ({ ...m, phone: normalizePhone(m.phone) }))
    const count = others.length + 1

    // сервер пересчитывает доли для equal; manual — проверяет сумму; items — по позициям
    let shares: number[]
    if (input.mode === 'equal') {
      const base = round1000(total / count)
      shares = [total - base * (count - 1), ...others.map(() => base)] // остаток округления — создателю
    } else if (input.mode === 'items' && bill) {
      const itemAmount = new Map(bill.items.map((i) => [i.id, i.amount]))
      const sumFor = (ids?: string[]) => (ids ?? []).reduce((s, id) => s + (itemAmount.get(id) ?? 0), 0)
      const otherShares = others.map((m) => sumFor(m.itemIds))
      shares = [total - otherShares.reduce((s, v) => s + v, 0), ...otherShares]
      if (shares[0]! < 0) throw new BadRequestException('Позиции распределены больше итога')
    } else {
      const otherShares = others.map((m) => m.shareAmount ?? 0)
      const mine = total - otherShares.reduce((s, v) => s + v, 0)
      if (mine < 0 || otherShares.some((v) => v <= 0))
        throw new BadRequestException('Сумма долей не сходится с итогом')
      shares = [mine, ...otherShares]
    }

    const merchantId = input.merchantId ?? bill?.merchantId ?? null

    const split = await this.prisma.$transaction(async (tx) => {
      // применяем зарезервированный «на следующий сплит» кэшбэк
      const settings = await tx.userSettings.findUnique({ where: { userId: creatorId } })
      const debtTotal = others.filter((m) => m.inDebt).reduce((s, m, i) => s + shares[i + 1]!, 0)
      const chargeBase = shares[0]! + debtTotal
      const discount = Math.min(settings?.pendingCashback ?? 0, chargeBase)
      if (discount > 0) {
        await tx.userSettings.update({ where: { userId: creatorId }, data: { pendingCashback: 0 } })
        await tx.cashbackEntry.create({
          data: {
            userId: creatorId,
            amount: -discount,
            status: 'spent',
            title: 'Потрачено на сплит',
            badge: input.title,
          },
        })
      }

      const created = await tx.split.create({
        data: {
          code: await this.uniqueCode(tx, bill?.externalRef),
          creatorId,
          billId: bill?.id,
          merchantId,
          title: input.title,
          totalAmount: total,
          mode: input.mode,
          members: {
            create: [
              {
                userId: creatorId,
                phone: creator.phone,
                displayName: creator.name || 'Вы',
                shareAmount: shares[0]!,
                status: 'paid',
                isCreator: true,
                paidAmount: shares[0]!,
                paidAt: new Date(),
              },
              ...others.map((m, i) => ({
                phone: m.phone,
                displayName: m.name,
                shareAmount: shares[i + 1]!,
                status: (m.inDebt ? 'debt' : 'pending') as MemberStatus,
                paidAt: m.inDebt ? new Date() : null,
                coveredById: m.inDebt ? creatorId : null,
              })),
            ],
          },
        },
        include: { members: true, merchant: true, bill: { include: { items: true } } },
      })

      // позиции (items-режим)
      if (input.mode === 'items' && bill) {
        for (let i = 0; i < others.length; i++) {
          const member = created.members.find((mm) => mm.phone === others[i]!.phone)
          for (const itemId of others[i]!.itemIds ?? []) {
            await tx.itemAssignment.create({
              data: { splitMemberId: member!.id, billItemId: itemId },
            })
          }
        }
      }

      // списание с создателя: своя доля + доли должников − скидка кэшбэком
      const charge = chargeBase - discount
      if (charge > 0) await this.payments.charge(creatorId, charge, `split:${created.id}`)

      // долги за inDebt-участников
      for (let i = 0; i < others.length; i++) {
        const m = others[i]!
        if (!m.inDebt) continue
        const debtorUser = await tx.user.findUnique({ where: { phone: m.phone } })
        const debt = await tx.debt.create({
          data: {
            creditorId: creatorId,
            debtorUserId: debtorUser?.id,
            debtorPhone: m.phone,
            debtorName: m.name,
            splitId: created.id,
            amount: shares[i + 1]!,
            reason: `${created.merchant?.name ?? created.title} · вы покрыли его долю`,
          },
        })
        await this.history.record(tx, creatorId, 'debt', {
          refId: debt.id,
          amountSigned: shares[i + 1]!,
          meta: {
            title: `${m.name} · в долг`,
            subtitle: created.merchant?.name ?? created.title,
            splitId: created.id,
            phone: m.phone,
          },
        })
      }

      await this.history.record(tx, creatorId, 'split', {
        refId: created.id,
        amountSigned: -charge,
        meta: {
          title: `${created.merchant?.name ?? created.title} · сплит${bill ? ' #' + bill.externalRef : ''}`,
          subtitle: `вы + ${others.length} человека`,
          note: discount > 0 ? `кэшбэк −${discount}` : undefined,
          splitId: created.id,
          letter: created.merchant?.letter,
          color: created.merchant?.color,
        },
      })

      return created
    })

    // SMS-ссылки ожидающим (вне транзакции; дедуп на участника — kind split_link)
    const origin = process.env.PWA_ORIGIN ?? 'http://localhost:5173'
    for (const m of split.members) {
      if (m.status !== 'pending') continue
      void this.sms
        .send(m.phone, `ZAP! ${creator.name || 'Друг'} просит вашу долю: ${origin}/s/${split.code}`, 'split_link')
        .catch((e) => this.log.warn(`split_link sms failed: ${String(e)}`))
    }

    await this.maybeClose(split.id)
    const fresh = await this.byIdOrThrow(split.id, creatorId)
    return fresh
  }

  private async uniqueCode(tx: Tx, orderNo?: string | null): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = makeSplitCode(orderNo)
      const exists = await tx.split.findUnique({ where: { code } })
      if (!exists) return code
    }
    return makeSplitCode(null) + Date.now().toString(36).slice(-2).toUpperCase()
  }

  // ---------- чтение ----------

  async byIdOrThrow(id: string, requesterId?: string) {
    const split = await this.prisma.split.findUnique({
      where: { id },
      include: { members: { orderBy: { isCreator: 'desc' } }, merchant: true, bill: { include: { items: true } } },
    })
    if (!split) throw new NotFoundException('Сплит не найден')
    if (requesterId && split.creatorId !== requesterId) {
      const isMember = split.members.some((m) => m.userId === requesterId)
      if (!isMember) throw new ForbiddenException()
    }
    return split
  }

  /** публичный санированный вид по коду: имена/инициалы, без телефонов чужих */
  async publicByCode(code: string, phone?: string) {
    const split = await this.prisma.split.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: { orderBy: { isCreator: 'desc' } }, merchant: true, bill: { include: { items: true } }, creator: true },
    })
    if (!split) throw new NotFoundException('Сплит не найден')
    const me = phone ? split.members.find((m) => m.phone === normalizePhone(phone)) : undefined

    // live-прогресс: сколько уже собрано (для полосы на экране участника)
    const paidTotal = split.members.reduce(
      (s, m) => s + (m.status === 'debt' || m.status === 'covered' ? m.shareAmount : m.paidAmount),
      0,
    )
    const paidCount = split.members.filter((m) => m.status === 'paid' || m.status === 'debt' || m.status === 'covered').length

    // кэшбэк участника: фактический (после закрытия) или превью (×2, пока активен)
    let yourCashback: number | null = null
    if (me) {
      const entry = await this.prisma.cashbackEntry.findFirst({
        where: { splitId: split.id, userId: me.userId ?? undefined, amount: { gt: 0 } },
      })
      if (entry) yourCashback = entry.amount
      else if (split.merchant && split.merchant.cashbackRate > 0 && split.members.length >= 2) {
        const base = Math.floor((me.shareAmount * split.merchant.cashbackRate) / 1000)
        yourCashback = round1000(base * (split.merchant.cashbackX2 ? 2 : 1))
      }
    }

    return {
      code: split.code,
      title: split.title,
      status: split.status,
      totalAmount: split.totalAmount,
      paidTotal,
      paidCount,
      memberCount: split.members.length,
      merchant: split.merchant ? { name: split.merchant.name, letter: split.merchant.letter, color: split.merchant.color } : null,
      bill: split.bill ? { orderNo: split.bill.externalRef, total: split.bill.totalAmount } : null,
      creatorName: (split.creator.name || 'Друг').split(' ')[0],
      cashbackX2: split.merchant?.cashbackX2 ?? false,
      yourCashback,
      members: split.members.map((m) => ({
        id: m.id,
        name: m.isCreator ? (split.creator.name || 'Создатель') : m.displayName,
        initial: (m.displayName || '?')[0],
        status: m.status,
        amount: m.id === me?.id || m.isCreator ? m.shareAmount : undefined,
        isYou: m.id === me?.id,
      })),
      yourShare: me?.shareAmount ?? null,
      yourStatus: me?.status ?? null,
    }
  }


  /**
   * Реакция на оплату участника: ⚡ 😂 ❤️ 🫡 🤝 (vision §16 «реакции прямо
   * на деньги»). Повторный тап тем же эмодзи снимает реакцию, другим —
   * заменяет: у пользователя одна реакция на участника.
   */
  async react(userId: string, splitId: string, memberId: string, emoji: string) {
    if (!REACTION_EMOJI.includes(emoji)) throw new BadRequestException('bad emoji')

    const member = await this.prisma.splitMember.findFirst({
      where: { id: memberId, splitId },
      select: { id: true, displayName: true, split: { select: { id: true, code: true, members: { select: { userId: true } } } } },
    })
    if (!member) throw new NotFoundException('member not found')

    // реагировать может только участник сплита
    const allowed = member.split.members.some((m) => m.userId === userId)
    if (!allowed) throw new ForbiddenException('not a participant')

    const existing = await this.prisma.reaction.findUnique({
      where: { memberId_fromUserId: { memberId, fromUserId: userId } },
      select: { id: true, emoji: true },
    })

    let emojiNow: string | null = emoji
    if (existing?.emoji === emoji) {
      await this.prisma.reaction.delete({ where: { id: existing.id } })
      emojiNow = null
    } else if (existing) {
      await this.prisma.reaction.update({ where: { id: existing.id }, data: { emoji } })
    } else {
      await this.prisma.reaction.create({ data: { splitId, memberId, fromUserId: userId, emoji } })
    }

    const from = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    this.realtime.emitSplit(member.split.code, 'reaction_added', {
      splitId,
      memberId,
      emoji: emojiNow,
      fromUserId: userId,
      fromName: (from?.name || '').split(' ')[0],
    })

    return { emoji: emojiNow }
  }

  /** Реакции сплита для проекции клиенту. */
  async reactionsOf(splitId: string) {
    const rows = await this.prisma.reaction.findMany({
      where: { splitId },
      select: { memberId: true, emoji: true, fromUserId: true, fromUser: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      memberId: r.memberId,
      emoji: r.emoji,
      fromUserId: r.fromUserId,
      fromName: (r.fromUser?.name || '').split(' ')[0],
    }))
  }

  /** Локаль организатора — запасной язык SMS участнику, которого ещё нет в базе. */
  async creatorLocale(code: string): Promise<string | null> {
    const split = await this.prisma.split.findUnique({
      where: { code: code.toUpperCase() },
      select: { creator: { select: { locale: true } } },
    })
    return split?.creator?.locale ?? null
  }

  // ---------- участник: открыл / оплатил ----------

  async markOpened(code: string, phone: string) {
    const p = normalizePhone(phone)
    const split = await this.prisma.split.findUnique({ where: { code: code.toUpperCase() }, include: { members: true } })
    if (!split || split.status !== 'active') return { ok: false }
    const member = split.members.find((m) => m.phone === p && m.status === 'pending')
    if (!member) return { ok: false }
    await this.prisma.splitMember.update({ where: { id: member.id }, data: { status: 'opened' } })
    this.realtime.emitSplit(split.code, 'member_opened', { memberId: member.id, name: member.displayName })
    this.realtime.emitUser(split.creatorId, 'member_opened', { splitId: split.id, name: member.displayName })
    return { ok: true }
  }

  /** оплата долей участника (public, после OTP participant_pay). Кламп: сумма
   *  оплат не может превысить остаток сплита. Row-lock на Split. */
  async payPublic(code: string, phone: string, amount: number) {
    const p = normalizePhone(phone)
    const result = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Split" WHERE code = ${code.toUpperCase()} FOR UPDATE`
      if (!locked) throw new NotFoundException('Сплит не найден')
      const split = await tx.split.findUniqueOrThrow({ where: { id: locked.id }, include: { members: true } })
      if (split.status !== 'active') throw new BadRequestException('Сплит уже закрыт')
      const member = split.members.find((m) => m.phone === p)
      if (!member) throw new NotFoundException('Вы не участник этого сплита')
      if (member.status === 'paid' || member.status === 'covered' || member.status === 'debt')
        return { split, member, charged: 0 }

      const effectivePaid = split.members.reduce(
        (s, m) => s + (m.status === 'debt' || m.status === 'covered' ? m.shareAmount : m.paidAmount),
        0,
      )
      const remaining = split.totalAmount - effectivePaid
      const charged = Math.max(0, Math.min(amount, remaining))
      if (charged <= 0) throw new BadRequestException('Сплит уже собран')

      const payer = await tx.user.findUnique({ where: { phone: p } })
      if (payer) await this.payments.charge(payer.id, charged, `split:${split.id}:member:${member.id}`)

      const newPaid = member.paidAmount + charged
      await tx.splitMember.update({
        where: { id: member.id },
        data: {
          paidAmount: newPaid,
          userId: payer?.id ?? member.userId,
          status: newPaid >= member.shareAmount ? 'paid' : member.status === 'pending' ? 'opened' : member.status,
          paidAt: newPaid >= member.shareAmount ? new Date() : member.paidAt,
        },
      })
      if (payer) {
        await this.history.record(tx, payer.id, 'payment', {
          refId: split.id,
          amountSigned: -charged,
          meta: { title: split.title, subtitle: 'Ваша доля в сплите', splitId: split.id },
        })
      }
      return { split, member, charged }
    })

    if (result.charged > 0) {
      const paidTotal = await this.effectivePaid(result.split.id)
      this.realtime.emitSplit(result.split.code, 'member_paid', {
        memberId: result.member.id,
        name: result.member.displayName,
        amount: result.charged,
        paidTotal,
      })
      this.realtime.emitUser(result.split.creatorId, 'member_paid', {
        splitId: result.split.id,
        name: result.member.displayName,
        amount: result.charged,
      })
      // организатор мог закрыть приложение — пуш догонит
      await this.push.send(
        result.split.creatorId,
        (loc) =>
          pushText('memberPaid', loc, {
            name: result.member.displayName,
            title: result.split.title,
            amount: fmtSum(result.charged),
          }),
        { type: 'split', splitId: result.split.id, code: result.split.code },
      )
      await this.maybeClose(result.split.id)
    }
    return this.publicByCode(code, phone)
  }

  private async effectivePaid(splitId: string): Promise<number> {
    const members = await this.prisma.splitMember.findMany({ where: { splitId } })
    return members.reduce((s, m) => s + (m.status === 'debt' || m.status === 'covered' ? m.shareAmount : m.paidAmount), 0)
  }

  // ---------- cover / remind / cancel ----------

  async cover(splitId: string, creatorId: string, memberIds?: string[]) {
    const covered = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Split" WHERE id = ${splitId} FOR UPDATE`
      const split = await tx.split.findUniqueOrThrow({ where: { id: splitId }, include: { members: true, merchant: true } })
      if (split.creatorId !== creatorId) throw new ForbiddenException()
      if (split.status !== 'active') throw new BadRequestException('Сплит уже закрыт')

      const targets = split.members.filter(
        (m) =>
          !m.isCreator &&
          (m.status === 'pending' || m.status === 'opened') &&
          (!memberIds?.length || memberIds.includes(m.id)),
      )
      let sum = 0
      for (const m of targets) {
        const rest = m.shareAmount - m.paidAmount
        if (rest <= 0) continue
        sum += rest
        await tx.splitMember.update({
          where: { id: m.id },
          data: { status: 'covered', coveredById: creatorId, paidAt: new Date() },
        })
        const debtorUser = await tx.user.findUnique({ where: { phone: m.phone } })
        const debt = await tx.debt.create({
          data: {
            creditorId: creatorId,
            debtorUserId: debtorUser?.id,
            debtorPhone: m.phone,
            debtorName: m.displayName,
            splitId,
            amount: rest,
            reason: `${split.merchant?.name ?? split.title} · вы покрыли его долю`,
          },
        })
        await this.history.record(tx, creatorId, 'debt', {
          refId: debt.id,
          amountSigned: rest,
          meta: { title: `${m.displayName} · в долг`, subtitle: split.merchant?.name ?? split.title, splitId, phone: m.phone },
        })
        this.realtime.emitSplit(split.code, 'member_covered', { memberId: m.id, name: m.displayName })
      }
      if (sum > 0) {
        await this.payments.charge(creatorId, sum, `split:${splitId}:cover`)
        await this.history.record(tx, creatorId, 'payment', {
          refId: splitId,
          amountSigned: -sum,
          meta: { title: split.merchant?.name ?? split.title, subtitle: 'Покрыли остаток сплита', splitId, letter: split.merchant?.letter, color: split.merchant?.color },
        })
      }
      return sum
    })
    if (covered > 0) await this.maybeClose(splitId)
    return this.byIdOrThrow(splitId, creatorId)
  }

  async remindMember(splitId: string, creatorId: string, memberId: string) {
    const split = await this.byIdOrThrow(splitId, creatorId)
    const member = split.members.find((m) => m.id === memberId)
    if (!member || member.isCreator) throw new NotFoundException('Участник не найден')
    if (member.lastRemindedAt && Date.now() - member.lastRemindedAt.getTime() < REMIND_INTERVAL_MS)
      throw new BadRequestException('Напоминание уже отправлено — подождите 30 минут')
    const origin = process.env.PWA_ORIGIN ?? 'http://localhost:5173'
    const creator = await this.prisma.user.findUnique({ where: { id: creatorId }, select: { locale: true } })
    const lang = await this.sms.localeFor(member.phone, creator?.locale)
    await this.sms.send(
      member.phone,
      smsText('splitReminder', lang, { title: split.title, url: `${origin}/s/${split.code}` }),
      'reminder',
    )
    // Пуш поверх SMS: у кого стоит приложение — увидит сразу и бесплатно.
    // Фраза чередуется по числу уже отправленных напоминаний, чтобы одно и то
    // же уведомление не приедалось (vision §B4).
    if (member.userId) {
      const nth = member.lastRemindedAt ? 1 : 0
      await this.push.send(
        member.userId,
        (loc) =>
          pushText('remind', loc, {
            name: member.displayName,
            title: split.title,
            amount: fmtSum(member.shareAmount),
          }, nth),
        { type: 'split', splitId: split.id, code: split.code },
      )
    }

    await this.prisma.splitMember.update({ where: { id: memberId }, data: { lastRemindedAt: new Date() } })
    return { ok: true }
  }

  /** «Отправить SMS со ссылкой»: линк всем неоплатившим, троттлинг 30 мин на участника (lastRemindedAt). */
  async sendLink(splitId: string, creatorId: string) {
    const split = await this.byIdOrThrow(splitId, creatorId)
    if (split.creatorId !== creatorId) throw new ForbiddenException()
    const creator = await this.prisma.user.findUniqueOrThrow({ where: { id: creatorId } })
    const origin = process.env.PWA_ORIGIN ?? 'http://localhost:5173'
    const waiting = split.members.filter(
      (m) => !m.isCreator && (m.status === 'pending' || m.status === 'opened'),
    )
    if (!waiting.length) throw new BadRequestException('Все доли уже внесены')
    const eligible = waiting.filter(
      (m) => !m.lastRemindedAt || Date.now() - m.lastRemindedAt.getTime() >= REMIND_INTERVAL_MS,
    )
    if (!eligible.length) throw new BadRequestException('SMS уже отправлены — подождите 30 минут')
    let sent = 0
    for (const m of eligible) {
      try {
        const lang = await this.sms.localeFor(m.phone, creator.locale)
        await this.sms.send(
          m.phone,
          smsText('splitLink', lang, {
            name: creator.name || FRIEND_FALLBACK[lang],
            title: split.title,
            url: `${origin}/s/${split.code}`,
          }),
          'split_link',
        )
        await this.prisma.splitMember.update({ where: { id: m.id }, data: { lastRemindedAt: new Date() } })
        sent++
      } catch (e) {
        this.log.warn(`send-link sms failed → member ${m.id}: ${String(e)}`)
      }
    }
    if (!sent) throw new ServiceUnavailableException('SMS временно недоступны')
    return { sent }
  }

  /**
   * Своё название вечера вместо мерчанта: «🍕 Boys Dinner», «Bad decisions #4 😂»
   * (vision §14). Переименовать может любой участник — это общий счёт компании.
   * Эмодзи разрешены, поэтому режем по длине, а не по алфавиту.
   */
  async rename(splitId: string, userId: string, title: string) {
    const clean = title.trim().slice(0, 80)
    if (!clean) throw new BadRequestException('Название не может быть пустым')

    const split = await this.byIdOrThrow(splitId, userId)
    await this.prisma.split.update({ where: { id: split.id }, data: { title: clean } })
    return { title: clean }
  }

  async cancel(splitId: string, creatorId: string) {
    const split = await this.byIdOrThrow(splitId, creatorId)
    if (split.creatorId !== creatorId) throw new ForbiddenException()
    const anyonePaid = split.members.some((m) => !m.isCreator && (m.paidAmount > 0 || m.status === 'debt' || m.status === 'covered'))
    if (split.status !== 'active' || anyonePaid) throw new BadRequestException('Отменить можно, пока никто не оплатил')
    await this.prisma.split.update({ where: { id: splitId }, data: { status: 'cancelled', closedAt: new Date() } })
    return { ok: true }
  }

  // ---------- автозакрытие + кэшбэк ----------

  async maybeClose(splitId: string) {
    const closedInfo = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Split" WHERE id = ${splitId} FOR UPDATE`
      const split = await tx.split.findUniqueOrThrow({ where: { id: splitId }, include: { members: true, merchant: true } })
      if (split.status !== 'active') return null
      const effectivePaid = split.members.reduce(
        (s, m) => s + (m.status === 'debt' || m.status === 'covered' ? m.shareAmount : m.paidAmount),
        0,
      )
      if (effectivePaid < split.totalAmount) return null

      // начисление ТОЛЬКО при закрытии, только на сервере
      const merchant = split.merchant
      const payingMembers = split.members.filter((m) => m.status === 'paid' || m.status === 'debt' || m.status === 'covered')
      const groupSplit = split.members.length >= 2
      const rate = merchant ? merchant.cashbackRate : 0 // промилле·10 (25 → 2.5%)
      const x2 = Boolean(merchant?.cashbackX2 && groupSplit && payingMembers.filter((m) => m.status === 'paid').length >= 2)
      let totalCashback = 0

      if (merchant && rate > 0 && groupSplit) {
        for (const m of split.members) {
          const base = Math.floor((m.shareAmount * rate) / 1000)
          const amount = round1000(base * (x2 ? 2 : 1))
          if (amount <= 0) continue
          const held = m.status === 'covered' || m.status === 'debt'
          const debt = held
            ? await tx.debt.findFirst({ where: { splitId, debtorPhone: m.phone, status: 'open' } })
            : null
          const userId = m.userId ?? (await tx.user.findUnique({ where: { phone: m.phone } }))?.id
          if (!userId) continue // без аккаунта — начислять некому
          totalCashback += amount
          await tx.cashbackEntry.create({
            data: {
              userId,
              splitId,
              merchantId: merchant.id,
              amount,
              multiplier: x2 ? 2 : 1,
              status: held ? 'held_debt' : 'available',
              releasedByDebtId: debt?.id,
              title: merchant.name,
              badge: x2 ? '×2' : `${rate / 10}%`,
              groupId: split.groupId,
            },
          })
          await this.history.record(tx, userId, 'cashback', {
            refId: splitId,
            amountSigned: amount,
            meta: {
              title: 'Групповой кэшбэк',
              subtitle: `${merchant.name}${x2 ? ' ×2' : ''}`,
              splitId,
              held,
              letter: merchant.letter,
              color: merchant.color,
            },
          })
        }
      }
      // соло-сплит: группового кэшбэка НЕТ (базовая ставка только если она есть у мерчанта)
      if (merchant && rate > 0 && !groupSplit) {
        const creatorMember = split.members[0]!
        const amount = round1000(Math.floor((creatorMember.shareAmount * rate) / 1000))
        if (amount > 0 && creatorMember.userId) {
          totalCashback += amount
          await tx.cashbackEntry.create({
            data: {
              userId: creatorMember.userId,
              splitId,
              merchantId: merchant.id,
              amount,
              status: 'available',
              title: merchant.name,
              badge: `${rate / 10}%`,
            },
          })
        }
      }

      const creatorCashback = x2 || (merchant && rate > 0)
      void creatorCashback
      const updated = await tx.split.update({
        where: { id: splitId },
        data: { status: 'closed', closedAt: new Date(), cashback: totalCashback || null, cashbackX2: x2 },
      })
      // пул группы
      if (split.groupId && totalCashback > 0) {
        await tx.group.updateMany({
          where: { id: split.groupId, cashbackPoolEnabled: true },
          data: { cashbackPool: { increment: totalCashback } },
        })
      }
      return { id: split.id, title: split.title, code: updated.code, creatorId: split.creatorId, cashback: totalCashback, x2 }
    })

    if (closedInfo) {
      this.realtime.emitSplit(closedInfo.code, 'split_closed', { cashback: closedInfo.cashback, x2: closedInfo.x2 })
      this.realtime.emitUser(closedInfo.creatorId, 'split_closed', { code: closedInfo.code, cashback: closedInfo.cashback })

      // «все оплатили» — событие компании, поэтому пуш всем, у кого есть аккаунт
      const closedMembers = await this.prisma.splitMember.findMany({
        where: { splitId: closedInfo.id, userId: { not: null } },
        select: { userId: true },
      })
      for (const m of closedMembers) {
        if (!m.userId) continue
        await this.push.send(
          m.userId,
          (loc) => pushText('splitClosed', loc, { title: closedInfo.title }),
          { type: 'split', splitId: closedInfo.id, code: closedInfo.code },
        )
      }
    }
  }
}
