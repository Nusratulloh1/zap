// Реальный ApiClient: тот же интерфейс, что и мок (src/mocks/api.ts), поверх
// NestJS-бэкенда (VITE_API_URL) + Socket.IO. Кэш Db держится локально и
// обновляется рефетчем bootstrap после мутаций и по realtime-событиям.
import { io, type Socket } from 'socket.io-client'
import type { Bill, Card, Contact, Db, Group, Session, Split } from '@/entities/types'
import type { CreateSplitInput, SaveGroupInput } from '@/mocks/api'
import { bus } from '@/lib/bus'
import { money } from '@/lib/format'

const BASE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// ---------- локальное состояние ----------

const LS_TOKENS = 'zap:jwt:v1'
const LS_SESSION = 'zap:session:v1'
const LS_GUEST_PHONE = 'zap:guest-phone'

interface Tokens {
  accessToken: string
  refreshToken: string
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function saveJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* noop */
  }
}

let tokens: Tokens | null = loadJson<Tokens>(LS_TOKENS)
let session: Session = loadJson<Session>(LS_SESSION) ?? { stage: 'onboarding' }
let paymentToken: string | null = null

const EMPTY_DB: Db = {
  user: { id: 'me', name: '', handle: '', phone: '', initials: 'В', color: '#111110', memberSince: '', splitsCount: 0 },
  cards: [],
  contacts: [],
  merchants: [],
  featuredBill: undefined as unknown as Bill,
  groups: [],
  splits: [],
  debts: [],
  cashbackEntries: [],
  history: [],
  settings: { debtNotifications: true, promoDismissed: false, visits: 0, pendingCashback: 0 },
}

let cache: Db = JSON.parse(JSON.stringify(EMPTY_DB)) as Db

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function persistSession() {
  saveJson(LS_SESSION, session)
}

