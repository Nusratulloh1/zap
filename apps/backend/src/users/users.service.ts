// Профиль, контакты, карты, настройки + GET /bootstrap — проекция всех данных
// пользователя в форму, 1:1 совместимую с интерфейсом мок-слоя фронтенда.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Bill, BillItem, CardBrand, Contact, Merchant, Split, SplitMember, User } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { normalizePhone } from '../common/utils'
import { photoUrlOf } from '../common/uploads'
import { entryKey } from '../common/entry-i18n'

const AVATAR_COLORS = ['#3E6E4E', '#3E4A6E', '#B75A3A', '#6E3E5E', '#4A6E3E', '#8A5A2A']
const colorFor = (s: string) => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]!

type FullSplit = Split & {
  members: SplitMember[]
  merchant: Merchant | null
  bill: ({ items: BillItem[] } & Bill) | null
  reactions?: { memberId: string; emoji: string; fromUserId: string; fromUser: { name: string | null } }[]
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return this.mapUser(u, await this.closedSplitsCount(userId))
  }

  private closedSplitsCount(userId: string) {
    return this.prisma.split.count({ where: { creatorId: userId, status: 'closed' } })
  }

  private mapUser(u: User, splitsCount: number) {
    const d = u.createdAt
    return {
      id: 'me',
      name: u.name, // пустое имя триггерит онбординг-шит «Как вас зовут?»
      handle: u.handle ? `@${u.handle.replace(/^@/, '')}` : '',
      phone: u.phone.slice(3),
      initials: (u.name || '?')[0]!,
      color: '#111110',
      // ISO: месяц называет клиент на своём языке (см. lib/datetime.ts)
      memberSince: d.toISOString(),
      splitsCount,
      locale: u.locale,
    }
  }

  // ---------- username (@handle) ----------

  /** @Shoshiy / @shoshiy / shoshiy → shoshiy (латиница/цифры/_, 3–20). */
  private normalizeHandle(h: string): string {
    return h.trim().replace(/^@+/, '').toLowerCase()
  }
  private validHandle(h: string): boolean {
    return /^[a-z0-9_]{3,20}$/.test(h)
  }

  async updateProfile(userId: string, data: { name?: string; handle?: string; locale?: string }) {
    const patch: { name?: string; handle?: string; locale?: string } = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.locale !== undefined) patch.locale = data.locale
    if (data.handle !== undefined && data.handle !== '') {
      const h = this.normalizeHandle(data.handle)
      if (!this.validHandle(h))
        throw new BadRequestException('Юзернейм: 3–20 символов, латиница, цифры или _')
      const taken = await this.prisma.user.findFirst({ where: { handle: h, NOT: { id: userId } } })
      if (taken) throw new ConflictException('Этот юзернейм уже занят')
      patch.handle = h
    }
    await this.prisma.user.update({ where: { id: userId }, data: patch })
    return this.me(userId)
  }

  /** Свободен ли юзернейм (для живой проверки в шите профиля). */
  async checkHandle(userId: string, raw: string) {
    const handle = this.normalizeHandle(raw ?? '')
    if (!this.validHandle(handle)) return { handle, valid: false, available: false }
    const taken = await this.prisma.user.findFirst({ where: { handle, NOT: { id: userId } } })
    return { handle, valid: true, available: !taken }
  }

  /** Поиск пользователей по @username или имени — для добавления в сплит. */
  async searchUsers(selfId: string, query: string) {
    const q = query.trim().replace(/^@+/, '').toLowerCase()
    if (q.length < 2) return []
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: selfId },
        handle: { not: null },
        OR: [{ handle: { contains: q } }, { name: { contains: q, mode: 'insensitive' } }],
      },
      take: 8,
      orderBy: { handle: 'asc' },
    })
    return users.map((u) => ({
      id: u.id,
      name: u.name || `@${u.handle}`,
      handle: u.handle ? `@${u.handle}` : '',
      phone: u.phone, // нужен для добавления в сплит (телефонная модель участников)
      initials: (u.name || u.handle || '?')[0]!.toUpperCase(),
      color: colorFor(u.phone),
    }))
  }

  // ---------- контакты ----------

  async addContact(ownerId: string, phoneRaw: string, name?: string) {
    const phone = normalizePhone(phoneRaw)
    const linked = await this.prisma.user.findUnique({ where: { phone } })
    const pretty = '+998 ' + [phone.slice(3, 5), phone.slice(5, 8), phone.slice(8, 10), phone.slice(10, 12)].join(' ')
    const contact = await this.prisma.contact.upsert({
      where: { ownerId_phone: { ownerId, phone } },
      create: { ownerId, phone, name: name || linked?.name || pretty, linkedUserId: linked?.id },
      update: { name: name || undefined },
    })
    return this.mapContact(contact)
  }

  private mapContact(c: Contact) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone.slice(3),
      handle: undefined as string | undefined,
      initials: (c.name || '+')[0]!,
      color: colorFor(c.phone),
    }
  }

  // ---------- карты ----------

  async addCard(userId: string, brand: CardBrand, last4: string) {
    const count = await this.prisma.card.count({ where: { userId } })
    const card = await this.prisma.card.create({
      data: { userId, brand, last4, isPrimary: count === 0 },
    })
    return { id: card.id, network: card.brand, last4: card.last4, primary: card.isPrimary }
  }

  async setPrimaryCard(userId: string, cardId: string) {
    const exists = await this.prisma.card.findFirst({ where: { id: cardId, userId } })
    if (!exists) throw new NotFoundException('Карта не найдена')
    await this.prisma.$transaction([
      this.prisma.card.updateMany({ where: { userId }, data: { isPrimary: false } }),
      this.prisma.card.update({ where: { id: cardId }, data: { isPrimary: true } }),
    ])
    return { ok: true }
  }

  async updateSettings(userId: string, patch: { debtNotifications?: boolean; promoDismissed?: boolean }) {
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: patch,
    })
    return { ok: true }
  }

  // ---------- bootstrap: проекция в мок-совместимую форму ----------

  async bootstrap(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const [contacts, cards, merchants, groups, splits, debtsOut, debtsIn, cashback, history, settings, splitsCount] =
      await Promise.all([
        this.prisma.contact.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.card.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.merchant.findMany(),
        this.prisma.group.findMany({
          // компанию видит не только создатель: иначе добавленный участник о
          // ней не знает, хотя его туда позвали
          where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
          include: { members: true, splits: { select: { merchantId: true } } },
        }),
        this.prisma.split.findMany({
          where: { OR: [{ creatorId: userId }, { members: { some: { userId } } }], status: { not: 'cancelled' } },
          include: {
            members: { orderBy: { isCreator: 'desc' } },
            merchant: true,
            bill: { include: { items: true } },
            reactions: { include: { fromUser: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.debt.findMany({ where: { creditorId: userId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.debt.findMany({
          where: { OR: [{ debtorUserId: userId }, { debtorPhone: me.phone }] },
          include: { creditor: { select: { name: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.cashbackEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
        this.prisma.historyEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
        this.prisma.userSettings.findUnique({ where: { userId } }),
        this.closedSplitsCount(userId),
      ])

    const contactByPhone = new Map(contacts.map((c) => [c.phone, c]))
    const contactId = (phone: string) => (phone === me.phone ? 'me' : contactByPhone.get(phone)?.id ?? phone)

    const featured = await this.prisma.bill.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { items: true, merchant: true },
    })

    return {
      user: this.mapUser(me, splitsCount),
      cards: cards.map((c) => ({ id: c.id, network: c.brand, last4: c.last4, primary: c.isPrimary })),
      contacts: contacts.map((c) => this.mapContact(c)),
      merchants: merchants.map((m) => ({
        id: m.id,
        name: m.name,
        letter: m.letter,
        color: m.color,
        offer: m.cashbackX2
          ? { label: '×2 группе', terms: 'при сплите вдвоём и больше', multiplier: 2 }
          : m.cashbackRate > 0
            ? { label: `${m.cashbackRate / 10}%`, terms: 'кэшбэк', percent: m.cashbackRate / 10 }
            : undefined,
      })),
      featuredBill: featured ? this.mapBill(featured) : null,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        // владелец отдаётся как contactId: чужая компания не должна выглядеть
        // так, будто её создал я (кнопки удаления и переименования — у владельца)
        ownerId: g.ownerId === userId ? 'me' : contactId(g.members.find((m) => m.userId === g.ownerId)?.phone ?? ''),
        memberIds: g.members.map((m) => contactId(m.phone)),
        createdAt: g.createdAt.getTime(),
        cashback: g.cashbackPool,
        accrueCashback: g.cashbackPoolEnabled,
        merchantsCount: new Set(g.splits.map((s) => s.merchantId).filter(Boolean)).size || 1,
      })),
      splits: splits.map((s) => this.mapSplit(s, contactId)),
      debts: [
        ...debtsOut.map((d) => ({
          id: d.id,
          contactId: contactId(d.debtorPhone),
          amount: d.amount,
          reason: d.reason,
          createdAt: d.createdAt.getTime(),
          status: d.status === 'settled' ? 'paid' : 'open',
          splitId: d.splitId ?? undefined,
          direction: 'owedToMe',
          lastRemindedAt: d.lastRemindedAt?.getTime(),
        })),
        ...debtsIn.map((d) => ({
          id: d.id,
          contactId: contactId(d.creditor.phone),
          amount: d.amount,
          reason: d.reason,
          note: d.creditor.name,
          createdAt: d.createdAt.getTime(),
          status: d.status === 'settled' ? 'paid' : 'open',
          splitId: d.splitId ?? undefined,
          direction: 'iOwe',
          lastRemindedAt: d.lastRemindedAt?.getTime(),
        })),
      ],
      cashbackEntries: cashback.map((e) => ({
        id: e.id,
        title: e.title,
        titleKey: entryKey(e.title),
        badge: e.badge,
        amount: e.amount,
        createdAt: e.createdAt.getTime(),
        groupId: e.groupId ?? undefined,
        held: e.status === 'held_debt' ? true : undefined,
      })),
      history: history.map((h) => {
        const meta = (h.meta ?? {}) as Record<string, unknown>
        const phone = typeof meta.phone === 'string' ? meta.phone : undefined
        return {
          id: h.id,
          kind: h.type,
          title: String(meta.title ?? ''),
          subtitle: String(meta.subtitle ?? ''),
          // Ключи перевода для строк, которые раньше писались в meta по-русски
          // и в таком виде уезжали на экран независимо от языка интерфейса.
          // Литералы оставлены: у записей, созданных до этой правки, ключей
          // нет, и клиент откатывается на них.
          titleKey:
            typeof meta.titleKey === 'string' ? meta.titleKey : entryKey(String(meta.title ?? '')),
          subtitleKey:
            typeof meta.subtitleKey === 'string'
              ? meta.subtitleKey
              : entryKey(String(meta.subtitle ?? '')),
          amount: h.amountSigned,
          createdAt: h.createdAt.getTime(),
          splitId: typeof meta.splitId === 'string' ? meta.splitId : undefined,
          contactId: phone ? contactId(phone) : undefined,
          note: typeof meta.note === 'string' ? meta.note : undefined,
          letter: String(meta.letter ?? meta.title ?? '?')[0]!.toUpperCase(),
          color: String(meta.color ?? '#111110'),
        }
      }),
      settings: {
        debtNotifications: settings?.debtNotifications ?? true,
        promoDismissed: settings?.promoDismissed ?? false,
        visits: settings?.visits ?? 0,
        pendingCashback: settings?.pendingCashback ?? 0,
      },
    }
  }

  private mapBill(b: Bill & { items: BillItem[] }) {
    return {
      billId: b.id,
      merchantId: b.merchantId,
      orderNo: b.externalRef,
      table: b.tableRef ?? undefined,
      time: b.createdAt.toISOString().slice(11, 16),
      items: b.items.map((i) => ({ id: i.id, title: i.title, qty: i.qty, amount: i.amount })),
      total: b.totalAmount,
    }
  }

  mapSplit(s: FullSplit, contactId: (phone: string) => string) {
    const statusMap: Record<string, string> = { pending: 'waiting', opened: 'opened', paid: 'paid', covered: 'debt', debt: 'debt' }
    return {
      id: s.id,
      code: s.code,
      title: s.title,
      merchantId: s.merchantId ?? undefined,
      bill: s.bill ? this.mapBill(s.bill) : undefined,
      total: s.totalAmount,
      mode: s.mode,
      members: s.members.map((m) => ({
        contactId: contactId(m.phone),
        memberId: m.id,
        amount: m.shareAmount,
        status: statusMap[m.status] ?? 'waiting',
        isYou: m.isCreator || undefined,
        paidAt: m.paidAt?.getTime(),
      })),
      status: s.status === 'cancelled' ? 'closed' : s.status,
      createdAt: s.createdAt.getTime(),
      closedAt: s.closedAt?.getTime(),
      groupId: s.groupId ?? undefined,
      cashback: s.cashback ?? undefined,
      cashbackX2: s.cashbackX2 || undefined,
      photoUrl: photoUrlOf(s.photoPath),
      reactions: (s.reactions ?? []).map((r) => ({
        memberId: r.memberId,
        emoji: r.emoji,
        fromUserId: r.fromUserId,
        fromName: (r.fromUser?.name || '').split(' ')[0],
      })),
    }
  }
}
