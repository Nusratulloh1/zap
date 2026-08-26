<script setup lang="ts">
// Дизайн 3a (точный): лаймовый платёжный пад — скан-иконка + аватар «И»,
// сумма JetBrains Mono 700 с автоужатием, чип UZS, экранная клавиатура,
// «Оплатить» (белая) / «Сплит» (чёрная), плавающий нав-пилл.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money } from '@/lib/format'
import { gsap, reducedMotion } from '@/lib/motion'
import { useDraftStore } from '@/entities/stores/draft'
import { payAlone } from '@/api'
import AnimatedAmount from '@/components/AnimatedAmount.vue'
import PayPad from '@/components/PayPad.vue'
import PinSheet from '@/components/PinSheet.vue'

const router = useRouter()
const draft = useDraftStore()

// черновик суммы живёт до конца сессии: набрал → ушёл → вернулся с пилл-нава
const DRAFT_KEY = 'zap:amount-draft'
const savedDraft = (() => {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
})()

const raw = ref(savedDraft)

watch(raw, (v) => {
  try {
    if (v) sessionStorage.setItem(DRAFT_KEY, v)
    else sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* noop */
  }
})
const amount = computed(() => Number(raw.value || '0'))
const paySheet = ref(false)
const paying = ref(false)

function onKey(k: string) {
  if (k === '000') {
    if (!raw.value) return
    raw.value = (raw.value + '000').slice(0, 9)
    return
  }
  if (raw.value.length >= 9) return
  raw.value = (raw.value + k).replace(/^0+(?=\d)/, '')
}

function onBackspace() {
  raw.value = raw.value.slice(0, -1)
}

// CTA появляются пружинкой при первом вводе
const actions = ref<HTMLElement | null>(null)
watch(
  () => amount.value > 0,
  (enabled) => {
    if (enabled && actions.value && !reducedMotion()) {
      gsap.fromTo(
        actions.value.children,
        { scale: 0.92 },
        { scale: 1, duration: 0.45, ease: 'back.out(1.8)', stagger: 0.04, clearProps: 'transform' },
      )
    }
  },
)

function toSplit() {
  if (amount.value <= 0) return
  draft.startManual(amount.value)
  // черновик сдан — при следующем открытии пад чистый (raw не трогаем:
  // компонент и так уходит, а его сброс перезаписал бы черновик через watch)
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* noop */
  }
  router.push('/split/members')
}

async function confirmPay() {
  paySheet.value = false
  if (paying.value) return
  paying.value = true
  await payAlone(amount.value)
  toast.success('Оплачено · ' + money(amount.value))
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* noop */
  }
  router.push('/')
}
</script>

<template>
  <!-- pb с запасом под плавающий нав-пилл (дизайн 3a) -->
  <div class="theme-fixed flex min-h-dvh flex-col bg-lime px-5 pb-[calc(env(safe-area-inset-bottom)+86px)] pt-[calc(env(safe-area-inset-top)+20px)] text-ink">
    <!-- шапка -->
    <div class="flex items-center justify-between">
      <button
        type="button"
        aria-label="Сканер"
        class="press relative hit-area flex h-10 w-10 items-center justify-center"
        @click="router.push('/split/scan')"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M3 8V5C3 3.9 3.9 3 5 3H8" stroke="#111110" stroke-width="2.4" stroke-linecap="round" />
          <path d="M16 3H19C20.1 3 21 3.9 21 5V8" stroke="#111110" stroke-width="2.4" stroke-linecap="round" />
          <path d="M21 16V19C21 20.1 20.1 21 19 21H16" stroke="#111110" stroke-width="2.4" stroke-linecap="round" />
          <path d="M8 21H5C3.9 21 3 20.1 3 19V16" stroke="#111110" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Профиль"
        class="press flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[15px] font-extrabold text-lime"
        @click="router.push('/profile')"
      >
        И
      </button>
    </div>

    <!-- сумма -->
    <div class="flex flex-1 flex-col items-center justify-center gap-4">
      <!-- шрифт всегда 64px; ужатие делает scale контейнера (см. AnimatedAmount) -->
      <AnimatedAmount
        :digits="raw"
        placeholder-zero
        class="w-full font-mono text-[64px] font-bold leading-none tracking-[-0.02em]"
      />
      <button type="button" class="press flex h-9 items-center gap-1.5 rounded-full bg-ink/[0.08] px-4 text-[13px] font-extrabold">
        UZS <span class="text-[10px] opacity-60">⌄</span>
      </button>
    </div>

    <!-- клавиатура -->
    <PayPad @key="onKey" @backspace="onBackspace" />

    <!-- действия -->
    <div ref="actions" class="mt-3 flex gap-2.5">
      <button
        type="button"
        class="press h-14 flex-1 rounded-full bg-white text-[16px] font-bold text-ink transition-opacity disabled:opacity-40"
        :disabled="amount <= 0"
        @click="paySheet = true"
      >
        Оплатить
      </button>
      <button
        type="button"
        class="press h-14 flex-[1.4] rounded-full bg-ink text-[16px] font-extrabold text-white transition-opacity disabled:opacity-40"
        :disabled="amount <= 0"
        @click="toSplit"
      >
        Сплит
      </button>
    </div>

    <!-- нав-пилл общий (TabBar в App-шелле): живёт вне переходов роутов,
         активная точка-раскладка показывается им же -->
    <PinSheet :open="paySheet" :hint="`Оплата · ${money(amount)} UZS`" @close="paySheet = false" @confirm="confirmPay" />
  </div>
</template>
