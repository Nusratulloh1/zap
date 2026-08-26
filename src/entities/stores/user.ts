import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Card, Session, Settings, User } from '@/entities/types'
import * as api from '@/api'
import { bus } from '@/lib/bus'
import { ensureBootstrap, resetBootstrap } from './bootstrap'

export const useUserStore = defineStore('user', () => {
  const session = ref<Session>({ stage: 'onboarding' })
  const user = ref<User | null>(null)
  const cards = ref<Card[]>([])
  const settings = ref<Settings>({ debtNotifications: true, promoDismissed: false, visits: 0 })
  const loaded = ref(false)
  const sessionLoaded = ref(false)

  const isAuthed = computed(() => session.value.stage === 'authed')

  function refresh() {
    const db = api.snapshot()
    user.value = db.user
    cards.value = db.cards
    settings.value = db.settings
  }

  bus.on('db:changed', ({ domains }) => {
    if (loaded.value || domains.includes('all')) refresh()
  })

  async function hydrateSession() {
    if (sessionLoaded.value) return
    session.value = await api.fetchSession()
    sessionLoaded.value = true
  }

  async function hydrate() {
    if (loaded.value) return
    await ensureBootstrap()
    refresh()
    loaded.value = true
  }

  async function startLogin(phone: string) {
    await api.startLogin(phone)
    session.value = await api.fetchSession()
  }

  async function verifyCode(code: string) {
    await api.verifyCode(code)
    session.value = await api.fetchSession()
  }

  async function setPin(pin: string) {
    await api.setPin(pin)
    session.value = await api.fetchSession()
  }

  async function logout() {
    await api.logout()
    resetBootstrap()
    session.value = await api.fetchSession()
    loaded.value = false
  }

  async function toggleDebtNotifications(value: boolean) {
    settings.value.debtNotifications = value
    await api.toggleDebtNotifications(value)
  }

  async function addCard(network: Card['network'], last4: string) {
    await api.addCard(network, last4)
  }

  function dismissPromo() {
    settings.value.promoDismissed = true
    api.dismissPromo()
  }

  return {
    session,
    user,
    cards,
    settings,
    loaded,
    isAuthed,
    hydrate,
    hydrateSession,
    startLogin,
    verifyCode,
    setPin,
    logout,
    toggleDebtNotifications,
    addCard,
    dismissPromo,
  }
})
