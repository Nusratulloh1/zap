<script setup lang="ts">
// Дизайн 5c: белый фон, 6 точек кода с лаймовым прогресс-баром,
// «Не пришло? Отправить ещё раз», секция про PIN; ввод — нативная клавиатура.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { S } from '@/lib/strings'
import { phone } from '@/lib/format'
import { error as hapticError, success as hapticSuccess } from '@/lib/haptics'
import { useUserStore } from '@/entities/stores/user'
import InvisibleDigits from '@/components/InvisibleDigits.vue'
import PinDots from '@/components/PinDots.vue'

const router = useRouter()
const user = useUserStore()

type Step = 'code' | 'pin1' | 'pin2'
const step = ref<Step>('code')

const code = ref('')
const pin1 = ref('')
const pin2 = ref('')
const busy = ref(false)
const shake = ref(false)
const mismatch = ref(false)

// таймер повторной отправки
const seconds = ref(24)
let timer = 0

function startTimer() {
  seconds.value = 24
  clearInterval(timer)
  timer = window.setInterval(() => {
    if (seconds.value > 0) seconds.value -= 1
    else clearInterval(timer)
  }, 1000)
}

onMounted(startTimer)
onBeforeUnmount(() => clearInterval(timer))

function resend() {
  if (seconds.value > 0) return
  startTimer()
  toast(S.auth.codeResent)
}

const timerLabel = computed(() => `0:${seconds.value.toString().padStart(2, '0')}`)

watch(code, async (v) => {
  if (v.length !== 6 || busy.value) return
  busy.value = true
  await user.verifyCode(v)
  busy.value = false
  step.value = 'pin1'
})

watch(pin1, (v) => {
  if (v.length !== 4) return
  mismatch.value = false
  setTimeout(() => (step.value = 'pin2'), 250)
})

watch(pin2, async (v) => {
  if (v.length !== 4 || busy.value) return
  if (v === pin1.value) {
    busy.value = true
    hapticSuccess()
    await user.setPin(pin1.value)
    router.replace('/')
  } else {
    hapticError()
    mismatch.value = true
    shake.value = true
    setTimeout(() => {
      shake.value = false
      pin1.value = ''
      pin2.value = ''
      step.value = 'pin1'
    }, 450)
  }
})
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      aria-label="Назад"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.push('/auth/phone')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <div class="relative flex-1 overflow-hidden">
      <Transition name="story">
        <!-- SMS-код -->
        <div v-if="step === 'code'" class="absolute inset-x-0 top-0">
          <h1 class="mt-6 text-[27px] font-extrabold tracking-[-0.01em]">{{ S.auth.codeTitle }}</h1>
          <p class="mt-1.5 text-[13.5px] font-semibold text-muted">
            {{ S.auth.codeHint }} {{ phone(user.session.phone ?? '901234221') }}
          </p>

          <InvisibleDigits v-model="code" :length="6" one-time-code autofocus class="mt-[26px] w-fit">
            <PinDots :length="6" :filled="code.length" :size="26" :gap="14" :bar-width="264" />
          </InvisibleDigits>

          <p class="mt-4 text-[13px] font-semibold text-muted">
            {{ S.auth.notArrived }}
            <button
              type="button"
              class="font-bold text-ink transition-opacity active:opacity-60"
              @click="resend"
            >
              <template v-if="seconds > 0">{{ S.auth.resend }} · {{ timerLabel }}</template>
              <template v-else><span class="underline underline-offset-2">{{ S.auth.resend }}</span></template>
            </button>
          </p>

          <div class="mt-[26px] border-t border-sand-2 pt-5">
            <p class="text-[15.5px] font-extrabold">{{ S.auth.pinTitle }}</p>
            <p class="mt-1 text-[13px] font-semibold text-muted">{{ S.auth.pinSectionHint }}</p>
          </div>
        </div>

        <!-- Создание PIN -->
        <div v-else :key="step" class="absolute inset-x-0 top-0">
          <h1 class="mt-6 text-[27px] font-extrabold tracking-[-0.01em]">
            {{ step === 'pin1' ? S.auth.pinCreate : S.auth.pinRepeat }}
          </h1>
          <p class="mt-1.5 text-[13.5px] font-semibold" :class="mismatch ? 'text-danger' : 'text-muted'">
            {{ mismatch ? S.auth.pinMismatch : S.auth.pinSectionHint }}
          </p>
          <InvisibleDigits
            v-if="step === 'pin1'"
            v-model="pin1"
            :length="4"
            password
            autofocus
            class="mt-7 w-fit"
          >
            <PinDots :length="4" :filled="pin1.length" :shake="shake" :size="34" :gap="22" :bar-width="186" />
          </InvisibleDigits>
          <InvisibleDigits v-else v-model="pin2" :length="4" password autofocus class="mt-7 w-fit">
            <PinDots :length="4" :filled="pin2.length" :shake="shake" :size="34" :gap="22" :bar-width="186" />
          </InvisibleDigits>
        </div>
      </Transition>
    </div>
  </div>
</template>
