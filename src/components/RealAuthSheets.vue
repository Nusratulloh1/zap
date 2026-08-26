<script setup lang="ts">
// Глобальные шиты реального API: подтверждение PIN перед денежной операцией,
// номер телефона гостя на странице участника, SMS-код (OTP-lite) при оплате доли.
import { onBeforeUnmount, ref } from 'vue'
import { bus } from '@/lib/bus'
import PinSheet from '@/components/PinSheet.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import InvisibleDigits from '@/components/InvisibleDigits.vue'

// --- PIN ---
const pinOpen = ref(false)
let pinCbs: { resolve: () => void; reject: () => void } | null = null

const offPin = bus.on('pin:request', (cbs) => {
  pinCbs = cbs
  pinOpen.value = true
})

// PinSheet сам проверяет PIN через api.verifyPin (реальный кладёт paymentToken)
function onPinConfirm() {
  pinOpen.value = false
  pinCbs?.resolve()
  pinCbs = null
}

function onPinClose() {
  pinOpen.value = false
  pinCbs?.reject()
  pinCbs = null
}

// --- номер гостя ---
const phoneOpen = ref(false)
const phoneDigits = ref('')
let phoneCbs: { resolve: (phone: string) => void; reject: () => void } | null = null

const offPhone = bus.on('guest-phone:request', (cbs) => {
  phoneCbs = cbs
  phoneDigits.value = ''
  phoneOpen.value = true
})

function submitPhone() {
  if (phoneDigits.value.length !== 9) return
  phoneOpen.value = false
  phoneCbs?.resolve('998' + phoneDigits.value)
  phoneCbs = null
}

function onPhoneClose() {
  phoneOpen.value = false
  phoneCbs?.reject()
  phoneCbs = null
}

// --- SMS-код гостя ---
const otpOpen = ref(false)
const otpDigits = ref('')
let otpCbs: { resolve: (code: string) => void; reject: () => void } | null = null

const offOtp = bus.on('guest-otp:request', (cbs) => {
  otpCbs = cbs
  otpDigits.value = ''
  otpOpen.value = true
})

function onOtpInput(v: string) {
  otpDigits.value = v
  if (v.length === 6) {
    otpOpen.value = false
    otpCbs?.resolve(v)
    otpCbs = null
  }
}

function onOtpClose() {
  otpOpen.value = false
  otpCbs?.reject()
  otpCbs = null
}

onBeforeUnmount(() => {
  offPin()
  offPhone()
  offOtp()
})
</script>

<template>
  <PinSheet :open="pinOpen" hint="Подтвердите операцию" @close="onPinClose" @confirm="onPinConfirm" />

  <BottomSheet :open="phoneOpen" @close="onPhoneClose">
    <div class="pb-4">
      <p class="text-center text-[16px] font-extrabold">Ваш номер</p>
      <p class="mt-1 text-center text-[13px] font-semibold text-muted">Чтобы показать вашу долю в сплите</p>
      <label class="mx-auto mt-4 flex max-w-[280px] items-center gap-2 border-b-2 border-lime pb-2">
        <span class="text-[18px] font-bold text-muted">+998</span>
        <input
          type="tel"
          inputmode="tel"
          class="w-full bg-transparent text-[18px] font-extrabold text-ink outline-none [caret-color:#DDFF33]"
          placeholder="90 123 42 21"
          @input="(e) => (phoneDigits = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 9))"
        />
      </label>
      <button
        type="button"
        class="press mt-5 h-12 w-full rounded-full bg-lime text-[15px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="phoneDigits.length !== 9"
        @click="submitPhone"
      >
        Продолжить
      </button>
    </div>
  </BottomSheet>

  <BottomSheet :open="otpOpen" @close="onOtpClose">
    <div class="pb-4">
      <p class="text-center text-[16px] font-extrabold">Код из SMS</p>
      <p class="mt-1 text-center text-[13px] font-semibold text-muted">Отправили 6-значный код для подтверждения</p>
      <div class="mt-4 flex justify-center">
        <InvisibleDigits :length="6" :model-value="otpDigits" one-time-code autofocus @update:model-value="onOtpInput">
          <div class="flex gap-2">
            <span
              v-for="i in 6"
              :key="i"
              class="flex h-11 w-9 items-center justify-center rounded-xl bg-sand text-[18px] font-extrabold"
            >
              {{ otpDigits[i - 1] ?? '' }}
            </span>
          </div>
        </InvisibleDigits>
      </div>
    </div>
  </BottomSheet>
</template>
