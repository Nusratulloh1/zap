// Контракт API-клиента: единственное описание поверхности бэкенда для обоих
// клиентов. Веб реализует его двумя способами (реальный HTTP и оффлайн-мок),
// мобильный — только реальным. Расхождение реализации и контракта ловится
// компилятором, а не на проде.
//
// Здесь ТОЛЬКО типы: у веба и RN разные рантаймы (import.meta.env против
// process.env, localStorage против Keychain), поэтому код не переиспользуется.
import type {
  Bill,
  Card,
  CashbackEntry,
  Contact,
  Db,
  Debt,
  Group,
  Id,
  Session,
  Split,
  SplitMode,
  User,
} from './types'

export interface CreateSplitInput {
  total: number
  title: string
  mode: SplitMode
  memberIds: Id[]
  shares?: Record<Id, number>
  debtorIds?: Id[]
  merchantId?: Id
}

export interface SaveGroupInput {
  splitId: Id
  name: string
  accrueCashback: boolean
}

/** Данные участника по публичной ссылке /s/:code — без авторизации. */
export interface ParticipantView {
  code: string
  title: string
  total: number
  organizerName: string
  yourShare: number
  paid: boolean
  membersPaid: number
  membersTotal: number
}

export interface AuthApi {
  fetchSession(): Promise<Session>
  startLogin(phone: string): Promise<void>
  verifyCode(code: string): Promise<void>
  setPin(pin: string): Promise<void>
  verifyPin(pin: string): Promise<boolean>
  changePin(oldPin: string, newPin: string): Promise<boolean>
  logout(): Promise<void>
}

export interface ProfileApi {
  updateProfile(name: string, handle?: string): Promise<void>
  setLocale(locale: string): Promise<void>
  checkHandle(handle: string): Promise<{ valid: boolean; available: boolean; handle: string }>
  searchUsers(query: string): Promise<Contact[]>
  addCard(last4: string): Promise<void>
  setPrimaryCard(id: Id): Promise<void>
  addContact(phone: string, name?: string): Promise<Contact>
}

export interface SplitApi {
  createSplit(input: CreateSplitInput): Promise<Split>
  fetchSplit(id: Id): Promise<Split | null>
  fetchSplitByCode(code: string): Promise<ParticipantView | null>
  markOpened(code: string): Promise<void>
  payShare(code: string, amount: number): Promise<void>
  coverRemainder(splitId: Id): Promise<void>
  remindSplitMember(splitId: Id, memberId: Id): Promise<void>
  sendSplitLinkSms(splitId: Id): Promise<void>
  payAlone(total: number, merchantId?: Id): Promise<void>
}

export interface MoneyApi {
  saveGroup(input: SaveGroupInput): Promise<Group>
  renameGroup(id: Id, name: string): Promise<void>
  deleteGroup(id: Id): Promise<void>
  remindDebt(id: Id): Promise<void>
  remindAllDebts(): Promise<void>
  repayDebt(id: Id): Promise<void>
  spendCashbackNext(): Promise<void>
  withdrawCashback(amount: number): Promise<void>
}

export interface BootstrapApi {
  /** Синхронный снимок кэша — сторы перечитывают его по событиям шины. */
  snapshot(): Db
  fetchBootstrap(): Promise<void>
  fetchFeaturedBill(): Promise<Bill | null>
}

/** Полная поверхность клиента. */
export interface ApiClient extends AuthApi, ProfileApi, SplitApi, MoneyApi, BootstrapApi {}

// Реэкспорт доменных типов, чтобы клиентам хватало одного импорта.
export type { Bill, Card, CashbackEntry, Contact, Db, Debt, Group, Id, Session, Split, User }
