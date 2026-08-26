<script setup lang="ts">
// Дизайн 3c: полноэкранное подтверждение PIN — белый фон, заголовок слева,
// контекстная строка оплаты, 4 точки 34px с лаймовым баром. Выезжает снизу.
import { onBeforeUnmount, ref, watch } from 'vue'
import { gsap, reducedMotion } from '@/lib/motion'
import { verifyPin } from '@/api'
import { error as hapticError, success as hapticSuccess } from '@/lib/haptics'
import { S } from '@/lib/strings'
import InvisibleDigits from './InvisibleDigits.vue'
import PinDots from './PinDots.vue'

const props = defineProps<{
  open: boolean
  title?: string
  /** контекст оплаты: «Оплата вашей доли · 400 000 UZS · Bellissimo» */
  hint?: string
  /** демо-режим: принимает любой PIN (для страницы участника) */
  anyPin?: boolean
}>()

const emit = defineEmits<{ close: []; confirm: [] }>()

const pin = ref('')
const shake = ref(false)
const busy = ref(false)
const wrong = ref(false)

const digitsRef = ref<InstanceType<typeof InvisibleDigits> | null>(null)
const dotsArea = ref<HTMLElement | null>(null)
const successCheck = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      pin.value = ''
      wrong.value = false
      busy.value = false
    }
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

watch(pin, async (v) => {
  if (v.length !== 4 || busy.value) return
  wrong.value = false
  busy.value = true
  const ok = props.anyPin ? true : await verifyPin(v)
  if (ok) {
    hapticSuccess()
    // точки схлопываются к центру и превращаются в галочку (150мс)
    if (!reducedMotion() && dotsArea.value && successCheck.value) {
      const dots = Array.from(dotsArea.value.querySelectorAll('.rounded-full')) as HTMLElement[]
      const mid = (dots.length - 1) / 2
      dots.forEach((d, i) => gsap.to(d, { x: (mid - i) * 56, scale: 0.2, opacity: 0, duration: 0.15, ease: 'power2.in' }))
      gsap.fromTo(successCheck.value, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, delay: 0.12, ease: 'back.out(2)' })
      setTimeout(() => emit('confirm'), 380)
    } else {
      emit('confirm')
    }
  } else {
    hapticError()
    wrong.value = true
    shake.value = true
    setTimeout(() => {
      shake.value = false
      pin.value = ''
      busy.value = false
      digitsRef.value?.focus()
    }, 400)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="props.open"
        role="dialog"
        aria-modal="true"
        class="fixed inset-0 z-50 mx-auto flex w-full max-w-app flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]"
      >
        <button
          type="button"
          aria-label="Отмена"
          class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[16px] font-semibold"
          @click="emit('close')"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m4.5 4.5 9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" /></svg>
        </button>

        <h2 class="mt-[22px] text-[27px] font-extrabold tracking-[-0.01em]">
          {{ props.title ?? S.pin.confirmTitle }}
        </h2>
        <p class="mt-1.5 text-[13.5px] font-semibold" :class="wrong ? 'text-danger' : 'text-muted'">
          {{ wrong ? S.pin.wrong : (props.hint ?? S.pin.confirmHint) }}
        </p>

        <div class="relative mt-7 w-fit">
          <InvisibleDigits ref="digitsRef" v-model="pin" :length="4" password autofocus>
            <div ref="dotsArea">
              <PinDots :length="4" :filled="pin.length" :shake="shake" :size="34" :gap="22" :bar-width="186" />
            </div>
          </InvisibleDigits>
          <span ref="successCheck" class="pointer-events-none absolute left-1/2 top-0 flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full bg-lime opacity-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
        </div>

        <div class="flex-1" />
      </div>
    </Transition>
  </Teleport>
</template>
