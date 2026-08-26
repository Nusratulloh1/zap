<script setup lang="ts">
// Дизайн 3k: «Покажите QR друзьям» — QR в мягком боксе, ссылка моно,
// стек аватаров со статусом, CTA «Отправить SMS» / «Скопировать ссылку».
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, equalShares } from '@/lib/format'
import { useSplitsStore } from '@/entities/stores/splits'
import { useContactsStore } from '@/entities/stores/contacts'
import ZapAvatar from '@/components/ZapAvatar.vue'
import QrCode from '@/components/QrCode.vue'

const route = useRoute()
const router = useRouter()
const splits = useSplitsStore()
const contacts = useContactsStore()

const id = computed(() => String(route.params.id))
const split = computed(() => splits.byId(id.value))
const merchant = computed(() => contacts.merchantById(split.value?.merchantId))

onMounted(() => {
  void splits.hydrate()
  void contacts.hydrate()
})

const link = computed(() => `zap.uz/s/${split.value?.code ?? ''}`)

const perPerson = computed(() => {
  if (!split.value) return 0
  return equalShares(split.value.total, split.value.members.length)[0] ?? 0
})

const waitingNames = computed(() => {
  if (!split.value) return ''
  const gen: Record<string, string> = { Али: 'Али', Бек: 'Бека', Азиз: 'Азиза', Тимур: 'Тимура', Мадина: 'Мадину' }
  return split.value.members
    .filter((m) => m.status === 'waiting' || m.status === 'opened')
    .map((m) => gen[contacts.byId(m.contactId)?.name ?? '?'] ?? contacts.byId(m.contactId)?.name ?? '?')
    .join(' и ')
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText('https://' + link.value)
    toast.success('Ссылка скопирована')
  } catch {
    toast('Ссылка скопирована')
  }
}

async function shareSms() {
  const url = 'https://' + link.value
  if (navigator.share) {
    try {
      await navigator.share({ title: 'ZAP! Сплит', text: `${split.value?.title ?? 'Сплит'} — внесите свою долю`, url })
      toast.success('Ссылка отправлена')
    } catch {
      /* пользователь закрыл шэр */
    }
  } else {
    await copyLink()
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      aria-label="Назад"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.push(`/split/${id}`)"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <template v-if="split">
      <h1 class="mt-[22px] text-[25px] font-extrabold tracking-[-0.01em]">Покажите QR друзьям</h1>
      <p class="mt-[5px] text-[13.5px] font-semibold text-muted">
        {{ merchant?.name ?? split.title }}<template v-if="split.bill"> · #{{ split.bill.orderNo }}</template> · по {{ money(perPerson) }} с человека
      </p>

      <div class="mt-[22px] flex justify-center">
        <div class="flex h-[214px] w-[214px] items-center justify-center rounded-[26px] bg-shell p-4">
          <QrCode :value="'https://' + link" :size="182" light="#F7F5F0" />
        </div>
      </div>
      <p class="mt-3 text-center font-mono text-[11px] font-bold tracking-[0.1em] text-faint-2">{{ link }}</p>

      <div class="mt-5 flex items-center gap-2.5">
        <div class="flex">
          <ZapAvatar
            v-for="(m, i) in split.members"
            :key="m.contactId"
            :name="contacts.byId(m.contactId)?.name ?? 'Вы'"
            :color="contacts.byId(m.contactId)?.color ?? '#111110'"
            :contact-id="m.contactId"
            class="h-[34px] w-[34px] border-2 border-paper"
            :class="i > 0 ? '-ml-2.5' : ''"
            size="xs"
          />
        </div>
        <p class="flex-1 text-[12.5px] font-semibold text-muted">
          <template v-if="waitingNames">Вы оплатили · ждём {{ waitingNames }}</template>
          <template v-else>Все доли собраны</template>
        </p>
      </div>

      <div class="flex-1" />

      <div class="flex flex-col gap-2.5">
        <button type="button" class="press flex h-14 items-center justify-center gap-2.5 rounded-full bg-lime text-[16px] font-extrabold text-on-lime" @click="shareSms">
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="12" rx="3" stroke="#111110" stroke-width="1.8" />
            <path d="M2.5 6.5L10 11L17.5 6.5" stroke="#111110" stroke-width="1.8" stroke-linejoin="round" />
          </svg>
          Отправить SMS со ссылкой
        </button>
        <button type="button" class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink" @click="copyLink">
          Скопировать ссылку
        </button>
        <button type="button" class="press py-1 text-center text-[13px] font-bold text-muted" @click="router.push(`/split/${id}`)">
          К статусу сплита ›
        </button>
      </div>
    </template>
  </div>
</template>
