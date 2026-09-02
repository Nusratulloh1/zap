import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveFromSplit(ownerId: string, splitId: string, name: string, memberIds?: string[], accrue = true) {
    const split = await this.prisma.split.findUnique({ where: { id: splitId }, include: { members: true } })
    if (!split || split.creatorId !== ownerId) throw new NotFoundException('Сплит не найден')

    /*
      Приложение присылает contactId участников ('me', 'c_…'), а не id строк
      SplitMember. Раньше фильтр сверял только m.id — совпадений не было, и в
      группу попадал один создатель: любая компания сохранялась как «1 человек».
      Сопоставляем и по id строки, и по contactId (через телефон контакта).
    */
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { phone: true } })
    const contacts = await this.prisma.contact.findMany({ where: { ownerId }, select: { id: true, phone: true } })
    const contactIdByPhone = new Map(contacts.map((c) => [c.phone, c.id]))
    const contactIdOf = (phone: string) =>
      phone === owner?.phone ? 'me' : (contactIdByPhone.get(phone) ?? phone)

    const wanted = new Set(memberIds ?? [])
    const members = split.members.filter(
      (m) => !wanted.size || wanted.has(m.id) || wanted.has(contactIdOf(m.phone)) || m.isCreator,
    )
    const phones = members.map((m) => m.phone).sort()

    // тот же состав → обновляем существующую группу, не плодим дубли
    const candidates = await this.prisma.group.findMany({ where: { ownerId }, include: { members: true } })
    const existing =
      (split.groupId && candidates.find((g) => g.id === split.groupId)) ||
      candidates.find((g) => g.members.map((m) => m.phone).sort().join(',') === phones.join(','))

    const group = existing
      ? await this.prisma.group.update({
          where: { id: existing.id },
          data: { name, cashbackPoolEnabled: accrue },
          include: { members: true },
        })
      : await this.prisma.group.create({
          data: {
            name,
            ownerId,
            cashbackPoolEnabled: accrue,
            cashbackPool: split.cashback ?? 0,
            members: {
              create: members.map((m) => ({
                userId: m.userId,
                phone: m.phone,
                name: m.displayName,
                role: m.isCreator ? 'owner' : 'member',
              })),
            },
          },
          include: { members: true },
        })

    await this.prisma.split.update({ where: { id: splitId }, data: { groupId: group.id } })
    return group
  }

  async list(ownerId: string) {
    return this.prisma.group.findMany({
      where: { ownerId },
      include: { members: true, splits: { select: { id: true, merchantId: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async rename(ownerId: string, groupId: string, name: string) {
    const res = await this.prisma.group.updateMany({ where: { id: groupId, ownerId }, data: { name } })
    if (!res.count) throw new ForbiddenException()
    return { ok: true }
  }

  async remove(ownerId: string, groupId: string) {
    await this.prisma.split.updateMany({ where: { groupId, creatorId: ownerId }, data: { groupId: null } })
    const res = await this.prisma.group.deleteMany({ where: { id: groupId, ownerId } })
    if (!res.count) throw new ForbiddenException()
    return { ok: true }
  }
}
