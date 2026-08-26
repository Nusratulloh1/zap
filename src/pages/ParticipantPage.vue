<script setup lang="ts">
// Дизайн 3b2: страница участника — «Ислам просит вашу долю», сумма 46px,
// сетка чипов «ВНЕСТИ СРАЗУ», хинт про ×2, CTA «Внести N» / «Позже».
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, peopleCount } from '@/lib/format'
import type { Split } from '@/entities/types'
import * as api from '@/api'
import { isRealApi } from '@/api'
import { useContactsStore } from '@/entities/stores/contacts'
import ConfettiBurst from '@/components/ConfettiBurst.vue'
import PinSheet from '@/components/PinSheet.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import AmountField from '@/components/AmountField.vue'
import AnimatedAmount from '@/components/AnimatedAmount.vue'
import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import organizerAvatar from '@/assets/brand/avatars/a12.png'

const route = useRoute()
const contacts = useContactsStore()

const split = ref<Split | null>(null)
const loading = ref(true)
const paid = ref(false)

// демо-переключатель: от лица какого участника смотрим
const viewAs = ref<string>('')

const pendingMembers = computed(
  () => split.value?.members.filter((m) => !m.isYou && m.status !== 'paid' && m.status !== 'debt') ?? [],
)
const otherMembers = computed(() => split.value?.members.filter((m) => !m.isYou) ?? [])
const me = computed(() => split.value?.members.find((m) => m.contactId === viewAs.value))
const myShare = computed(() => me.value?.amount ?? 0)
const amount = ref(0)

onMounted(async () => {
  await contacts.hydrate()
  split.value = await api.fetchSplitByCode(String(route.params.code))
  loading.value = false
  // реальный режим: зритель — участник, найденный по его номеру (isYou);
  // мок-демо: «переключение ролей» — первый ожидающий участник
  const first = isRealApi
    ? (split.value?.members.find((m) => m.isYou) ?? pendingMembers.value[0])
    : (pendingMembers.value[0] ?? otherMembers.value[0])
  if (first) {
    viewAs.value = first.contactId
    amount.value = first.amount
    if (split.value && first.status === 'waiting') api.markOpened(split.value.id, first.contactId)
  }
})

function switchTo(cid: string) {
  viewAs.value = cid
  const m = split.value?.members.find((x) => x.contactId === cid)
  amount.value = m?.amount ?? 0
  if (split.value && m?.status === 'waiting') api.markOpened(split.value.id, cid)
}

function nameOf(cid: string): string {
  const names = (split.value as unknown as { memberNames?: Record<string, string> } | null)?.memberNames
  if (names?.[cid]) return names[cid]!
  return contacts.byId(cid)?.name ?? '?'
}

const half = computed(() => Math.round(myShare.value / 2 / 1000) * 1000)

const customSheet = ref(false)
const customRaw = ref('')

function customCommit() {
  const v = Number(customRaw.value || '0')
  if (v > 0) amount.value = v
  customSheet.value = false
  customRaw.value = ''
}

const pinSheet = ref(false)
const paying = ref(false)

async function confirmPay() {
  pinSheet.value = false
  if (!split.value || !me.value || paying.value) return
  paying.value = true
  const updated = await api.payShare(split.value.id, me.value.contactId)
  if (updated) split.value = updated
  paid.value = true
}

function later() {
  toast('Хорошо, напомним вечером')
  // мок-напоминание чуть позже в этой же сессии
  setTimeout(() => toast('Напоминание: внесите долю ' + money(myShare.value)), 8000)
}

