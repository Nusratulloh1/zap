<script setup lang="ts">
export interface StoryProgressPalette {
  done: string
  active: string
  track: string
}

const props = defineProps<{
  count: number
  index: number
  /** прогресс текущего сегмента 0..1 */
  progress: number
  palette: StoryProgressPalette
}>()

function fillOf(seg: number): { color: string; scale: number } {
  if (seg < props.index) return { color: props.palette.done, scale: 1 }
  if (seg === props.index) return { color: props.palette.active, scale: props.progress }
  return { color: props.palette.active, scale: 0 }
}
</script>

<template>
  <div class="flex gap-[6px]">
    <div
      v-for="i in props.count"
      :key="i"
      class="h-[3px] flex-1 overflow-hidden rounded-full"
      :style="{ backgroundColor: props.palette.track }"
    >
      <!-- scaleX вместо width — прогресс обновляется каждый кадр -->
      <div
        class="h-full w-full origin-left rounded-full"
        :style="{ backgroundColor: fillOf(i - 1).color, transform: `scaleX(${fillOf(i - 1).scale})` }"
      />
    </div>
  </div>
</template>
