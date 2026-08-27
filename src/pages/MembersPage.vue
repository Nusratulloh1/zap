<script setup lang="ts">
// Дизайн 3b: «С кем делим?» — сумма 40px, строка «За что» с лаймовым подчёркиванием,
// чипы режимов, участники с фото-аватарами (должник — в grayscale, чип «В ДОЛГ»),
// «ДОБАВИТЬ» с аватар-чипами, CTA «Сплит · оплатить N».
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { money } from '@/lib/format'
import { tap } from '@/lib/haptics'
import { useDraftStore } from '@/entities/stores/draft'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import { useSplitsStore } from '@/entities/stores/splits'
import { addContact, searchUsers } from '@/api'
import type { UserSearchResult } from '@/api/real'
import ZapAvatar from '@/components/ZapAvatar.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import AmountField from '@/components/AmountField.vue'
import PinSheet from '@/components/PinSheet.vue'
import AnimatedList from '@/components/AnimatedList.vue'

const router = useRouter()
const draft = useDraftStore()
const contacts = useContactsStore()
const user = useUserStore()
const splits = useSplitsStore()

onMounted(() => {
  void contacts.hydrate()
  void user.hydrate()
})

if (draft.total <= 0) router.replace('/split/scan')

const modeOptions = computed(() => {
  const base: { value: string; label: string }[] = [
    { value: 'equal', label: 'Поровну' },
    { value: 'manual', label: 'Вручную' },
  ]
  if (draft.bill) base.push({ value: 'items', label: 'Позиции' })
  return base
})

const mode = computed({
  get: () => draft.mode,
  set: (v) => draft.setMode(v as 'equal' | 'manual' | 'items'),
})

function nameOf(id: string): string {
  return id === 'me' ? (user.user?.name || 'Вы') : (contacts.byId(id)?.name ?? '?')
}

function colorOf(id: string): string {
  return id === 'me' ? '#111110' : (contacts.byId(id)?.color ?? '#8A887E')
}

function subOf(contactId: string, debt: boolean): string {
  if (contactId === 'me') return 'оплатите сразу'
  if (debt) return 'сейчас без денег — беру в долг'
  const handle = contacts.byId(contactId)?.handle
  return handle ? `${handle} · ссылка в SMS` : 'ссылка в SMS'
}

const notAdded = computed(() => contacts.contacts.filter((c) => !draft.hasMember(c.id)))

// правый край строки: в ручном режиме — редактор, иначе — переключение «в долг»
function onAmountTap(contactId: string) {
  if (draft.mode === 'manual') {
    openEdit(contactId)
    return
  }
  if (contactId !== 'me') {
    draft.toggleDebt(contactId)
    tap()
  }
}

const editing = ref<string | null>(null)
const editRaw = ref('')

function openEdit(contactId: string) {
  editing.value = contactId
  editRaw.value = String(draft.shares[contactId] ?? 0)
}

function commitEdit() {
  if (editing.value) draft.setManualAmount(editing.value, Number(editRaw.value || '0'))
  editing.value = null
}

const allContactsSheet = ref(false)
const contactSearch = ref('')

// «+ Номер»: шит с вводом телефона
const phoneSheet = ref(false)
const phoneDigits = ref('')
const phoneName = ref('')
const phoneInputEl = ref<HTMLInputElement | null>(null)

function phoneMask(d: string): string {
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}

function onPhoneInput(e: Event) {
  const el = e.target as HTMLInputElement
  phoneDigits.value = el.value.replace(/\D/g, '').slice(0, 9)
  el.value = phoneMask(phoneDigits.value)
}

async function addByPhone() {
  if (phoneDigits.value.length !== 9 || phoneName.value.trim().length < 2) return
  const c = await addContact(phoneDigits.value, phoneName.value)
  draft.addMember(c.id)
  phoneSheet.value = false
  phoneDigits.value = ''
  phoneName.value = ''
}

