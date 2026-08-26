<script setup lang="ts">
import ZapAvatar from './ZapAvatar.vue'

const props = defineProps<{
  people: { name: string; color: string }[]
  size?: 'xs' | 'sm' | 'md'
  max?: number
}>()

const max = props.max ?? 4
</script>

<template>
  <div class="flex items-center">
    <div class="flex -space-x-2">
      <ZapAvatar
        v-for="(p, i) in props.people.slice(0, max)"
        :key="i"
        :name="p.name"
        :color="p.color"
        :size="props.size ?? 'sm'"
        ring
        class="bg-paper"
      />
    </div>
    <span
      v-if="props.people.length > max"
      class="-ml-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-paper ring-2 ring-paper"
    >
      +{{ props.people.length - max }}
    </span>
  </div>
</template>
