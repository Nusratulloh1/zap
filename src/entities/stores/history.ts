import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { HistoryEntry } from '@zap/shared/types'
import * as api from '@/api'
import { bus } from '@/lib/bus'
import { ensureBootstrap } from './bootstrap'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const loaded = ref(false)

  function refresh() {
    entries.value = api.snapshot().history
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

  return { entries, loaded, hydrate }
})
