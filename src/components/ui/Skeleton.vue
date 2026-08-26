<script setup lang="ts">
import { cn } from '@/lib/cn'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('zap-skeleton animate-pulse rounded-2xl bg-stone/60', props.class)" />
</template>
