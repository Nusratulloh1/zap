<script setup lang="ts">
// Страница участника /s/:code: гость-оплата (номер + OTP-lite, без регистрации заранее).
// После OTP участник становится залогиненным — success-экран с live-прогрессом,
// настройкой PIN и переходом на главную. Организатор — реальное имя из API.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, peopleCount } from '@/lib/format'
import { bus } from '@/lib/bus'
import type { Split } from '@zap/shared/types'
import * as api from '@/api'
import { isRealApi } from '@/api'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import { participantSuccessMoment } from '@/lib/installPrompt'
import ConfettiBurst from '@/components/ConfettiBurst.vue'
import PinSheet from '@/components/PinSheet.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import AmountField from '@/components/AmountField.vue'
import AnimatedAmount from '@/components/AnimatedAmount.vue'
import InvisibleDigits from '@/components/InvisibleDigits.vue'
import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import { useI18n } from 'vue-i18n'

const isDev = import.meta.env.DEV
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const contacts = useContactsStore()
const user = useUserStore()

const split = ref<Split | null>(null)
const loading = ref(true)
const paid = ref(false)

const r1000 = (n: number) => Math.round(n / 1000) * 1000

// доступ к доп-полям публичного вида (real API кладёт их в Split через каст)
type PublicExtras = {
  creatorName?: string
  paidTotal?: number
  paidCount?: number
  memberCount?: number
  yourCashback?: number | null
  memberInitials?: Record<string, string>
  memberNames?: Record<string, string>
}
const extras = computed(() => (split.value as unknown as PublicExtras | null) ?? {})
const creatorName = computed(() => extras.value.creatorName || t('participant.organizer'))
const paidTotal = computed(() => extras.value.paidTotal ?? 0)
const paidCount = computed(() => extras.value.paidCount ?? 0)
const memberCount = computed(() => extras.value.memberCount ?? split.value?.members.length ?? 0)
const yourCashback = computed(() => extras.value.yourCashback ?? 0)
const progress = computed(() => {
  const t = split.value?.total ?? 0
  return t > 0 ? Math.min(100, Math.round((paidTotal.value / t) * 100)) : 0
})
const isClosed = computed(() => split.value?.status === 'closed')

// демо-переключатель «смотреть как» (только dev)
const viewAs = ref<string>('')
const pendingMembers = computed(
  () => split.value?.members.filter((m) => !m.isYou && m.status !== 'paid' && m.status !== 'debt') ?? [],
)
const otherMembers = computed(() => split.value?.members.filter((m) => !m.isYou) ?? [])
const me = computed(() => split.value?.members.find((m) => m.contactId === viewAs.value))
const myShare = computed(() => me.value?.amount ?? 0)
const amount = ref(0)

async function load() {
  split.value = await api.fetchSplitByCode(String(route.params.code))
  loading.value = false
  const first = isRealApi
    ? (split.value?.members.find((m) => m.isYou) ?? pendingMembers.value[0])
    : (pendingMembers.value[0] ?? otherMembers.value[0])
  if (first) {
    viewAs.value = first.contactId
    amount.value = first.amount
    if (split.value && first.status === 'waiting') api.markOpened(split.value.id, first.contactId)
  }
}

onMounted(async () => {
  await contacts.hydrate()
  await load()
})

// live-прогресс: любое событие в комнате сплита → перезапрос публичного вида
const offTouch = bus.on('public-split:touch', () => {
  if (split.value) void api.fetchSplitByCode(String(route.params.code)).then((s) => { if (s) split.value = s })
})
onBeforeUnmount(() => offTouch())

function switchTo(cid: string) {
  viewAs.value = cid
  const m = split.value?.members.find((x) => x.contactId === cid)
  amount.value = m?.amount ?? 0
  if (split.value && m?.status === 'waiting') api.markOpened(split.value.id, cid)
}

function nameOf(cid: string): string {
  return extras.value.memberNames?.[cid] ?? contacts.byId(cid)?.name ?? '?'
}
function initialOf(cid: string): string {
  return (extras.value.memberInitials?.[cid] ?? nameOf(cid))[0]?.toUpperCase() ?? '?'
}

// ---- математика чипов: строго от доли участника ----
const remaining = computed(() => Math.max(0, (split.value?.total ?? 0) - paidTotal.value))
const half = computed(() => r1000(myShare.value / 2))
const double = computed(() => Math.min(myShare.value * 2, remaining.value))
const quickAmounts = computed(() => [100000, 250000].filter((q) => q < myShare.value))
const selectionLabel = computed(() =>
  amount.value === myShare.value ? t('participant.yourShare') : t('participant.toPayLabel'),
)

