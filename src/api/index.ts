// Переключатель API: VITE_API_URL задан → реальный бэкенд, иначе мок
// (оффлайн-демо). Интерфейс одинаковый — UI не меняется.
import * as mock from '@/mocks/api'
import * as real from './real'

export const isRealApi = Boolean(import.meta.env.VITE_API_URL)

const impl = (isRealApi ? real : mock) as typeof mock

export type { CreateSplitInput, SaveGroupInput } from '@/mocks/api'

export const snapshot = impl.snapshot
export const fetchSession = impl.fetchSession
export const startLogin = impl.startLogin
export const verifyCode = impl.verifyCode
export const setPin = impl.setPin
export const verifyPin = impl.verifyPin
export const logout = impl.logout
export const fetchBootstrap = impl.fetchBootstrap
export const fetchFeaturedBill = impl.fetchFeaturedBill
export const createSplit = impl.createSplit
export const fetchSplit = impl.fetchSplit
export const fetchSplitByCode = impl.fetchSplitByCode
export const markOpened = impl.markOpened
export const payShare = impl.payShare
export const payShareSync = impl.payShareSync
export const guestNeedsPin = impl.guestNeedsPin
export const coverRemainder = impl.coverRemainder
export const remindSplitMember = impl.remindSplitMember
export const sendSplitLinkSms = impl.sendSplitLinkSms
export const saveGroup = impl.saveGroup
export const remindDebt = impl.remindDebt
export const remindAllDebts = impl.remindAllDebts
export const repayDebt = impl.repayDebt
export const addContact = impl.addContact
export const updateProfile = impl.updateProfile
export const addCard = impl.addCard
export const setPrimaryCard = impl.setPrimaryCard
export const changePin = impl.changePin
export const spendCashbackNext = impl.spendCashbackNext
export const withdrawCashback = impl.withdrawCashback
export const renameGroup = impl.renameGroup
export const deleteGroup = impl.deleteGroup
export const toggleDebtNotifications = impl.toggleDebtNotifications
export const dismissPromo = impl.dismissPromo
export const payAlone = impl.payAlone
export const fakeLatency = impl.fakeLatency
export const resolveQr = impl.resolveQr
export const fiscalStatus = impl.fiscalStatus
export const fiscalOcr = impl.fiscalOcr
export const submitFiscalClientResult = impl.submitFiscalClientResult
