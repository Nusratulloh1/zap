<script setup lang="ts">
/*
  Выбор персоны — сетка 24 аватаров, как в приложении. Тап применяет сразу:
  кнопка «Сохранить» не нужна, результат виден за шитом.
*/
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/BottomSheet.vue'
import { PERSONAS, setMyPersona } from '@/lib/personas'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const current = ref(Number(localStorage.getItem('zap:my-avatar') ?? 0))

function pick(i: number) {
  current.value = i
  setMyPersona(i)
  // перерисовываем места, где аватар уже нарисован (шапки, профиль)
  window.dispatchEvent(new Event('zap:avatar'))
  emit('close')
}
</script>

<template>
  <BottomSheet :open="props.open" @close="emit('close')">
    <h2 class="text-[19px] font-extrabold tracking-[-0.01em]">{{ t('profile.avatarTitle') }}</h2>
    <div class="mt-3.5 flex max-h-[440px] flex-wrap justify-center gap-3 overflow-y-auto pb-2">
      <button
        v-for="(src, i) in PERSONAS"
        :key="i"
        type="button"
        class="press relative"
        @click="pick(i)"
      >
        <img
          :src="src"
          alt=""
          class="h-16 w-16 rounded-full ring-[3px]"
          :class="i === current ? 'ring-lime' : 'ring-transparent'"
        />
        <span
          v-if="i === current"
          class="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-paper bg-lime text-[12px] font-extrabold text-on-lime"
          >✓</span
        >
      </button>
    </div>
  </BottomSheet>
</template>
