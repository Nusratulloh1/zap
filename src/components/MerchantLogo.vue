<script setup lang="ts">
import { cn } from '@/lib/cn'

const props = defineProps<{
  letter: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  class?: string
}>()

const sizes = {
  sm: 'h-9 w-9 text-[15px] rounded-xl',
  md: 'h-11 w-11 text-[17px] rounded-2xl',
  lg: 'h-14 w-14 text-[22px] rounded-2xl',
}
</script>

<template>
  <div
    :class="cn('flex shrink-0 items-center justify-center font-sans font-extrabold text-paper', sizes[props.size ?? 'md'], props.class)"
    :style="{ backgroundColor: props.color }"
  >
    {{ props.letter }}
  </div>
</template>
