import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Debt } from '@/entities/types'
import * as api from '@/mocks/api'
import { bus } from '@/lib/bus'
import { ensureBootstrap } from './bootstrap'

export const useDebtsStore = defineStore('debts', () => {
  const debts = ref<Debt[]>([])
  const loaded = ref(false)

  function refresh() {
    debts.value = api.snapshot().debts
  }

  bus.on('db:changed', ({ domains }) => {
    if (loaded.value || domains.includes('all')) refresh()
  })

  async function hydrate() {
    if (loaded.value) return
    await ensureBootstrap()
    refresh()
    loaded.value = true
  }

  const openDebts = computed(() => debts.value.filter((d) => d.status === 'open' && d.direction === 'owedToMe'))
  const totalOwedToMe = computed(() => openDebts.value.reduce((s, d) => s + d.amount, 0))
  const debtorIds = computed(() => [...new Set(openDebts.value.map((d) => d.contactId))])

  async function remind(debtId: string) {
    await api.remindDebt(debtId)
    refresh()
  }

  async function remindAll() {
    await api.remindAllDebts()
    refresh()
  }

  async function repay(debtId: string) {
    await api.repayDebt(debtId)
    refresh()
  }

  return { debts, loaded, openDebts, totalOwedToMe, debtorIds, hydrate, remind, remindAll, repay }
})