const customSheet = ref(false)
const customRaw = ref('')
function customCommit() {
  const v = Number(customRaw.value || '0')
  if (v > 0) amount.value = Math.min(v, remaining.value || v)
  customSheet.value = false
  customRaw.value = ''
}

const pinConfirmSheet = ref(false)
const paying = ref(false)

async function confirmPay() {
  pinConfirmSheet.value = false
  if (!split.value || !me.value || paying.value) return
  paying.value = true
  try {
    const updated = await api.payShare(split.value.id, me.value.contactId)
    if (updated) split.value = updated
    paid.value = true
    // eligible-момент для install-баннера (после первого успеха)
    participantSuccessMoment()
    // подтянуть свежий прогресс/кэшбэк
    void api.fetchSplitByCode(String(route.params.code)).then((s) => { if (s) split.value = s })
  } catch (e) {
    toast(e instanceof Error && e.message ? e.message : t('participant.payFailed'))
  } finally {
    paying.value = false
  }
}

function later() {
  toast(t('participant.laterToast'))
}

// ---- «Открыть ZAP!»: если нужен PIN — inline-шит, затем на главную ----
const pinSetupSheet = ref(false)
const pinSetupDigits = ref('')
const pinSaving = ref(false)

function openZap() {
  if (isRealApi && api.guestNeedsPin()) {
    pinSetupSheet.value = true
  } else {
    goHome()
  }
}
async function onPinSetup(v: string) {
  pinSetupDigits.value = v
  if (v.length === 4 && !pinSaving.value) {
    pinSaving.value = true
    try {
      await user.setPin(v)
    } catch {
      /* даже если не удалось — не блокируем вход */
    }
    pinSetupSheet.value = false
    goHome()
  }
}
function skipPin() {
  pinSetupSheet.value = false
  goHome()
}
async function goHome() {
  await user.hydrate().catch(() => undefined)
  router.push('/')
}

