import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Split } from '@zap/shared/types'
import * as api from '@/api'
import { markSplitCreated } from '@/lib/installPrompt'
import { simulateSplitProgress, cancelSimulation } from '@/api/events'
import { bus } from '@/lib/bus'
import { ensureBootstrap } from './bootstrap'

export const useSplitsStore = defineStore('splits', () => {
  const splits = ref<Split[]>([])
  const loaded = ref(false)

  function refresh() {
    splits.value = api.snapshot().splits
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

  const activeSplit = computed(() => splits.value.find((s) => s.status === 'active') ?? null)

  function byId(id: string): Split | undefined {
    return splits.value.find((s) => s.id === id)
  }

  async function create(input: api.CreateSplitInput): Promise<Split> {
    const split = await api.createSplit(input)
    markSplitCreated()
    refresh()
    if (split.status === 'active') simulateSplitProgress(split.id)
    return split
  }

  async function coverRemainder(id: string) {
    cancelSimulation(id)
    await api.coverRemainder(id)
    refresh()
  }

  async function payShare(id: string, contactId: string) {
    await api.payShare(id, contactId)
    refresh()
  }

  async function remindMember(id: string, contactId: string) {
    await api.remindSplitMember(id, contactId)
  }

  return { splits, loaded, activeSplit, hydrate, byId, create, coverRemainder, payShare, remindMember }
})
