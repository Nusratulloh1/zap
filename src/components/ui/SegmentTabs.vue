<script setup lang="ts">
import { tap } from '@/lib/haptics'

const props = defineProps<{
  options: { value: string; label: string }[]
}>()

const model = defineModel<string>({ required: true })

function pick(v: string) {
  model.value = v
  tap()
}
</script>

<template>
  <div class="flex rounded-full bg-stone/70 p-1">
    <button
      v-for="o in props.options"
      :key="o.value"
      type="button"
      class="h-9 flex-1 rounded-full text-[13px] font-bold transition-all duration-200 ease-zap"
      :class="model === o.value ? 'bg-ink text-paper shadow-sm' : 'text-deep'"
      @click="pick(o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