const alreadyPaid = computed(() => me.value && (me.value.status === 'paid' || me.value.status === 'debt'))
const showSuccess = computed(() => paid.value || alreadyPaid.value)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <div class="flex items-center justify-between">
      <img :src="wordmark" alt="ZAP!" class="h-12 w-auto" />
      <!-- дев-переключатель «смотреть как» — только в dev-сборке -->
      <div v-if="isDev && otherMembers.length > 1 && !showSuccess" class="flex items-center gap-1 rounded-full bg-sand p-1">
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
        <p class="mt-3 text-[16px] font-bold">{{ t('participant.notFound') }}</p>
      </div>
    </template>

    <!-- УСПЕХ: доля внесена + live-прогресс + вход -->
    <template v-else-if="showSuccess">
      <div class="flex flex-1 flex-col">
        <div class="mt-8 flex flex-col items-center">
          <ConfettiBurst />
          <h1 class="mt-6 text-center text-[24px] font-extrabold">{{ paid ? t('participant.paidNow') : t('participant.alreadyPaid') }}</h1>
          <p class="mt-1 text-[30px] font-extrabold tracking-[-0.02em]">{{ money(myShare) }}</p>
          <p class="mt-2 text-center text-[13.5px] font-semibold" :class="isClosed ? 'text-on-lime' : 'text-muted'">
            <template v-if="isClosed && yourCashback > 0">{{ t('participant.cashbackCredited', { amount: money(yourCashback) }) }}</template>
            <template v-else>{{ t('participant.paidText') }}</template>
          </p>
        </div>

        <!-- live-прогресс сплита -->
        <div class="mt-8 rounded-card bg-shell p-[18px]">
          <div class="flex items-baseline justify-between">
            <span class="text-[14px] font-extrabold">{{ isClosed ? t('participant.splitClosed') : t('participant.collecting') }}</span>
            <span class="text-[13px] font-bold text-muted">{{ t('participant.paidOfCount', { paid: paidCount, total: memberCount }) }}</span>
          </div>
          <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-sand">
            <div class="h-full rounded-full bg-lime transition-[width] duration-700 ease-out" :style="{ width: progress + '%' }" />
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span
              v-for="m in split.members"
              :key="m.contactId"
              class="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold"
              :class="m.status === 'paid' || m.status === 'debt' ? 'bg-ink text-lime' : 'bg-sand text-faint-2'"
              :title="nameOf(m.contactId)"
            >
              {{ m.status === 'paid' || m.status === 'debt' ? '✓' : initialOf(m.contactId) }}
            </span>
          </div>
        </div>

        <div class="flex-1" />

        <button
          type="button"
          class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime"
          @click="openZap"
        >
          {{ t('participant.openApp') }}
        </button>
      </div>
    </template>

    <!-- запрос доли -->
    <template v-else>
      <div class="mt-[26px]">
        <div class="flex items-center gap-2.5">
          <span class="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink text-[14px] font-extrabold text-lime">
            {{ creatorName[0]?.toUpperCase() }}
          </span>
          <span class="text-[13.5px] font-semibold text-muted">{{ t('participant.asks', { name: creatorName }) }}</span>
        </div>
        <h1 class="mt-4 text-[26px] font-extrabold tracking-[-0.01em]">{{ split.title }}</h1>
        <p class="mt-[5px] text-[13.5px] font-semibold text-muted">
          <template v-if="split.bill">{{ t('participant.orderNo', { no: split.bill.orderNo }) }}</template>{{ peopleCount(split.members.length) }}
        </p>
        <div class="mt-[22px] flex items-baseline gap-2">
          <AnimatedAmount
            :digits="amount ? String(amount) : ''"
            :scale-steps="false"
            class="text-[46px] font-extrabold leading-none tracking-[-0.03em]"
          />
          <span class="font-mono text-[11px] font-bold text-faint-2">{{ selectionLabel }}</span>
        </div>
      </div>

      <p class="mt-[30px] font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('participant.payNowLabel') }}</p>
      <div class="mt-3 grid grid-cols-3 gap-2.5">
        <button
          type="button"
          class="press flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-inner"
          :class="amount === myShare ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = myShare"
        >
          <span class="text-[15px] font-extrabold">{{ money(myShare) }}</span>
          <span class="text-[10.5px] font-bold text-muted">{{ t('participant.chipMine') }}</span>
        </button>
        <button
          type="button"
          class="press flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-inner"
          :class="amount === half ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = half"
        >
          <span class="text-[15px] font-extrabold">{{ money(half) }}</span>
          <span class="text-[10.5px] font-bold text-muted">{{ t('participant.chipHalf') }}</span>
        </button>
        <button
          v-if="double > myShare"
          type="button"
          class="press flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-inner"
          :class="amount === double ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = double"
        >
          <span class="text-[15px] font-extrabold">{{ money(double) }}</span>
          <span class="text-[10.5px] font-bold text-muted">{{ t('participant.chipTwo') }}</span>
        </button>
        <button
          v-for="q in quickAmounts"
          :key="q"
          type="button"
          class="press flex h-[62px] items-center justify-center rounded-inner text-[15px] font-extrabold"
          :class="amount === q ? 'border-2 border-lime' : 'bg-sand'"
          @click="amount = q"
        >
          {{ money(q) }}
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
        <span class="text-[12px] font-semibold text-muted">{{ t('participant.hint') }}</span>
      </div>

      <div class="flex-1" />

      <div class="flex flex-col gap-2.5">
        <button
          type="button"
          class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
          :disabled="amount <= 0"
          @click="isRealApi ? void confirmPay() : (pinConfirmSheet = true)"
        >
          {{ t('participant.pay', { amount: money(amount) }) }}
        </button>
        <button type="button" class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink" @click="later">
          {{ t('participant.later') }}
        </button>
      </div>
    </template>

    <!-- мок-режим: подтверждение PIN перед «оплатой» -->
    <PinSheet
      :open="pinConfirmSheet"
      any-pin
      :hint="t('participant.pinHint', { amount: money(amount) })"
      @close="pinConfirmSheet = false"
      @confirm="confirmPay"
    />

    <!-- inline: придумать PIN после первой оплаты -->
    <BottomSheet :open="pinSetupSheet" @close="skipPin">
      <div class="pb-4">
        <p class="text-center text-[16px] font-extrabold">{{ t('participant.setPinTitle') }}</p>
        <p class="mt-1 text-center text-[13px] font-semibold text-muted">{{ t('participant.setPinHint') }}</p>
        <div class="mt-5 flex justify-center">
          <InvisibleDigits :length="4" :model-value="pinSetupDigits" autofocus @update:model-value="onPinSetup">
            <div class="flex gap-2.5">
              <span
                v-for="i in 4"
                :key="i"
                class="flex h-12 w-11 items-center justify-center rounded-xl bg-sand text-[20px] font-extrabold"
              >
                {{ pinSetupDigits[i - 1] ? '•' : '' }}
              </span>
            </div>
          </InvisibleDigits>
        </div>
        <button type="button" class="press mt-5 h-12 w-full rounded-full bg-sand text-[15px] font-bold text-muted" @click="skipPin">
          {{ t('participant.later') }}
        </button>
      </div>
    </BottomSheet>

    <BottomSheet :open="customSheet" @close="customSheet = false">
      <div class="pb-4">
        <AmountField v-if="customSheet" v-model="customRaw" autofocus placeholder-zero display-class="text-[36px] leading-none" class="my-5" />
        <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">UZS</p>
        <button type="button" class="press mt-4 h-12 w-full rounded-full bg-ink text-[15px] font-bold text-paper" @click="customCommit">
          {{ t('common.done') }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
