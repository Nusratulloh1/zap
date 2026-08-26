<script setup lang="ts">
import { cn } from '@/lib/cn'

const props = defineProps<{
  variant?: 'lime' | 'ink' | 'stone' | 'sand'
  class?: string
}>()

const styles: Record<string, string> = {
  lime: 'bg-lime text-on-lime',
  ink: 'bg-ink text-paper',
  stone: 'bg-stone text-deep',
  sand: 'bg-sand-2 text-muted',
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        styles[props.variant ?? 'stone'],
        props.class,
      )
    "
  >
    <slot />
  </span>
</template>
