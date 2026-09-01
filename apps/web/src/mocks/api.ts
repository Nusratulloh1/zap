// Мок-бэкенд. Реальный API подключается заменой этого модуля с сохранением интерфейса.
import type {
  Bill,
  Card,
  Db,
  Group,
  Session,
  Split,
  SplitMember,
  SplitMode,
} from '@zap/shared/types'
import { getDb, getSession, persistDb, persistSession, resetAll } from './db'
import type { Contact } from '@zap/shared/types'
import { bus } from '@/lib/bus'
import { money } from '@/lib/format'

export function fakeLatency(min = 250, max = 700): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)))
}

// JSON-клон: данные — plain JSON, а входные объекты могут быть реактивными Proxy,
// которые structuredClone не переваривает.
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function touch(...domains: string[]) {
  persistDb()
  bus.emit('db:changed', { domains })
}

function round1000(v: number): number {
  return Math.round(v / 1000) * 1000
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}

/** Synchronous read-only snapshot for stores refreshing after bus events. */
export function snapshot(): Db {
  return clone(getDb())
}

// ---------- session ----------

export async function fetchSession(): Promise<Session> {
  return clone(getSession())
}

export async function startLogin(phone: string): Promise<void> {
  await fakeLatency()
  const s = getSession()
  s.stage = 'code'
  s.phone = phone
  persistSession()
}

export async function verifyCode(_code: string): Promise<void> {
  await fakeLatency(300, 600)
  const s = getSession()
  s.stage = 'pin'
  persistSession()
}

export async function setPin(pin: string): Promise<void> {
  await fakeLatency(200, 400)
  const s = getSession()
  s.pin = pin
  s.stage = 'authed'
  persistSession()
  const db = getDb()
  if (s.phone) db.user.phone = s.phone
  db.settings.visits += 1
  touch('user')
}

export async function verifyPin(pin: string): Promise<boolean> {
  await fakeLatency(150, 350)
  const s = getSession()
  return !s.pin || s.pin === pin
}

export async function logout(): Promise<void> {
  await fakeLatency(200, 400)
  resetAll()
  bus.emit('db:changed', { domains: ['all'] })
}

// ---------- bootstrap ----------

export async function fetchBootstrap(): Promise<Db> {
  await fakeLatency()
  return snapshot()
}

export async function fetchFeaturedBill(): Promise<Bill> {
  await fakeLatency(300, 700)
  return clone(getDb().featuredBill)
}

// ---------- splits ----------

export interface CreateSplitInput {
  title: string
  total: number
  mode: SplitMode
  merchantId?: string
  bill?: Bill
  members: { contactId: string; amount: number; debt?: boolean; itemIds?: string[] }[]
}

function contactName(db: Db, id: string): string {
  if (id === 'me') return db.user.name
  return db.contacts.find((c) => c.id === id)?.name ?? '?'
}

function merchantOf(db: Db, split: Split) {
  return db.merchants.find((m) => m.id === split.merchantId)
}

function makeCode(db: Db, input: CreateSplitInput): string {
  const initials = input.members
    .filter((m) => m.contactId !== 'me')
    .map((m) => contactName(db, m.contactId)[0] ?? 'X')
    .join('')
  const base = input.bill?.orderNo ?? Math.floor(100 + Math.random() * 900).toString()
  const tag = initials === 'АБ' || initials === 'БА' ? 'FRD' : `${initials}${db.splits.length}`
  return `${base}-${tag}`.toUpperCase()
}

