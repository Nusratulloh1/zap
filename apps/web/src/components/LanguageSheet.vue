<script setup lang="ts">
// Выбор языка из профиля. Список общий с LanguageSwitcher (LanguageOptions),
// поэтому строки с флагами выглядят одинаково везде.
//
// После выбора страница перезагружается: экран приходит целиком на новом
// языке, без промежуточного кадра со смесью надписей.
import BottomSheet from '@/components/BottomSheet.vue'
import LanguageOptions from '@/components/LanguageOptions.vue'
import { applyLocale, type Locale } from '@/lib/i18n'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/api'
import { reducedMotion } from '@/lib/motion'
import { tap } from '@/lib/haptics'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { locale, t } = useI18n()

async function pick(next: Locale) {
  tap()
  if (next === (locale.value as Locale)) {
    emit('close')
    return
  }
  if (!reducedMotion()) document.documentElement.classList.add('locale-swapping')
  applyLocale(next)
  // ошибка сети не откатывает выбор: он уже в localStorage и переживёт
  // перезагрузку, аккаунт догонит при следующем открытии
  await setLocale(next).catch(() => undefined)
  location.reload()
}
</script>

<template>
  <BottomSheet :open="props.open" @close="emit('close')">
    <div class="pb-2" role="listbox">
      <p class="mb-3 text-center text-[15px] font-extrabold">{{ t('profile.languageTitle') }}</p>
      <div class="flex flex-col gap-1">
        <LanguageOptions size="roomy" @pick="pick" />
      </div>
    </div>
  </BottomSheet>
</template>
