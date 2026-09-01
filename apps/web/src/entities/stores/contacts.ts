import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Bill, Contact, Merchant } from '@zap/shared/types'
import * as api from '@/api'
import { bus } from '@/lib/bus'
import { ensureBootstrap } from './bootstrap'

export const useContactsStore = defineStore('contacts', () => {
  const contacts = ref<Contact[]>([])
  const merchants = ref<Merchant[]>([])
  const featuredBill = ref<Bill | null>(null)
  const loaded = ref(false)

  function refresh() {
    const db = api.snapshot()
    contacts.value = db.contacts
    merchants.value = db.merchants
    featuredBill.value = db.featuredBill
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

  function byId(id: string): Contact | undefined {
    return contacts.value.find((c) => c.id === id)
  }

  function merchantById(id?: string): Merchant | undefined {
    return merchants.value.find((m) => m.id === id)
  }

  return { contacts, merchants, featuredBill, loaded, hydrate, byId, merchantById }
})