export async function createSplit(rawInput: CreateSplitInput): Promise<Split> {
  await fakeLatency(400, 700)
  const input = clone(rawInput)
  const db = getDb()
  const now = Date.now()

  const members: SplitMember[] = input.members.map((m) => ({
    contactId: m.contactId,
    amount: m.amount,
    itemIds: m.itemIds,
    isYou: m.contactId === 'me',
    status: m.contactId === 'me' ? 'paid' : m.debt ? 'debt' : 'waiting',
    paidAt: m.contactId === 'me' || m.debt ? now : undefined,
  }))

  const split: Split = {
    id: uid('sp'),
    code: makeCode(db, input),
    title: input.title,
    merchantId: input.merchantId,
    bill: input.bill,
    total: input.total,
    mode: input.mode,
    members,
    status: 'active',
    createdAt: now,
  }
  db.splits.unshift(split)

  const merchant = merchantOf(db, split)
  const paidNow = members
    .filter((m) => m.isYou || m.status === 'debt')
    .reduce((s, m) => s + m.amount, 0)

  // применяем кэшбэк, зарезервированный «на следующий сплит»
  const myShare = members.find((m) => m.isYou)?.amount ?? 0
  const discount = Math.min(db.settings.pendingCashback ?? 0, myShare, paidNow)
  if (discount > 0) {
    db.settings.pendingCashback = 0
    db.cashbackEntries.unshift({
      id: uid('cb'),
      title: 'Потрачено на сплит',
      badge: merchant?.name ?? split.title,
      amount: -discount,
      createdAt: now,
    })
  }

  const debtNames = members.filter((m) => m.status === 'debt').map((m) => contactName(db, m.contactId))
  db.history.unshift({
    id: uid('h'),
    kind: 'split',
    title: `${merchant?.name ?? split.title} · сплит${split.bill ? ' #' + split.bill.orderNo : ''}`,
    subtitle: `вы + ${members.length - 1} человека`,
    note: discount > 0 ? `кэшбэк −${money(discount)}` : debtNames.length ? `за себя и ${debtNames.join(', ')}` : undefined,
    amount: -(paidNow - discount),
    createdAt: now,
    splitId: split.id,
    letter: merchant?.letter ?? split.title[0]?.toUpperCase() ?? 'S',
    color: merchant?.color ?? '#111110',
  })

  for (const m of members) {
    if (m.status !== 'debt') continue
    createDebtRecord(db, split, m)
  }

  touch('splits', 'debts', 'history')
  maybeCloseSplit(db, split)
  return clone(split)
}

function createDebtRecord(db: Db, split: Split, m: SplitMember) {
  const merchant = merchantOf(db, split)
  const name = contactName(db, m.contactId)
  const contact = db.contacts.find((c) => c.id === m.contactId)
  db.debts.unshift({
    id: uid('d'),
    contactId: m.contactId,
    amount: m.amount,
    reason: `${merchant?.name ?? split.title} · вы покрыли его долю`,
    createdAt: Date.now(),
    status: 'open',
    splitId: split.id,
    direction: 'owedToMe',
  })
  db.history.unshift({
    id: uid('h'),
    kind: 'debt',
    title: `${name} · в долг`,
    subtitle: merchant?.name ?? split.title,
    contactId: m.contactId,
    amount: m.amount,
    createdAt: Date.now(),
    splitId: split.id,
    letter: contact?.initials ?? name[0] ?? '?',
    color: contact?.color ?? '#8A887E',
  })
}

export async function fetchSplit(id: string): Promise<Split | null> {
  await fakeLatency(250, 500)
  const split = getDb().splits.find((s) => s.id === id)
  return split ? clone(split) : null
}

export async function fetchSplitByCode(code: string): Promise<Split | null> {
  await fakeLatency(250, 500)
  const split = getDb().splits.find((s) => s.code.toLowerCase() === code.toLowerCase())
  return split ? clone(split) : null
}

export function markOpened(splitId: string, contactId: string) {
  const db = getDb()
  const split = db.splits.find((s) => s.id === splitId)
  const member = split?.members.find((m) => m.contactId === contactId)
  if (!split || !member || split.status !== 'active' || member.status !== 'waiting') return
  member.status = 'opened'
  touch('splits')
  bus.emit('split:event', {
    split: clone(split),
    kind: 'opened',
    message: `${contactName(db, contactId)} открыл ссылку`,
  })
}

export async function payShare(splitId: string, contactId: string): Promise<Split | null> {
  await fakeLatency(300, 600)
  return payShareSync(splitId, contactId)
}

// в мок-режиме гость всегда «как будто с PIN» — inline-шит не показываем
export function guestNeedsPin(): boolean {
  return false
}

export function payShareSync(splitId: string, contactId: string): Split | null {
  const db = getDb()
  const split = db.splits.find((s) => s.id === splitId)
  const member = split?.members.find((m) => m.contactId === contactId)
  if (!split || !member || split.status !== 'active') return null
  if (member.status === 'paid' || member.status === 'debt') return clone(split)
  member.status = 'paid'
  member.paidAt = Date.now()
  touch('splits')
  bus.emit('split:event', {
    split: clone(split),
    kind: 'paid',
    message: `${contactName(db, contactId)} оплатил ${money(member.amount)}`,
  })
  maybeCloseSplit(db, split)
  return clone(split)
}

