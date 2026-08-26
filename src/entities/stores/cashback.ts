import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CashbackEntry } from '@/entities/types'
import * as api from '@/api'
import { bus } from '@/lib/bus'
import { ensureBootstrap } from './bootstrap'

export const useCashbackStore = defineStore('cashback', () => {
  const entries = ref<CashbackEntry[]>([])
  const loaded = ref(false)

  function refresh() {
    entries.value = api.snapshot().cashbackEntries
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

  const balance = computed(() => entries.value.filter((e) => !e.held).reduce((s, e) => s + e.amount, 0))

  return { entries, loaded, balance, hydrate }
})