const filteredContacts = computed(() => {
  const q = contactSearch.value.trim().toLowerCase()
  if (!q) return contacts.contacts
  return contacts.contacts.filter((c) => c.name.toLowerCase().includes(q))
})

// ---------- поиск пользователей ZAP! по @username ----------
// Локальных контактов может не быть: ищем по всей базе по юзернейму/имени
// и добавляем найденного как участника (по его номеру).
const userResults = ref<UserSearchResult[]>([])
const searching = ref(false)
let searchTimer = 0
let searchSeq = 0

watch(contactSearch, (q) => {
  window.clearTimeout(searchTimer)
  const query = q.trim()
  if (query.length < 2) {
    userResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  const seq = ++searchSeq
  searchTimer = window.setTimeout(async () => {
    try {
      const res = await searchUsers(query)
      if (seq !== searchSeq) return // устаревший ответ
      // не показываем тех, кто уже есть в локальных контактах
      const known = new Set(contacts.contacts.map((c) => (c.phone ?? '').replace(/\D/g, '').slice(-9)))
      userResults.value = res.filter((u) => !known.has(u.phone.replace(/\D/g, '').slice(-9)))
    } catch {
      if (seq === searchSeq) userResults.value = []
    } finally {
      if (seq === searchSeq) searching.value = false
    }
  }, 350)
})

/** Добавить найденного пользователя: заводим контакт по номеру → в участники. */
async function addFoundUser(u: UserSearchResult) {
  const digits = u.phone.replace(/\D/g, '').slice(-9)
  const c = await addContact(digits, u.name)
  draft.addMember(c.id)
  userResults.value = userResults.value.filter((x) => x.id !== u.id)
  contactSearch.value = ''
}

// зарезервированный кэшбэк уменьшает «вашу долю»
const pendingCashback = computed(() => Math.min(user.settings.pendingCashback ?? 0, draft.myShare))

const validationMessage = computed(() => {
  if (draft.mode === 'manual' && draft.sharesSum !== draft.total) {
    const diff = draft.total - draft.sharesSum
    return diff > 0 ? `Не хватает ${money(diff)} до итога` : `Сумма больше итога на ${money(-diff)}`
  }
  if (draft.mode === 'items' && draft.unassignedItems > 0) {
    return `Не распределено позиций: ${draft.unassignedItems}`
  }
  return ''
})

const pinSheet = ref(false)
const creating = ref(false)

const merchant = computed(() => contacts.merchantById(draft.merchantId))

const GEN: Record<string, string> = { Али: 'Али', Бек: 'Бека', Азиз: 'Азиза', Тимур: 'Тимура', Мадина: 'Мадины' }

const ctaSub = computed(() => {
  const debtor = draft.debtMembers[0]
  if (!debtor) return `Ваша доля ${money(draft.myShare)}`
  const n = nameOf(debtor.contactId)
  return `Ваша доля ${money(draft.myShare)} + доля ${GEN[n] ?? n} в долг ${money(draft.shares[debtor.contactId] ?? 0)}`
})

async function createSplit() {
  pinSheet.value = false
  if (creating.value) return
  creating.value = true
  const split = await splits.create({
    title: draft.title.trim() || (draft.bill ? 'Ужин пятница 🍕' : 'Совместный счёт'),
    total: draft.total,
    mode: draft.mode,
    merchantId: draft.merchantId,
    bill: draft.bill ?? undefined,
    members: draft.members.map((m) => ({
      contactId: m.contactId,
      amount: draft.shares[m.contactId] ?? 0,
      debt: m.debt,
      itemIds: draft.mode === 'items' ? m.itemIds : undefined,
    })),
  })
  router.replace(split.status === 'closed' ? `/split/${split.id}/closed` : `/split/${split.id}/share`)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      aria-label="Назад"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.back()"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <h1 class="mt-[26px] text-[27px] font-extrabold tracking-[-0.01em]">С кем делим?</h1>

    <div class="mt-3.5 flex items-baseline gap-2">
      <span class="text-[40px] font-extrabold leading-none tracking-[-0.03em]">{{ money(draft.total) }}</span>
      <span class="font-mono text-[11px] font-bold text-faint-2">UZS</span>
    </div>

    <label class="mt-3.5 flex items-center gap-2.5 border-b-2 border-lime pb-2.5">
      <span class="shrink-0 text-[15.5px] font-extrabold text-muted">За что</span>
      <input
        v-model="draft.title"
        name="split-title"
        autocomplete="off"
        placeholder="Ужин пятница 🍕"
        class="w-full bg-transparent text-[16px] font-bold text-ink outline-none [caret-color:#DDFF33] placeholder:text-faint"
      />
    </label>

    <p v-if="draft.mode === 'equal'" class="mt-2 text-[12.5px] font-semibold text-faint">
      по {{ money(draft.shares['me'] ?? 0) }} на человека
    </p>
    <p v-else-if="validationMessage" class="mt-2 text-[12.5px] font-semibold text-danger">{{ validationMessage }}</p>

    <div class="mt-[22px] flex gap-2">
      <button
        v-for="o in modeOptions"
        :key="o.value"
        type="button"
        class="press flex h-10 items-center rounded-full px-[18px] text-[13.5px] transition-colors"
        :class="mode === o.value ? 'bg-lime font-extrabold text-on-lime' : 'bg-sand font-bold text-slate'"
        @click="mode = o.value as 'equal' | 'manual' | 'items'"
      >
        {{ o.label }}
      </button>
    </div>

    <!-- участники -->
    <AnimatedList class="mt-7 flex flex-col gap-3">
      <div v-for="m in draft.members" :key="m.contactId" class="flex items-center gap-3.5">
        <button type="button" class="press shrink-0" @click="m.contactId !== 'me' && draft.removeMember(m.contactId)">
          <ZapAvatar
            :name="nameOf(m.contactId)"
            :color="colorOf(m.contactId)"
            :contact-id="m.contactId"
            class="h-12 w-12"
            :class="m.debt ? 'grayscale' : ''"
            size="md"
          />
        </button>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-[16px] font-bold">{{ nameOf(m.contactId) }}<template v-if="m.contactId === 'me'"> · вы</template></span>
          <span class="text-[12.5px] font-semibold text-faint">{{ subOf(m.contactId, m.debt) }}</span>
        </div>
        <button type="button" class="press" @click="onAmountTap(m.contactId)">
          <span
            v-if="m.debt"
            class="remind-chip flex h-[30px] items-center rounded-full bg-ink px-3 font-mono text-[10px] font-bold tracking-[0.08em] text-lime"
          >
            В ДОЛГ
          </span>
          <span v-else class="text-[16px] font-extrabold" :class="draft.mode === 'manual' ? 'rounded-lg bg-sand px-2 py-1' : ''">
            {{ money(draft.shares[m.contactId] ?? 0) }}
          </span>
        </button>
      </div>
    </AnimatedList>

    <!-- позиции -->
    <div v-if="draft.mode === 'items' && draft.bill" class="mt-5 flex flex-col gap-2.5">
      <div v-for="item in draft.bill.items" :key="item.id" class="border-b border-sand-2 pb-2.5">
        <div class="flex items-baseline justify-between">
          <span class="text-[14px] font-semibold">{{ item.title }}<template v-if="item.qty > 1"> ×{{ item.qty }}</template></span>
          <span class="font-mono text-[12.5px] font-bold">{{ money(item.amount) }}</span>
        </div>
        <div class="mt-2 flex gap-1.5">
          <button
            v-for="m in draft.members"
            :key="m.contactId"
            type="button"
            class="press flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] font-bold transition-colors"
            :class="m.itemIds.includes(item.id) ? 'bg-ink text-paper' : 'bg-sand text-muted'"
            @click="draft.toggleItem(m.contactId, item.id); tap()"
          >
            <ZapAvatar :name="nameOf(m.contactId)" :color="colorOf(m.contactId)" :contact-id="m.contactId" class="h-6 w-6" size="xs" />
            {{ m.contactId === 'me' ? 'Вы' : nameOf(m.contactId) }}
          </button>
        </div>
      </div>
    </div>

    <!-- добавить -->
    <div class="mt-6 flex items-baseline justify-between">
      <span class="font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">ДОБАВИТЬ</span>
      <button type="button" class="text-[13px] font-bold text-muted" @click="allContactsSheet = true">Все контакты ›</button>
    </div>
    <div class="no-scrollbar -mx-6 mt-3.5 flex gap-3.5 overflow-x-auto px-6">
      <button
        v-for="c in notAdded"
        :key="c.id"
        type="button"
        class="press flex min-w-[56px] flex-col items-center gap-1.5"
        @click="draft.addMember(c.id)"
      >
        <span class="relative h-[52px] w-[52px]">
          <ZapAvatar :name="c.name" :color="c.color" :contact-id="c.id" class="h-[52px] w-[52px]" size="lg" />
          <span class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-paper bg-lime text-[12px] font-bold text-on-lime">+</span>
        </span>
        <span class="text-[11.5px] font-bold">{{ c.name }}</span>
      </button>
      <button type="button" class="press flex min-w-[56px] flex-col items-center gap-1.5" @click="allContactsSheet = true">
        <span class="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sand">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <circle cx="9.5" cy="9.5" r="6.5" stroke="#A3A199" stroke-width="2.2" />
            <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="#A3A199" stroke-width="2.2" stroke-linecap="round" />
          </svg>
        </span>
        <span class="text-[11.5px] font-bold text-faint-2">Найти</span>
      </button>
      <button type="button" class="press flex min-w-[56px] flex-col items-center gap-1.5" @click="phoneSheet = true">
        <span class="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sand text-[22px] font-semibold text-faint-2">+</span>
        <span class="text-[11.5px] font-bold text-faint-2">Номер</span>
      </button>
    </div>

    <div class="flex-1" />

    <div class="kb-avoid bg-paper pt-4">
      <button
        type="button"
        class="press flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="!draft.isValid || creating"
        @click="pinSheet = true"
      >
        Сплит · оплатить {{ money(draft.payNow) }}
      </button>
      <p class="mt-3 text-center text-[12px] font-semibold text-muted">{{ ctaSub }}</p>
      <p v-if="pendingCashback > 0" class="mt-1.5 flex justify-center">
        <span class="flex h-6 items-center rounded-full bg-lime px-2.5 text-[11px] font-extrabold text-on-lime">кэшбэк −{{ money(pendingCashback) }}</span>
      </p>
    </div>

    <!-- редактирование доли (режим «Вручную») -->
    <BottomSheet :open="editing !== null" @close="commitEdit">
      <div class="pb-4">
        <p class="text-center text-[15px] font-extrabold">{{ editing ? nameOf(editing) : '' }}</p>
        <AmountField v-if="editing" v-model="editRaw" autofocus placeholder-zero display-class="text-[36px] leading-none" class="my-5" />
        <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">UZS</p>
        <button type="button" class="press mt-4 h-12 w-full rounded-full bg-ink text-[15px] font-bold text-paper" @click="commitEdit">
          Готово
        </button>
      </div>
    </BottomSheet>

    <!-- все контакты -->
    <BottomSheet :open="allContactsSheet" @close="allContactsSheet = false">
      <div class="pb-4">
        <p class="mb-3 text-center text-[15px] font-extrabold">Контакты</p>
        <label class="mb-2 flex h-11 items-center gap-2.5 rounded-full bg-sand px-4">
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
            <circle cx="9.5" cy="9.5" r="6.5" stroke="#A3A199" stroke-width="2.2" />
            <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="#A3A199" stroke-width="2.2" stroke-linecap="round" />
          </svg>
          <input
            v-model="contactSearch"
            placeholder="Имя или @username"
            autocapitalize="none"
            autocomplete="off"
            class="w-full bg-transparent text-[16px] font-semibold outline-none placeholder:text-faint"
          />
        </label>

        <!-- найдено в ZAP! по @username (когда в контактах нет) -->
        <template v-if="contactSearch.trim().length >= 2">
          <p v-if="searching" class="py-3 text-center text-[12.5px] font-semibold text-muted">Ищем в ZAP!…</p>
          <template v-else-if="userResults.length">
            <p class="pt-3 font-mono text-[10px] font-bold tracking-[0.14em] text-faint-2">ПОЛЬЗОВАТЕЛИ ZAP!</p>
            <div
              v-for="u in userResults"
              :key="u.id"
              class="flex items-center gap-3 border-b border-sand-2 py-3 last:border-0"
            >
              <ZapAvatar :name="u.name" :color="u.color" :contact-id="u.id" class="h-10 w-10" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[14px] font-bold">{{ u.name }}</p>
                <p class="font-mono text-[11px] text-muted">{{ u.handle }}</p>
              </div>
              <button
                type="button"
                class="press h-8 shrink-0 rounded-full bg-lime px-3.5 text-[12px] font-extrabold text-on-lime"
                @click="addFoundUser(u)"
              >
                Добавить
              </button>
            </div>
          </template>
          <p v-else-if="!filteredContacts.length" class="py-3 text-center text-[12.5px] font-semibold text-muted">
            Никого не нашли — добавьте по номеру
          </p>
        </template>

        <div
          v-for="c in filteredContacts"
          :key="c.id"
          class="flex items-center gap-3 border-b border-sand-2 py-3 last:border-0"
        >
          <ZapAvatar :name="c.name" :color="c.color" :contact-id="c.id" class="h-10 w-10" size="sm" />
          <div class="flex-1">
            <p class="text-[14px] font-bold">{{ c.name }}</p>
            <p class="font-mono text-[11px] text-muted">{{ c.handle ?? '' }}</p>
          </div>
          <button
            type="button"
            class="press h-8 rounded-full px-3.5 text-[12px] font-bold"
            :class="draft.hasMember(c.id) ? 'bg-sand text-muted' : 'bg-ink text-paper'"
            @click="draft.hasMember(c.id) ? draft.removeMember(c.id) : draft.addMember(c.id)"
          >
            {{ draft.hasMember(c.id) ? 'Убрать' : 'Добавить' }}
          </button>
        </div>
      </div>
    </BottomSheet>

    <!-- «+ Номер» -->
    <BottomSheet :open="phoneSheet" @close="phoneSheet = false">
      <div class="pb-4">
        <p class="text-center text-[15px] font-extrabold">Добавить по номеру</p>
        <label class="mt-4 flex items-center gap-3 border-b-2 border-lime pb-3">
          <span class="text-[22px] font-bold text-muted">+998</span>
          <input
            ref="phoneInputEl"
            type="tel"
            inputmode="tel"
            placeholder="90 123 45 67"
            class="w-full bg-transparent text-[22px] font-extrabold outline-none [caret-color:#DDFF33] placeholder:text-faint"
            @input="onPhoneInput"
          />
        </label>
        <label class="mt-3 flex items-center border-b-2 border-sand-2 pb-3 transition-colors focus-within:border-lime">
          <input
            v-model="phoneName"
            type="text"
            autocomplete="name"
            placeholder="Имя и фамилия"
            class="w-full bg-transparent text-[17px] font-bold outline-none [caret-color:#DDFF33] placeholder:text-faint"
            @keydown.enter="addByPhone"
          />
        </label>
        <button
          type="button"
          class="press mt-5 h-12 w-full rounded-full bg-ink text-[15px] font-bold text-paper disabled:opacity-40"
          :disabled="phoneDigits.length !== 9 || phoneName.trim().length < 2"
          @click="addByPhone"
        >
          Добавить
        </button>
      </div>
    </BottomSheet>

    <PinSheet
      :open="pinSheet"
      :hint="`Оплата вашей доли · ${money(draft.payNow)} UZS${merchant ? ' · ' + merchant.name : ''}`"
      @close="pinSheet = false"
      @confirm="createSplit"
    />
  </div>
</template>
