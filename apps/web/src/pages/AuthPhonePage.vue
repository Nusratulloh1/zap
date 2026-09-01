<script setup lang="ts">
// Дизайн 5b: белый фон, круг-назад, лаймовое подчёркивание номера, чекбокс, лаймовый CTA.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { useUserStore } from '@/entities/stores/user'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const user = useUserStore()

const digits = ref('')
const terms = ref(true)
const busy = ref(false)

const phoneInput = ref<HTMLInputElement | null>(null)

/** «90 123 42 21» из сырых цифр */
function mask(d: string): string {
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return parts.join(' ')
}

const masked = computed(() => mask(digits.value))
const valid = computed(() => digits.value.length === 9 && terms.value)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  digits.value = el.value.replace(/\D/g, '').slice(0, 9)
  el.value = mask(digits.value)
}

onMounted(() => {
  setTimeout(() => phoneInput.value?.focus({ preventScroll: true }), 120)
})

async function submit() {
  if (!valid.value || busy.value) return
  busy.value = true
  try {
    await user.startLogin(digits.value)
    router.push('/auth/code')
  } catch (e) {
    toast(e instanceof Error && e.message ? e.message : t('auth.sendFailed'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.push('/onboarding')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <h1 class="mt-6 text-[27px] font-extrabold tracking-[-0.01em]">{{ t('auth.phoneTitle') }}</h1>
    <p class="mt-1.5 text-[13.5px] font-semibold text-muted">{{ t('auth.phoneHint') }}</p>

    <label class="mt-[26px] flex items-center gap-3 border-b-2 border-lime pb-3">
      <span class="text-[26px] font-bold text-muted">+998</span>
      <input
        ref="phoneInput"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        enterkeyhint="done"
        placeholder="90 123 42 21"
        :value="masked"
        class="w-full bg-transparent text-[26px] font-extrabold tracking-[0.01em] text-ink outline-none [caret-color:#DDFF33] placeholder:text-faint"
        @input="onInput"
        @keydown.enter="submit"
      />
    </label>

    <label class="mt-4 flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="checkbox"
        :aria-checked="terms"
        class="relative hit-area flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-[12px] font-extrabold text-ink transition-colors"
        :class="terms ? 'bg-lime' : 'bg-stone'"
        @click="terms = !terms"
      >
        <span v-if="terms">✓</span>
      </button>
      <span class="text-[12px] font-semibold text-muted" @click="terms = !terms">{{ t('auth.terms') }}</span>
    </label>

    <div class="flex-1" />

    <!-- bg = фон страницы: невидимо в покое, но при подъёме над клавиатурой
         (iOS-оверлей) кнопка едет на сплошной плашке, не просвечивая контент -->
    <div class="kb-avoid bg-paper pt-2">
      <button
        type="button"
        class="press h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="!valid || busy"
        @click="submit"
      >
        {{ t('auth.getCode') }}
      </button>
    </div>
  </div>
</template>
