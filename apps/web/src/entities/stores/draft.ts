import { isRealApi } from '@/api'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Bill, SplitMode } from '@zap/shared/types'
import { equalShares } from '@/lib/format'
import { t } from '@/lib/i18n'

export interface DraftMember {
  contactId: string
  manualAmount: number
  debt: boolean
  itemIds: string[]
}

/** Черновик сплита между экранами scan → bill/amount → members. */
export const useDraftStore = defineStore('draft', () => {
  const source = ref<'bill' | 'manual' | 'fiscal'>('manual')
  /** фискальный чек: джоба догрузки позиций / OCR */
  const fiscal = ref<null | { jobId?: string; status: 'pending' | 'ready' | 'failed'; ocr?: boolean; merchant?: string; receiptTotal?: number }>(null)
  /** DEBUG: сырой payload отсканированного QR (временно показываем в UI) */
  const scannedPayload = ref('')
  const merchantId = ref<string | undefined>(undefined)
  const bill = ref<Bill | null>(null)
  const total = ref(0)
  const title = ref('')
  const mode = ref<SplitMode>('equal')
  const members = ref<DraftMember[]>([])

  function newMember(contactId: string): DraftMember {
    return { contactId, manualAmount: 0, debt: false, itemIds: [] }
  }

  /** фискальный QR: мгновенный тотал, позиции догружаются асинхронно */
  function startFiscal(amount: number, jobId?: string) {
    source.value = 'fiscal'
    fiscal.value = { jobId, status: 'pending' }
    bill.value = { merchantId: '', orderNo: '', time: '', items: [], total: amount }
    merchantId.value = undefined
    total.value = amount
    title.value = ''
    mode.value = 'equal'
    members.value = [newMember('me')]
  }

  function applyFiscalItems(receipt: { merchant?: string; total: number; items: { id: string; name: string; qty: number; amount: number }[] }, ocr = false) {
    source.value = 'fiscal'
    fiscal.value = { ...(fiscal.value ?? { status: 'ready' }), status: 'ready', ocr, merchant: receipt.merchant, receiptTotal: receipt.total }
    bill.value = {
      merchantId: '',
      orderNo: '',
      time: '',
      items: receipt.items.map((i) => ({ id: i.id, title: i.name, qty: i.qty, amount: i.amount })),
      total: receipt.total,
    }
    total.value = receipt.total
    if (!members.value.length) members.value = [newMember('me')]
    if (receipt.merchant) title.value = receipt.merchant
  }

  function fiscalFailed() {
    if (fiscal.value) fiscal.value = { ...fiscal.value, status: 'failed' }
  }

  function startFromBill(b: Bill) {
    source.value = 'bill'
    fiscal.value = null
    bill.value = b
    merchantId.value = b.merchantId
    total.value = b.total
    title.value = t('members.forWhatPlaceholder')
    mode.value = 'equal'
    // мок-демо стартует с компанией; реальный режим — только вы, участников добавляют явно
    members.value = isRealApi ? [newMember('me')] : [newMember('me'), newMember('c_ali'), newMember('c_bek')]
  }

  /** быстрый сплит из группы: чек + участники группы */
  function startForGroup(b: Bill, memberIds: string[]) {
    startFromBill(b)
    members.value = memberIds.map((id) => newMember(id))
    if (!members.value.some((m) => m.contactId === 'me')) members.value.unshift(newMember('me'))
  }

  function startManual(amount: number) {
    source.value = 'manual'
    bill.value = null
    merchantId.value = undefined
    total.value = amount
    title.value = ''
    mode.value = 'equal'
    members.value = [newMember('me')]
  }

  function hasMember(contactId: string): boolean {
    return members.value.some((m) => m.contactId === contactId)
  }

  function addMember(contactId: string) {
    if (!hasMember(contactId)) members.value.push(newMember(contactId))
    resetManualIfNeeded()
  }

  function removeMember(contactId: string) {
    if (contactId === 'me') return
    members.value = members.value.filter((m) => m.contactId !== contactId)
    resetManualIfNeeded()
  }

  function toggleDebt(contactId: string) {
    const m = members.value.find((x) => x.contactId === contactId)
    if (m && contactId !== 'me') m.debt = !m.debt
  }

  function setMode(next: SplitMode) {
    mode.value = next
    if (next === 'manual') {
      // стартуем с равных долей, дальше редактируется
      const shares = equalShares(total.value, members.value.length)
      members.value.forEach((m, i) => (m.manualAmount = shares[i] ?? 0))
    }
  }

  function resetManualIfNeeded() {
    if (mode.value === 'manual') setMode('manual')
  }

  function setManualAmount(contactId: string, amount: number) {
    const m = members.value.find((x) => x.contactId === contactId)
    if (m) m.manualAmount = amount
  }

  function toggleItem(contactId: string, itemId: string) {
    const m = members.value.find((x) => x.contactId === contactId)
    if (!m) return
    const i = m.itemIds.indexOf(itemId)
    if (i >= 0) m.itemIds.splice(i, 1)
    else m.itemIds.push(itemId)
  }

  /** Итоговые доли по выбранному режиму, с округлением до 1 000 UZS. */
  const shares = computed<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    if (mode.value === 'equal') {
      const list = equalShares(total.value, members.value.length)
      members.value.forEach((m, i) => (out[m.contactId] = list[i] ?? 0))
    } else if (mode.value === 'manual') {
      members.value.forEach((m) => (out[m.contactId] = m.manualAmount))
    } else {
      members.value.forEach((m) => (out[m.contactId] = 0))
      for (const item of bill.value?.items ?? []) {
        const assignees = members.value.filter((m) => m.itemIds.includes(item.id))
        if (!assignees.length) continue
        const parts = equalShares(item.amount, assignees.length)
        assignees.forEach((m, i) => (out[m.contactId] = (out[m.contactId] ?? 0) + (parts[i] ?? 0)))
      }
    }
    return out
  })

  const sharesSum = computed(() => Object.values(shares.value).reduce((s, v) => s + v, 0))

  const unassignedItems = computed(() => {
    if (mode.value !== 'items' || !bill.value) return 0
    return bill.value.items.filter((item) => !members.value.some((m) => m.itemIds.includes(item.id))).length
  })

  const isValid = computed(() => {
    if (members.value.length < 2 || total.value <= 0) return false
    if (mode.value === 'manual') return sharesSum.value === total.value
    if (mode.value === 'items') return unassignedItems.value === 0
    return true
  })

  /** Сколько организатор платит сразу: своя доля + доли «в долг». */
  const payNow = computed(() =>
    members.value
      .filter((m) => m.contactId === 'me' || m.debt)
      .reduce((s, m) => s + (shares.value[m.contactId] ?? 0), 0),
  )

  const myShare = computed(() => shares.value['me'] ?? 0)

  const debtMembers = computed(() => members.value.filter((m) => m.debt))

  return {
    source,
    merchantId,
    bill,
    total,
    title,
    mode,
    members,
    shares,
    sharesSum,
    unassignedItems,
    isValid,
    payNow,
    myShare,
    debtMembers,
    startFromBill,
    fiscal,
    scannedPayload,
    startFiscal,
    applyFiscalItems,
    fiscalFailed,
    startForGroup,
    startManual,
    hasMember,
    addMember,
    removeMember,
    toggleDebt,
    setMode,
    setManualAmount,
    toggleItem,
  }
})
