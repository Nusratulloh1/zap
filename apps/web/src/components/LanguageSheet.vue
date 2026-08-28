<script setup lang="ts">
// Выбор языка интерфейса. Переключение мгновенное — без перезагрузки:
// меняем локаль i18n, сохраняем локально и шлём на аккаунт, чтобы язык
// следовал за пользователем между устройствами.
import { computed } from 'vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { LOCALES, LOCALE_NAMES, applyLocale, type Locale } from '@/lib/i18n'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/api'
import { tap } from '@/lib/haptics'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { locale, t } = useI18n()
const current = computed(() => locale.value as Locale)

async function pick(next: Locale) {
  tap()
  if (next !== current.value) {
    applyLocale(next)
    // на бэкенд отправляем «в фоне»: язык уже переключился, и ошибка сети
    // не должна откатывать выбор — локальное сохранение уже произошло
    void setLocale(next).catch(() => undefined)
  }
  emit('close')
}
</script>

<template>
  <BottomSheet :open="props.open" @close="emit('close')">
    <div class="pb-2">
      <p class="mb-3 text-center text-[15px] font-extrabold">{{ t('profile.languageTitle') }}</p>
      <div class="flex flex-col">
        <button
          v-for="l in LOCALES"
          :key="l"
          type="button"
          class="flex min-h-[56px] items-center border-b border-sand-2 text-left transition-colors last:border-0 active:bg-sand"
          @click="pick(l)"
        >
          <span class="flex-1 text-[16px] font-bold">{{ LOCALE_NAMES[l] }}</span>
          <span
            v-if="l === current"
            class="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-[12px] font-black text-on-lime"
            aria-hidden="true"
          >
            ✓
          </span>
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
