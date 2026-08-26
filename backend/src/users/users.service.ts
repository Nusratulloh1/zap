// Профиль, контакты, карты, настройки + GET /bootstrap — проекция всех данных
// пользователя в форму, 1:1 совместимую с интерфейсом мок-слоя фронтенда.
import { Injectable, NotFoundException } from '@nestjs/common'
import type { Bill, BillItem, CardBrand, Contact, Merchant, Split, SplitMember, User } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { normalizePhone } from '../common/utils'

const AVATAR_COLORS = ['#3E6E4E', '#3E4A6E', '#B75A3A', '#6E3E5E', '#4A6E3E', '#8A5A2A']
const colorFor = (s: string) => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]!
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

type FullSplit = Split & {
  members: SplitMember[]
  merchant: Merchant | null
  bill: ({ items: BillItem[] } & Bill) | null
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
      name: u.name || 'Вы',
      handle: u.handle ? `@${u.handle.replace(/^@/, '')}` : '',
      phone: u.phone.slice(3),
      initials: (u.name || 'В')[0]!,
      color: '#111110',
      memberSince: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      splitsCount,
    }
  }

  async updateProfile(userId: string, data: { name?: string; handle?: string }) {
    await this.prisma.user.update({ where: { id: userId }, data })
    return this.me(userId)
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
        this.prisma.group.findMany({ where: { ownerId: userId }, include: { members: true, splits: { select: { merchantId: true } } } }),
        this.prisma.split.findMany({
          where: { OR: [{ creatorId: userId }, { members: { some: { userId } } }], status: { not: 'cancelled' } },
          include: { members: { orderBy: { isCreator: 'desc' } }, merchant: true, bill: { include: { items: true } } },
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
        ownerId: 'me',
        memberIds: g.members.map((m) => contactId(m.phone)),
        createdAt: g.createdAt.getTime(),
        sinceLabel: `${g.createdAt.getDate()}.${String(g.createdAt.getMonth() + 1).padStart(2, '0')}`,
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
    }
  }
}
