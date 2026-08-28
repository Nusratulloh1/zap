<script setup lang="ts">
import { computed } from 'vue'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'

const props = defineProps<{
  amount: number
  class?: string
  placeholderZero?: boolean
  /** дизайн 3a рисует сумму в Manrope — моно можно отключить */
  mono?: boolean
}>()

// Разбиваем на символы, чтобы новые цифры «въезжали» снизу
const chars = computed(() => money(props.amount).split(''))
const dim = computed(() => props.placeholderZero && props.amount === 0)
</script>

<template>
  <div :class="cn('flex items-baseline font-bold tabular-nums', props.mono !== false && 'font-mono', dim && 'text-faint', props.class)">
    <TransitionGroup name="digit">
      <span v-for="(ch, i) in chars" :key="`${i}-${ch}`" class="inline-block whitespace-pre">{{ ch }}</span>
    </TransitionGroup>
  </div>
</template>
