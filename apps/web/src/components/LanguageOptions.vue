<script setup lang="ts">
// Список языков — общий для дропдауна на лендинге и для шита в приложении.
// Названия остаются на своём языке (эндонимы), их не переводят.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n'
import FlagIcon from './FlagIcon.vue'

const props = withDefaults(defineProps<{ size?: 'compact' | 'roomy'; activeIndex?: number }>(), {
  size: 'compact',
  activeIndex: -1,
})
const emit = defineEmits<{ pick: [Locale, Event]; focusIndex: [number] }>()

const { locale } = useI18n()
const current = computed(() => locale.value as Locale)
</script>

<template>
  <button
    v-for="(l, i) in LOCALES"
    :key="l"
    type="button"
    role="option"
    :aria-selected="l === current"
    :data-active="l === current"
    :tabindex="props.activeIndex < 0 || i === props.activeIndex ? 0 : -1"
    class="press flex w-full items-center gap-3 text-left transition-colors"
    :class="[
      props.size === 'roomy'
        ? 'min-h-[58px] rounded-[16px] px-3'
        : 'h-11 rounded-[13px] px-2.5',
      l === current ? 'bg-lime/25' : 'hover:bg-black/[0.06]',
    ]"
    @click="emit('pick', l, $event)"
    @focus="emit('focusIndex', i)"
  >
    <FlagIcon :locale="l" :size="props.size === 'roomy' ? 26 : 21" />
    <span class="flex-1" :class="props.size === 'roomy' ? 'text-[16px] font-bold' : 'text-[14.5px] font-bold'">
      {{ LOCALE_NAMES[l] }}
    </span>
    <svg
      v-if="l === current"
      :width="props.size === 'roomy' ? 16 : 14"
      :height="props.size === 'roomy' ? 13 : 11"
      viewBox="0 0 14 11"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1.4 5.6 5 9.2 12.6 1.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
