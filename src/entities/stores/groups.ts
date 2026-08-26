import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Group } from '@/entities/types'
import * as api from '@/api'
import { bus } from '@/lib/bus'
import { ensureBootstrap } from './bootstrap'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const loaded = ref(false)

  function refresh() {
    groups.value = api.snapshot().groups
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

  function byId(id: string): Group | undefined {
    return groups.value.find((g) => g.id === id)
  }

  async function save(input: api.SaveGroupInput): Promise<Group> {
    const group = await api.saveGroup(input)
    refresh()
    return group
  }

  return { groups, loaded, hydrate, byId, save }
})
