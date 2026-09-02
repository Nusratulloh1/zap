<script setup lang="ts">
/*
  Пол — один вопрос при первом входе, чтобы подобрать аватар. Спрашиваем ровно
  один раз и только ради картинки: подставлять парня девушке — плохое первое
  впечатление. Ответ хранится локально, на сервер не уходит.
*/
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/BottomSheet.vue'
import { PERSONAS, setMyPersona } from '@/lib/personas'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

function pick(g: 'male' | 'female') {
  localStorage.setItem('zap:gender', g)
  if (!localStorage.getItem('zap:my-avatar')) setMyPersona(g === 'female' ? 1 : 0)
  window.dispatchEvent(new Event('zap:avatar'))
  emit('close')
}
</script>

<template>
  <BottomSheet :open="props.open" @close="emit('close')">
    <h2 class="text-[21px] font-extrabold tracking-[-0.01em]">{{ t('gender.title') }}</h2>
    <p class="mt-1 text-[13.5px] font-semibold text-muted">{{ t('gender.subtitle') }}</p>

    <div class="mt-4 flex gap-3">
      <button
        v-for="(g, i) in (['male', 'female'] as const)"
        :key="g"
        type="button"
        class="press flex flex-1 flex-col items-center gap-2.5 rounded-[22px] bg-shell py-[18px]"
        @click="pick(g)"
      >
        <img :src="PERSONAS[i]" alt="" class="h-[84px] w-[84px] rounded-full" />
        <span class="text-[15px] font-extrabold">{{ t(`gender.${g}`) }}</span>
      </button>
    </div>

    <button type="button" class="mx-auto block py-3.5 text-[13.5px] font-bold text-faint-2" @click="emit('close')">
      {{ t('gender.skip') }}
    </button>

    <div class="mb-1.5 rounded-2xl bg-lime px-3.5 py-2.5 text-center text-[12px] font-semibold text-on-lime">
      {{ t('gender.hint') }}
    </div>
  </BottomSheet>
</template>