export async function coverRemainder(splitId: string): Promise<Split | null> {
  await fakeLatency(350, 650)
  const db = getDb()
  const split = db.splits.find((s) => s.id === splitId)
  if (!split || split.status !== 'active') return null
  const now = Date.now()
  let covered = 0
  for (const m of split.members) {
    if (m.status === 'paid' || m.status === 'debt' || m.isYou) continue
    m.status = 'debt'
    m.paidAt = now
    covered += m.amount
    createDebtRecord(db, split, m)
  }
  if (covered > 0) {
    const merchant = merchantOf(db, split)
    db.history.unshift({
      id: uid('h'),
      kind: 'payment',
      title: merchant?.name ?? split.title,
      subtitle: 'Покрыли остаток сплита',
      amount: -covered,
      createdAt: now,
      splitId: split.id,
      letter: merchant?.letter ?? 'S',
      color: merchant?.color ?? '#111110',
    })
  }
  touch('splits', 'debts', 'history')
  maybeCloseSplit(db, split)
  return clone(split)
}

function findGroupByMembers(db: Db, memberIds: string[]): Group | undefined {
  const key = [...memberIds].sort().join(',')
  return db.groups.find((g) => [...g.memberIds].sort().join(',') === key)
}

function maybeCloseSplit(db: Db, split: Split) {
  if (split.status !== 'active') return
  const allSettled = split.members.every((m) => m.status === 'paid' || m.status === 'debt')
  if (!allSettled) return

  split.status = 'closed'
  split.closedAt = Date.now()

  const merchant = merchantOf(db, split)
  const groupSplit = split.members.length >= 2

  // соло-сплит: группового кэшбэка не существует — закрываем без начислений
  if (!groupSplit) {
    db.user.splitsCount += 1
    touch('splits', 'user')
    bus.emit('split:event', { split: clone(split), kind: 'closed', message: 'Сплит закрыт' })
    return
  }

  const x2 = merchant?.offer?.multiplier === 2
  const rate = merchant?.offer?.percent ? merchant.offer.percent / 100 : 0.025
  const cashback = round1000(split.total * rate * (x2 ? 2 : 1))
  split.cashback = cashback
  split.cashbackX2 = x2

  const group = findGroupByMembers(db, split.members.map((m) => m.contactId))
  if (group) {
    split.groupId = group.id
    if (group.accrueCashback) group.cashback += cashback
  }

  db.user.splitsCount += 1

  db.cashbackEntries.unshift({
    id: uid('cb'),
    title: merchant?.name ?? split.title,
    badge: x2 ? `×2${group ? ` · ${group.name}` : ''}` : `${Math.round(rate * 100)}%`,
    amount: cashback,
    createdAt: Date.now(),
    groupId: group?.id,
  })
  db.history.unshift({
    id: uid('h'),
    kind: 'cashback',
    title: 'Групповой кэшбэк',
    subtitle: `${merchant?.name ?? split.title} ${x2 ? '×2' : ''}${group ? ' · ' + group.name : ''}`.trim(),
    amount: cashback,
    createdAt: Date.now(),
    splitId: split.id,
    letter: merchant?.letter ?? 'C',
    color: merchant?.color ?? '#111110',
  })

  touch('splits', 'groups', 'cashback', 'history', 'user')
  bus.emit('split:event', { split: clone(split), kind: 'closed', message: 'Сплит закрыт' })
  bus.emit('split:event', {
    split: clone(split),
    kind: 'cashback',
    message: `Кэшбэк зачислен +${money(cashback)}`,
  })
}

export async function remindSplitMember(_splitId: string, _contactId: string): Promise<void> {
  await fakeLatency(250, 450)
}

export async function sendSplitLinkSms(splitId: string): Promise<number> {
  await fakeLatency(300, 600)
  const split = getDb().splits.find((s) => s.id === splitId)
  return split?.members.filter((m) => m.status === 'waiting' || m.status === 'opened').length ?? 1
}

// ---------- groups ----------

export interface SaveGroupInput {
  splitId: string
  name: string
  memberIds: string[]
  accrueCashback: boolean
}

export async function saveGroup(input: SaveGroupInput): Promise<Group> {
  await fakeLatency(300, 600)
  const db = getDb()
  const split = db.splits.find((s) => s.id === input.splitId)
  let group =
    (split?.groupId && db.groups.find((g) => g.id === split.groupId)) ||
    findGroupByMembers(db, input.memberIds)

  if (group) {
    group.name = input.name
    group.memberIds = input.memberIds
    group.accrueCashback = input.accrueCashback
  } else {
    group = {
      id: uid('g'),
      name: input.name,
      ownerId: 'me',
      memberIds: input.memberIds,
      createdAt: Date.now(),
      cashback: split?.cashback ?? 0,
      accrueCashback: input.accrueCashback,
      merchantsCount: 1,
    }
    db.groups.push(group)
  }
  if (split) split.groupId = group.id
  touch('groups', 'splits')
  return clone(group)
}