const alreadyPaid = computed(() => me.value && (me.value.status === 'paid' || me.value.status === 'debt'))
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <div class="flex items-center justify-between">
      <img :src="wordmark" alt="ZAP!" class="h-12 w-auto" />
      <!-- дев-переключатель «смотреть как» -->
      <div v-if="otherMembers.length > 1 && !paid" class="flex items-center gap-1 rounded-full bg-sand p-1">
        <button
          v-for="m in otherMembers"
          :key="m.contactId"
          type="button"
          class="relative hit-area-y rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors"
          :class="viewAs === m.contactId ? 'bg-ink text-paper' : 'text-muted'"
          @click="switchTo(m.contactId)"
        >
          {{ nameOf(m.contactId) }}
        </button>
      </div>
    </div>

    <template v-if="loading">
      <div class="mt-10 space-y-4">
        <div class="h-8 w-52 animate-pulse rounded-lg bg-sand" />
        <div class="h-14 w-64 animate-pulse rounded-lg bg-sand" />
        <div class="h-40 w-full animate-pulse rounded-inner bg-sand" />
      </div>
    </template>

    <!-- сплит не найден -->
    <template v-else-if="!split">
      <div class="flex flex-1 flex-col items-center justify-center text-center">
        <span class="text-[40px]">🤷</span>
        <p class="mt-3 text-[16px] font-bold">Сплит не найден или уже закрыт</p>
      </div>
    </template>

    <!-- оплачено -->
    <template v-else-if="paid || alreadyPaid">
      <div class="flex flex-1 flex-col items-center justify-center">
        <ConfettiBurst />
        <h1 class="mt-7 text-center text-[24px] font-extrabold">{{ paid ? 'Доля внесена!' : 'Ваша доля уже внесена' }}</h1>
        <p class="mt-2 text-center text-[13.5px] font-semibold text-muted">Кэшбэк ×2 придёт, когда сплит закроется</p>
        <p class="mt-6 text-[30px] font-extrabold tracking-[-0.02em]">{{ money(myShare) }}</p>
        <p class="mt-1 font-mono text-[11px] font-bold text-faint-2">UZS</p>
      </div>
    </template>

    <!-- запрос доли -->
    <template v-else>
      <div class="mt-[26px]">
        <div class="flex items-center gap-2.5">
          <img :src="organizerAvatar" alt="Ислам" class="h-[34px] w-[34px] rounded-full object-cover" />
          <span class="text-[13.5px] font-semibold text-muted">Ислам просит вашу долю</span>
        </div>
        <h1 class="mt-4 text-[26px] font-extrabold tracking-[-0.01em]">{{ split.title }}</h1>
        <p class="mt-[5px] text-[13.5px] font-semibold text-muted">
          Bellissimo · заказ #{{ split.bill?.orderNo ?? split.code }} · {{ peopleCount(split.members.length) }}
        </p>
        <div class="mt-[22px] flex items-baseline gap-2">
          <AnimatedAmount
            :digits="amount ? String(amount) : ''"
            :scale-steps="false"
            class="text-[46px] font-extrabold leading-none tracking-[-0.03em]"
          />
          <span class="font-mono text-[11px] font-bold text-faint-2">UZS · ВАША ДОЛЯ</span>
        </div>
      </div>

      <p class="mt-[30px] font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">ВНЕСТИ СРАЗУ</p>
      <div class="mt-3 grid grid-cols-3 gap-2.5">
        <button
          type="button"
          class="press flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-inner"
          :class="amount === myShare ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = myShare"
        >
          <span class="text-[15px] font-extrabold">{{ money(myShare) }}</span>
          <span class="text-[10.5px] font-bold text-muted">моя доля</span>
        </button>
        <button
          type="button"
          class="press flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-inner"
          :class="amount === half ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = half"
        >
          <span class="text-[15px] font-extrabold">{{ money(half) }}</span>
          <span class="text-[10.5px] font-bold text-muted">половина</span>
        </button>
        <button
          type="button"
          class="press flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-inner"
          :class="amount === myShare * 2 ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = myShare * 2"
        >
          <span class="text-[15px] font-extrabold">{{ money(myShare * 2) }}</span>
          <span class="text-[10.5px] font-bold text-muted">за двоих</span>
        </button>
        <button
          type="button"
          class="press flex h-[62px] items-center justify-center rounded-inner text-[15px] font-extrabold"
          :class="amount === 100000 ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = 100000"
        >
          100 000
        </button>
        <button
          type="button"
          class="press flex h-[62px] items-center justify-center rounded-inner text-[15px] font-extrabold"
          :class="amount === 250000 ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = 250000"
        >
          250 000
        </button>
        <button
          type="button"
          class="press flex h-[62px] items-center justify-center rounded-inner bg-sand text-[19px] font-bold text-faint-2"
          @click="customSheet = true"
        >
          ···
        </button>
      </div>

      <div class="mt-[18px] flex items-center gap-2">
        <span class="h-[9px] w-[9px] rounded-full border-2 border-on-lime bg-lime" />
        <span class="text-[12px] font-semibold text-muted">Внесёте всей группой — кэшбэк ×2 каждому</span>
      </div>

      <div class="flex-1" />

      <div class="flex flex-col gap-2.5">
        <button
          type="button"
          class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
          :disabled="amount <= 0"
          @click="isRealApi ? void confirmPay() : (pinSheet = true)"
        >
          Внести {{ money(amount) }}
        </button>
        <button type="button" class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink" @click="later">
          Позже · напомнить вечером
        </button>
      </div>
    </template>

    <PinSheet
      :open="pinSheet"
      any-pin
      :hint="`Оплата вашей доли · ${money(amount)} UZS · Bellissimo`"
      @close="pinSheet = false"
      @confirm="confirmPay"
    />

    <BottomSheet :open="customSheet" @close="customSheet = false">
      <div class="pb-4">
        <AmountField v-if="customSheet" v-model="customRaw" autofocus placeholder-zero display-class="text-[36px] leading-none" class="my-5" />
        <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">UZS</p>
        <button type="button" class="press mt-4 h-12 w-full rounded-full bg-ink text-[15px] font-bold text-paper" @click="customCommit">
          Готово
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
