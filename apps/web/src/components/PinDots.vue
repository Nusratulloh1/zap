<script setup lang="ts">
// Точки PIN/кода в стиле дизайна: заполненные #111110, пустые #EFEDE7,
// плюс лаймовый прогресс-бар под ними.
const props = defineProps<{
  length: number
  filled: number
  shake?: boolean
  /** диаметр точки, px (26 — SMS-код, 34 — PIN) */
  size?: number
  /** зазор между точками, px */
  gap?: number
  /** ширина полного лаймового бара, px; 0 — не показывать */
  barWidth?: number
  /** ошибка: заполненные точки и бар краснеют */
  error?: boolean
}>()

const size = props.size ?? 34
const gap = props.gap ?? 22
</script>

<template>
  <div class="flex flex-col" :style="{ gap: '14px' }" :class="props.shake && 'shake'">
    <div class="flex" :style="{ gap: gap + 'px' }">
      <div
        v-for="i in props.length"
        :key="i"
        class="rounded-full transition-colors duration-150"
        :class="i <= props.filled && 'dot-pop'"
        :style="{
          width: size + 'px',
          height: size + 'px',
          background:
            i <= props.filled
              ? props.error
                ? 'rgb(var(--c-danger))'
                : 'rgb(var(--c-ink))'
              : 'rgb(var(--c-pebble-2))',
        }"
      />
    </div>
    <div
      v-if="props.barWidth"
      class="h-[3px] rounded-full transition-all duration-200"
      :class="props.error ? 'bg-danger' : 'bg-lime'"
      :style="{ width: (props.filled / props.length) * props.barWidth + 'px' }"
    />
  </div>
</template>