// ---------- debts ----------

export async function remindDebt(debtId: string): Promise<void> {
  await fakeLatency(250, 450)
  const db = getDb()
  const debt = db.debts.find((d) => d.id === debtId)
  if (debt) {
    debt.lastRemindedAt = Date.now()
    touch('debts')
  }
}

export async function remindAllDebts(): Promise<void> {
  await fakeLatency(300, 550)
  const db = getDb()
  const now = Date.now()
  for (const d of db.debts) if (d.status === 'open') d.lastRemindedAt = now
  touch('debts')
}

/** Погашение долга: закрывает долг и создаёт запись в истории. */
export async function repayDebt(debtId: string): Promise<void> {
  await fakeLatency(300, 550)
  const db = getDb()
  const debt = db.debts.find((d) => d.id === debtId)
  if (!debt || debt.status === 'paid') return
  debt.status = 'paid'
  const contact = db.contacts.find((c) => c.id === debt.contactId)
  db.history.unshift({
    id: uid('h'),
    kind: 'debt',
    title: `${contact?.name ?? '?'} вернул долг`,
    subtitle: debt.reason,
    contactId: debt.contactId,
    amount: debt.amount,
    createdAt: Date.now(),
    splitId: debt.splitId,
    letter: contact?.initials ?? '?',
    color: contact?.color ?? '#8A887E',
  })
  touch('debts', 'history')
}

// ---------- contacts ----------

/** Имя пользователя (онбординг-шит после первого входа) */
export interface PartnerLead {
  company: string
  contact: string
  phone: string
  city?: string
  message?: string
}
export async function submitPartnerLead(_lead: PartnerLead): Promise<void> {
  await fakeLatency(400, 700)
}

export async function setLocale(locale: string): Promise<void> {
  await fakeLatency(120, 240)
  const db = getDb()
  db.user.locale = locale
  touch('user')
}

export async function updateProfile(name: string, handle?: string): Promise<void> {
  await fakeLatency(200, 400)
  const db = getDb()
  db.user.name = name.trim()
  db.user.initials = (name.trim()[0] ?? 'В').toUpperCase()
  if (handle) db.user.handle = '@' + handle.trim().replace(/^@+/, '').toLowerCase()
  touch('user')
}

export async function checkHandle(handle: string): Promise<{ valid: boolean; available: boolean; handle: string }> {
  await fakeLatency(120, 250)
  const h = handle.trim().replace(/^@+/, '').toLowerCase()
  return { valid: /^[a-z0-9_]{3,20}$/.test(h), available: h !== 'admin' && h !== 'zap', handle: h }
}

export interface UserSearchResult {
  id: string
  name: string
  handle: string
  phone: string
  initials: string
  color: string
}
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  await fakeLatency(150, 300)
  const q = query.trim().replace(/^@+/, '').toLowerCase()
  if (q.length < 2) return []
  const db = getDb()
  return db.contacts
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name, handle: '@' + c.name.toLowerCase().replace(/\s+/g, ''), phone: c.phone ?? '', initials: c.name[0]!.toUpperCase(), color: c.color }))
}

/** Добавление контакта по номеру («+ Номер» на экране участников) */
export async function addContact(phoneDigits: string, fullName?: string): Promise<Contact> {
  await fakeLatency(250, 450)
  const db = getDb()
  const d = phoneDigits.replace(/D/g, '').slice(0, 9)
  const pretty = '+998 ' + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
  const name = fullName?.trim() || pretty
  const contact: Contact = { id: uid('c'), name, phone: d, initials: (fullName?.trim()[0] ?? '+').toUpperCase(), color: '#8A887E' }
  db.contacts.push(contact)
  touch('contacts')
  return clone(contact)
}

// ---------- cards / settings ----------

export async function addCard(network: Card['network'], last4: string): Promise<Card> {
  await fakeLatency(350, 650)
  const db = getDb()
  const card: Card = { id: uid('card'), network, last4, primary: false }
  db.cards.push(card)
  touch('cards')
  return clone(card)
}

