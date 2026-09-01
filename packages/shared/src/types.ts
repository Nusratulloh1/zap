export type Id = string

export interface User {
  id: Id
  name: string
  handle: string
  phone: string
  initials: string
  color: string
  /** ISO-дата регистрации; человекочитаемый месяц собирает клиент */
  memberSince: string
  splitsCount: number
  /** язык интерфейса аккаунта: uz | ru | en */
  locale?: string
}

export interface Card {
  id: Id
  network: 'UZCARD' | 'HUMO'
  last4: string
  primary: boolean
}

export interface Contact {
  id: Id
  name: string
  handle?: string
  phone?: string
  initials: string
  color: string
}

export interface CashbackOffer {
  label: string
  terms: string
  multiplier?: number
  percent?: number
}

export interface Merchant {
  id: Id
  name: string
  letter: string
  color: string
  offer?: CashbackOffer
}

export interface BillItem {
  id: Id
  title: string
  qty: number
  amount: number
}

export interface Bill {
  merchantId: Id
  orderNo: string
  table?: string
  time: string
  items: BillItem[]
  total: number
  promo?: string
}

export type SplitMemberStatus = 'paid' | 'opened' | 'waiting' | 'debt'

export interface SplitMember {
  contactId: Id
  amount: number
  status: SplitMemberStatus
  isYou?: boolean
  itemIds?: Id[]
  paidAt?: number
}

export type SplitMode = 'equal' | 'manual' | 'items'

/** Реакция на оплату участника: ⚡ 😂 ❤️ 🫡 🤝 (vision §16). */
export interface SplitReaction {
  memberId: Id
  emoji: string
  fromUserId: Id
  fromName: string
}

export interface Split {
  id: Id
  code: string
  title: string
  merchantId?: Id
  bill?: Bill
  total: number
  mode: SplitMode
  members: SplitMember[]
  status: 'active' | 'closed'
  createdAt: number
  closedAt?: number
  groupId?: Id
  cashback?: number
  cashbackX2?: boolean
  reactions?: SplitReaction[]
}

export interface Group {
  id: Id
  name: string
  ownerId: Id
  memberIds: Id[]
  createdAt: number
  cashback: number
  accrueCashback: boolean
  merchantsCount: number
}

export interface Debt {
  id: Id
  contactId: Id
  amount: number
  reason: string
  note?: string
  createdAt: number
  status: 'open' | 'paid'
  splitId?: Id
  direction: 'owedToMe' | 'iOwe'
  lastRemindedAt?: number
}

export interface CashbackEntry {
  id: Id
  title: string
  badge: string
  amount: number
  createdAt: number
  groupId?: Id
  held?: boolean
}

export type HistoryKind = 'split' | 'cashback' | 'debt' | 'payment'

export interface HistoryEntry {
  id: Id
  kind: HistoryKind
  title: string
  subtitle: string
  amount: number
  createdAt: number
  splitId?: Id
  contactId?: Id
  note?: string
  letter: string
  color: string
}

export interface Settings {
  debtNotifications: boolean
  promoDismissed: boolean
  visits: number
  /** кэшбэк, зарезервированный на следующий сплит */
  pendingCashback?: number
}

export interface Session {
  stage: 'onboarding' | 'phone' | 'code' | 'pin' | 'authed'
  phone?: string
  pin?: string
}

export interface Db {
  user: User
  cards: Card[]
  contacts: Contact[]
  merchants: Merchant[]
  featuredBill: Bill
  groups: Group[]
  splits: Split[]
  debts: Debt[]
  cashbackEntries: CashbackEntry[]
  history: HistoryEntry[]
  settings: Settings
}