// ---------- HTTP ----------

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function http<T = unknown>(path: string, init: RequestInit & { auth?: boolean; pt?: boolean } = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
    if (init.auth !== false && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`
    if (init.pt && paymentToken) {
      headers['X-Payment-Token'] = paymentToken
      paymentToken = null // одноразовый
    }
    return fetch(BASE + path, { ...init, headers })
  }

  let res = await doFetch()
  if (res.status === 401 && tokens && init.auth !== false && !path.startsWith('/auth/')) {
    // один тихий refresh с ротацией
    const rr = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
    if (rr.ok) {
      tokens = (await rr.json()) as Tokens
      saveJson(LS_TOKENS, tokens)
      res = await doFetch()
    } else {
      tokens = null
      localStorage.removeItem(LS_TOKENS)
      session = { stage: 'onboarding' }
      persistSession()
    }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
    const msg = Array.isArray(body.message) ? body.message[0] : body.message
    throw new ApiError(msg ?? `Ошибка ${res.status}`, res.status)
  }
  return (await res.json().catch(() => ({}))) as T
}

// ---------- bootstrap-кэш ----------

let bootstrapInFlight: Promise<void> | null = null

async function refreshBootstrap(): Promise<void> {
  if (!tokens) return
  bootstrapInFlight ??= (async () => {
    try {
      const db = await http<Db & { featuredBill: Bill | null }>('/bootstrap')
      cache = { ...db, featuredBill: (db.featuredBill ?? undefined) as unknown as Bill }
      bus.emit('db:changed', { domains: ['all'] })
    } finally {
      bootstrapInFlight = null
    }
  })()
  return bootstrapInFlight
}

export function snapshot(): Db {
  return clone(cache)
}

export function fakeLatency(): Promise<void> {
  return Promise.resolve()
}

// ---------- realtime ----------

let socket: Socket | null = null

export function connectRealtime() {
  if (socket || !BASE) return
  // BASE может быть с префиксом (https://zapapp.uz/api): origin + namespace,
  // а engine-путь — prefix + /socket.io (nginx проксирует /api/ на бэкенд)
  const u = new URL(BASE)
  const prefix = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname
  socket = io(u.origin + '/realtime', {
    path: (prefix === '/' ? '' : prefix) + '/socket.io',
    auth: tokens ? { token: tokens.accessToken } : {},
    transports: ['websocket', 'polling'],
  })
  const refetchAnd = (kind: 'opened' | 'paid' | 'closed' | 'cashback', message: string) => {
    void refreshBootstrap().then(() => {
      const active = cache.splits.find((s) => s.status === 'active') ?? cache.splits[0]
      if (active) bus.emit('split:event', { split: clone(active), kind, message })
    })
  }
  socket.on('member_opened', (p: { name?: string }) => refetchAnd('opened', `${p.name ?? 'Участник'} открыл ссылку`))
  socket.on('member_paid', (p: { name?: string; amount?: number }) =>
    refetchAnd('paid', `${p.name ?? 'Участник'} оплатил ${money(p.amount ?? 0)}`),
  )
  socket.on('member_covered', () => void refreshBootstrap())
  socket.on('split_closed', (p: { cashback?: number }) => {
    refetchAnd('closed', 'Сплит закрыт')
    if (p.cashback) refetchAnd('cashback', `Кэшбэк зачислен +${money(p.cashback)}`)
  })
  socket.on('debt_settled', () => void refreshBootstrap())
}

function joinSplitRoom(code: string) {
  connectRealtime()
  socket?.emit('join_split', { code })
}

// ---------- session / auth ----------

export async function fetchSession(): Promise<Session> {
  if (tokens && session.stage === 'authed') void refreshBootstrap()
  return clone(session)
}

export async function startLogin(phone: string): Promise<void> {
  const res = await http<{ devCode?: string }>('/auth/otp/request', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone }),
  })
  if (import.meta.env.DEV && res.devCode) (window as { __ZAP_DEV_OTP?: string }).__ZAP_DEV_OTP = res.devCode
  session = { stage: 'code', phone }
  persistSession()
}

export async function verifyCode(code: string): Promise<void> {
  const res = await http<Tokens & { needsPin: boolean }>('/auth/otp/verify', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone: session.phone, code }),
  })
  tokens = { accessToken: res.accessToken, refreshToken: res.refreshToken }
  saveJson(LS_TOKENS, tokens)
  session = { stage: res.needsPin ? 'pin' : 'authed', phone: session.phone }
  persistSession()
  if (!res.needsPin) await refreshBootstrap()
}

export async function setPin(pin: string): Promise<void> {
  await http('/auth/pin/set', { method: 'POST', body: JSON.stringify({ pin }) })
  session = { stage: 'authed', phone: session.phone }
  persistSession()
  await refreshBootstrap()
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const res = await http<{ paymentToken: string }>('/auth/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) })
    paymentToken = res.paymentToken
    return true
  } catch {
    return false
  }
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  try {
    await http('/auth/pin/change', { method: 'POST', body: JSON.stringify({ oldPin, newPin }) })
    return true
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  if (tokens) await http('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refreshToken }) }).catch(() => undefined)
  tokens = null
  localStorage.removeItem(LS_TOKENS)
  session = { stage: 'onboarding' }
  persistSession()
  cache = clone(EMPTY_DB)
  socket?.disconnect()
  socket = null
  bus.emit('db:changed', { domains: ['all'] })
}

/** гарантия payment-токена: если PIN не подтверждён — просим через глобальный шит */
async function ensurePaymentToken(): Promise<void> {
  if (paymentToken) return
  await new Promise<void>((resolve, reject) => {
    bus.emit('pin:request', {
      resolve: () => resolve(),
      reject: () => reject(new ApiError('Оплата отменена', 400)),
    })
  })
}

// ---------- bootstrap / данные ----------

export async function fetchBootstrap(): Promise<Db> {
  await refreshBootstrap()
  connectRealtime()
  return snapshot()
}

export async function fetchFeaturedBill(): Promise<Bill> {
  await refreshBootstrap()
  if (!cache.featuredBill) throw new ApiError('Демо-чек недоступен — загрузите seed:demo', 404)
  return clone(cache.featuredBill)
}

// ---------- splits ----------

export async function createSplit(input: CreateSplitInput): Promise<Split> {
  await ensurePaymentToken()
  const contactsById = new Map(cache.contacts.map((c) => [c.id, c]))
  const members = input.members
    .filter((m) => m.contactId !== 'me')
    .map((m) => {
      const c = contactsById.get(m.contactId)
      return {
        phone: c?.phone ?? m.contactId,
        name: c?.name ?? '?',
        shareAmount: m.amount,
        inDebt: m.debt || undefined,
        itemIds: m.itemIds,
      }
    })
  const billId = (input.bill as (Bill & { billId?: string }) | undefined)?.billId
  const created = await http<{ id: string }>('/splits', {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `create-${Date.now().toString(36)}` },
    body: JSON.stringify({
      billId,
      totalAmount: billId ? undefined : input.total,
      title: input.title,
      mode: input.mode,
      merchantId: input.merchantId,
      members,
    }),
  })
  await refreshBootstrap()
  const split = cache.splits.find((s) => s.id === created.id)
  if (split) joinSplitRoom(split.code)
  return clone(split!)
}

export async function fetchSplit(id: string): Promise<Split | null> {
  await refreshBootstrap()
  const split = cache.splits.find((s) => s.id === id) ?? null
  if (split) joinSplitRoom(split.code)
  return split ? clone(split) : null
}

// ---------- участник (публичные ручки) ----------

interface PublicView {
  code: string
  title: string
  status: string
  totalAmount: number
  merchant: { name: string; letter: string; color: string } | null
  bill: { orderNo: string; total: number } | null
  creatorName: string
  cashbackX2: boolean
  members: { id: string; name: string; initial: string; status: string; amount?: number; isYou?: boolean }[]
  yourShare: number | null
  yourStatus: string | null
}

function guestPhone(): string | null {
  try {
    return sessionStorage.getItem(LS_GUEST_PHONE) ?? (session.phone ?? null)
  } catch {
    return session.phone ?? null
  }
}

async function askGuestPhone(): Promise<string> {
  const existing = guestPhone()
  if (existing) return existing
  return new Promise<string>((resolve, reject) => {
    bus.emit('guest-phone:request', {
      resolve: (phone: string) => {
        try {
          sessionStorage.setItem(LS_GUEST_PHONE, phone)
        } catch {
          /* noop */
        }
        resolve(phone)
      },
      reject: () => reject(new ApiError('Нужен номер телефона', 400)),
    })
  })
}

const statusFromPublic: Record<string, Split['members'][number]['status']> = {
  pending: 'waiting',
  opened: 'opened',
  paid: 'paid',
  covered: 'debt',
  debt: 'debt',
}

function mapPublicView(v: PublicView): Split {
  return {
    id: v.code, // публичный контекст: id == code
    code: v.code,
    title: v.title,
    merchantId: undefined,
    bill: v.bill ? ({ merchantId: '', orderNo: v.bill.orderNo, time: '', items: [], total: v.bill.total } as Bill) : undefined,
    total: v.totalAmount,
    mode: 'equal',
    members: v.members.map((m) => ({
      contactId: m.id,
      amount: m.amount ?? (m.isYou ? (v.yourShare ?? 0) : 0),
      status: (statusFromPublic[m.status] ?? 'waiting') as Split['members'][number]['status'],
      isYou: m.isYou,
    })),
    status: v.status === 'closed' ? 'closed' : 'active',
    createdAt: Date.now(),
    cashbackX2: v.cashbackX2,
    memberNames: Object.fromEntries(v.members.map((m) => [m.id, m.name])),
  } as Split
}

let lastPublicCode = ''

export async function fetchSplitByCode(code: string): Promise<Split | null> {
  const phone = await askGuestPhone().catch(() => null)
  try {
    const view = await http<PublicView>(`/s/${encodeURIComponent(code)}${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`, { auth: false })
    lastPublicCode = view.code
    joinSplitRoom(view.code)
    return mapPublicView(view)
  } catch {
    return null
  }
}

export function markOpened(splitCodeOrId: string, _contactId: string) {
  const phone = guestPhone()
  if (!phone) return
  void http(`/s/${encodeURIComponent(lastPublicCode || splitCodeOrId)}/open`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone }),
  }).catch(() => undefined)
}

/** оплата доли гостем: OTP-lite (SMS-код) через глобальный шит */
export async function payShare(splitCodeOrId: string, _contactId: string): Promise<Split | null> {
  const code = lastPublicCode || splitCodeOrId
  const phone = await askGuestPhone()
  const view = await http<PublicView>(`/s/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`, { auth: false })
  const amount = view.yourShare ?? 0
  if (amount <= 0) return mapPublicView(view)

  const step1 = await http<{ otpRequired?: boolean; devCode?: string } & Partial<PublicView>>(`/s/${encodeURIComponent(code)}/pay`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone, amount }),
  })
  if (!step1.otpRequired) return mapPublicView(step1 as PublicView)

  const otp = await new Promise<string>((resolve, reject) => {
    if (import.meta.env.DEV && step1.devCode) {
      resolve(step1.devCode)
      return
    }
    bus.emit('guest-otp:request', { resolve, reject: () => reject(new ApiError('Оплата отменена', 400)) })
  })
  const paid = await http<PublicView>(`/s/${encodeURIComponent(code)}/pay`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone, amount, code: otp }),
  })
  return mapPublicView(paid)
}

export async function coverRemainder(splitId: string): Promise<Split | null> {
  await ensurePaymentToken()
  await http(`/splits/${splitId}/cover`, {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `cover-${splitId}-${Date.now().toString(36)}` },
    body: JSON.stringify({}),
  })
  await refreshBootstrap()
  return clone(cache.splits.find((s) => s.id === splitId) ?? null)
}

export async function remindSplitMember(splitId: string, contactId: string): Promise<void> {
  const split = cache.splits.find((s) => s.id === splitId)
  const member = split?.members.find((m) => m.contactId === contactId) as { memberId?: string } | undefined
  if (!member?.memberId) return
  await http(`/splits/${splitId}/remind/${member.memberId}`, { method: 'POST' })
}

export async function saveGroup(input: SaveGroupInput): Promise<Group> {
  const split = cache.splits.find((s) => s.id === input.splitId)
  const memberIds = (split?.members as { contactId: string; memberId?: string }[] | undefined)
    ?.filter((m) => input.memberIds.includes(m.contactId))
    .map((m) => m.memberId)
    .filter(Boolean)
  await http(`/splits/${input.splitId}/save-group`, {
    method: 'POST',
    body: JSON.stringify({ name: input.name, memberIds, accrueCashback: input.accrueCashback }),
  })
  await refreshBootstrap()
  const group = cache.splits.find((s) => s.id === input.splitId)?.groupId
  return clone(cache.groups.find((g) => g.id === group) ?? cache.groups[cache.groups.length - 1]!)
}

// ---------- debts ----------

export async function remindDebt(debtId: string): Promise<void> {
  await http(`/debts/${debtId}/remind`, { method: 'POST' })
  await refreshBootstrap()
}

export async function remindAllDebts(): Promise<void> {
  await http('/debts/remind-all', { method: 'POST' })
  await refreshBootstrap()
}

export async function repayDebt(debtId: string): Promise<void> {
  await http(`/debts/${debtId}/mark-returned`, { method: 'POST' })
  await refreshBootstrap()
}

// ---------- contacts / cards / settings ----------

export async function addContact(phoneDigits: string): Promise<Contact> {
  const contact = await http<Contact>('/contacts', { method: 'POST', body: JSON.stringify({ phone: phoneDigits }) })
  await refreshBootstrap()
  return contact
}

export async function addCard(network: Card['network'], last4: string): Promise<Card> {
  const card = await http<Card>('/cards', { method: 'POST', body: JSON.stringify({ brand: network, last4 }) })
  await refreshBootstrap()
  return card
}

export async function setPrimaryCard(cardId: string): Promise<void> {
  await http(`/cards/${cardId}/primary`, { method: 'POST' })
  await refreshBootstrap()
}

export async function spendCashbackNext(): Promise<number> {
  const res = await http<{ pendingCashback: number }>('/cashback/spend', { method: 'POST' })
  await refreshBootstrap()
  return res.pendingCashback
}

export async function withdrawCashback(cardId: string, amount: number): Promise<void> {
  await ensurePaymentToken()
  await http('/cashback/withdraw', {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `wd-${Date.now().toString(36)}` },
    body: JSON.stringify({ cardId, amount }),
  })
  await refreshBootstrap()
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  await http(`/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  await refreshBootstrap()
}

export async function deleteGroup(groupId: string): Promise<void> {
  await http(`/groups/${groupId}`, { method: 'DELETE' })
  await refreshBootstrap()
}

export async function toggleDebtNotifications(value: boolean): Promise<void> {
  await http('/settings', { method: 'PATCH', body: JSON.stringify({ debtNotifications: value }) })
  cache.settings.debtNotifications = value
}

export function dismissPromo() {
  cache.settings.promoDismissed = true
  void http('/settings', { method: 'PATCH', body: JSON.stringify({ promoDismissed: true }) }).catch(() => undefined)
  bus.emit('db:changed', { domains: ['settings'] })
}

export async function payAlone(amount: number, merchantId?: string, title = 'Оплата'): Promise<void> {
  await ensurePaymentToken()
  await http('/payments/pay', {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `pay-${Date.now().toString(36)}` },
    body: JSON.stringify({ amount, title, merchantId }),
  })
  await refreshBootstrap()
}

export function payShareSync(): Split | null {
  return null // симулятора в реальном режиме нет
}