export async function setPrimaryCard(cardId: string): Promise<void> {
  await fakeLatency(200, 400)
  const db = getDb()
  for (const c of db.cards) c.primary = c.id === cardId
  touch('cards')
}

/** Смена PIN: проверяем старый, ставим новый */
export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  await fakeLatency(200, 400)
  const s = getSession()
  if (s.pin && s.pin !== oldPin) return false
  s.pin = newPin
  persistSession()
  return true
}

/** Резервирует доступный кэшбэк на следующий сплит */
export async function spendCashbackNext(): Promise<number> {
  await fakeLatency(200, 400)
  const db = getDb()
  const balance = db.cashbackEntries.filter((e) => !e.held).reduce((s, e) => s + e.amount, 0)
  db.settings.pendingCashback = Math.max(0, balance)
  touch('settings')
  return db.settings.pendingCashback
}

/** Вывод кэшбэка на карту: запись в кэшбэке (минус) и в истории */
export async function withdrawCashback(cardId: string, amount: number): Promise<void> {
  await fakeLatency(350, 650)
  const db = getDb()
  const card = db.cards.find((c) => c.id === cardId)
  db.cashbackEntries.unshift({
    id: uid('cb'),
    title: 'Вывод на карту',
    badge: card ? `·· ${card.last4}` : '··',
    amount: -amount,
    createdAt: Date.now(),
  })
  db.history.unshift({
    id: uid('h'),
    kind: 'cashback',
    title: 'Вывод кэшбэка',
    subtitle: card ? `${card.network} ·· ${card.last4}` : 'на карту',
    amount: -amount,
    createdAt: Date.now(),
    letter: '%',
    color: '#111110',
  })
  touch('cashback', 'history')
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  await fakeLatency(250, 450)
  const db = getDb()
  const g = db.groups.find((x) => x.id === groupId)
  if (g) g.name = name
  touch('groups')
}

export async function deleteGroup(groupId: string): Promise<void> {
  await fakeLatency(250, 450)
  const db = getDb()
  db.groups = db.groups.filter((x) => x.id !== groupId)
  for (const s of db.splits) if (s.groupId === groupId) delete s.groupId
  touch('groups', 'splits')
}

export async function toggleDebtNotifications(value: boolean): Promise<void> {
  await fakeLatency(150, 300)
  getDb().settings.debtNotifications = value
  touch('settings')
}

export function dismissPromo() {
  getDb().settings.promoDismissed = true
  touch('settings')
}

// ---------- QR ----------

export type ResolveQrResult =
  | { type: 'split'; code: string }
  | { type: 'bill'; bill: Bill }
  | { type: 'fiscal'; instant: { totalAmount?: number; datetime?: string }; jobId?: string }
  | { type: 'unknown' }

/** Мок: ZAP-ссылка → split, demo-payload → счёт, остальное — unknown. */
export async function resolveQr(payload: string): Promise<ResolveQrResult> {
  await fakeLatency(150, 300)
  const m = payload.match(/\/s\/([\w-]+)/i)
  if (m) return { type: 'split', code: m[1]! }
  if (payload.startsWith('zap:bill:')) return { type: 'bill', bill: clone(getDb().featuredBill) }
  return { type: 'unknown' }
}

export async function fiscalStatus(_jobId: string): Promise<{ status: string; receipt?: unknown }> {
  return { status: 'failed' } // фискальный инжест есть только в реальном API
}

export async function fiscalOcr(
  _file: File,
): Promise<{ status: string; receipt?: { total: number; items?: unknown[] }; confidence?: string; itemsRecognized?: boolean }> {
  throw new Error('OCR доступен только с реальным бэкендом')
}

export async function submitFiscalClientResult(_r: unknown): Promise<{ jobId: string; status: string; receipt?: unknown }> {
  return { jobId: 'mock', status: 'failed' } // фискальный инжест есть только в реальном API
}

/** «Оплатить целиком» / «Оплатить» без сплита. */
export async function payAlone(amount: number, merchantId?: string, title = 'Оплата'): Promise<void> {
  await fakeLatency(400, 700)
  const db = getDb()
  const merchant = db.merchants.find((m) => m.id === merchantId)
  db.history.unshift({
    id: uid('h'),
    kind: 'payment',
    title: merchant?.name ?? title,
    subtitle: 'Оплата целиком',
    amount: -amount,
    createdAt: Date.now(),
    letter: merchant?.letter ?? title[0]?.toUpperCase() ?? 'P',
    color: merchant?.color ?? '#111110',
  })
  touch('history')
}
