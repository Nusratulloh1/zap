<script setup lang="ts">
// Дизайн 5g: «Вам должны» — сумма 44px, чипы вкладок, должники с фото и
// кнопкой «Напомнить» (или заметкой), пояснение про автозакрытие, «Напомнить всем».
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, isSameDay } from '@/lib/format'
import { useDebtsStore } from '@/entities/stores/debts'
import { useContactsStore } from '@/entities/stores/contacts'
import ZapAvatar from '@/components/ZapAvatar.vue'
import AnimatedList from '@/components/AnimatedList.vue'
import CountUp from '@/components/CountUp.vue'

const router = useRouter()
const debts = useDebtsStore()
const contacts = useContactsStore()

onMounted(() => {
  void debts.hydrate()
  void contacts.hydrate()
})

const tab = ref<'owedToMe' | 'iOwe'>('owedToMe')

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const WEEKDAYS_LC = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

function debtDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (isSameDay(d, now)) return 'сегодня'
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return 'вчера'
  if ((now.getTime() - d.getTime()) / 86400000 < 7) return WEEKDAYS_LC[d.getDay()]!
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

// кулдаун кнопки «Напомнить» — 30 секунд
const cooldowns = ref<Record<string, number>>({})

function isCooling(id: string): boolean {
  return (cooldowns.value[id] ?? 0) > Date.now()
}

async function remind(debtId: string) {
  cooldowns.value = { ...cooldowns.value, [debtId]: Date.now() + 30000 }
  setTimeout(() => {
    cooldowns.value = { ...cooldowns.value }
  }, 30500)
  await debts.remind(debtId)
  toast.success('Напоминание отправлено')
}

async function remindAll() {
  const till = Date.now() + 30000
  const next: Record<string, number> = {}
  for (const d of debts.openDebts) next[d.id] = till
  cooldowns.value = next
  setTimeout(() => {
    cooldowns.value = { ...cooldowns.value }
  }, 30500)
  await debts.remindAll()
  debts.openDebts.forEach((d, i) => {
    const name = contacts.byId(d.contactId)?.name ?? '?'
    setTimeout(() => toast.success('Напомнили: ' + name), 250 * i)
  })
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      aria-label="Назад"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.push('/')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <h1 class="mt-6 text-[27px] font-extrabold tracking-[-0.01em]">Вам должны</h1>
    <div class="mt-3 flex items-baseline gap-2">
      <CountUp :value="debts.totalOwedToMe" :duration="800" class="text-[44px] font-extrabold leading-none tracking-[-0.03em]" />
      <span class="font-mono text-[11px] font-bold text-faint-2">UZS · {{ debts.debtorIds.length }} ЧЕЛОВЕКА</span>
    </div>

    <div class="mt-5 flex gap-2">
      <button
        type="button"
        class="press flex h-[38px] items-center rounded-full px-4 text-[13px] transition-colors"
        :class="tab === 'owedToMe' ? 'bg-lime font-extrabold text-on-lime' : 'bg-sand font-bold text-slate'"
        @click="tab = 'owedToMe'"
      >
        Вам должны
      </button>
      <button
        type="button"
        class="press flex h-[38px] items-center rounded-full px-4 text-[13px] transition-colors"
        :class="tab === 'iOwe' ? 'bg-lime font-extrabold text-on-lime' : 'bg-sand font-bold text-slate'"
        @click="tab = 'iOwe'"
      >
        Вы должны · 0
      </button>
    </div>

    <Transition name="listswap" mode="out-in">
    <div v-if="tab === 'owedToMe'" key="owed" class="flex flex-1 flex-col">
      <div class="mt-[22px]">
        <AnimatedList appear class="flex flex-col">
          <div
            v-for="(d, i) in debts.openDebts"
            :key="d.id"
            class="flex min-h-[74px] items-center gap-3.5"
            :class="i < debts.openDebts.length - 1 && 'border-b border-sand-2'"
            :style="{ '--i': i }"
          >
            <ZapAvatar
              :name="contacts.byId(d.contactId)?.name ?? '?'"
              :color="contacts.byId(d.contactId)?.color ?? '#8A887E'"
              :contact-id="d.contactId"
              class="h-12 w-12"
              size="md"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[16px] font-bold">{{ contacts.byId(d.contactId)?.name }}</span>
              <span class="truncate text-[12.5px] font-semibold text-faint">{{ d.reason }} · {{ debtDate(d.createdAt) }}</span>
            </div>
            <div class="flex flex-col items-end gap-[5px]">
              <span class="text-[16px] font-extrabold">{{ money(d.amount) }}</span>
              <span
                v-if="d.note"
                class="flex h-7 items-center rounded-full bg-sand px-[11px] text-[11.5px] font-bold text-muted"
              >
                {{ d.note[0]?.toUpperCase() + d.note.slice(1) }}
              </span>
              <button
                v-else
                type="button"
                class="press flex h-7 items-center rounded-full px-[11px] text-[11.5px] font-bold transition-colors"
                :class="['remind-chip', isCooling(d.id) ? 'bg-sand text-muted' : 'bg-ink text-lime']"
                :disabled="isCooling(d.id)"
                @click="remind(d.id)"
              >
                {{ isCooling(d.id) ? 'Отправлено' : 'Напомнить' }}
              </button>
            </div>
          </div>
        </AnimatedList>
        <p v-if="!debts.openDebts.length" class="py-8 text-center text-[13px] font-semibold text-muted">Долгов нет — красота</p>
      </div>

      <div class="mt-5 border-t border-sand-2 pt-4">
        <p class="text-[12.5px] font-semibold leading-[1.45] text-muted">
          Долг закрывается автоматически, когда человек вносит сумму в ZAP! — вы получите пуш и кэшбэк за сплит.
        </p>
      </div>

      <div class="flex-1" />

      <button
        v-if="debts.openDebts.length"
        type="button"
        class="press mt-5 h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime"
        @click="remindAll"
      >
        Напомнить всем
      </button>
    </div>

    <div v-else key="iowe" class="flex flex-1 flex-col items-center justify-center text-center">
      <span class="text-[32px]">🎉</span>
      <p class="mt-2 text-[14px] font-bold text-muted">Долгов нет — красота</p>
    </div>
    </Transition>
  </div>
</template>
