<script setup lang="ts">
import { cn } from '@/lib/cn'

const props = defineProps<{
  placeholder?: string
  class?: string
  readonly?: boolean
  inputmode?: 'text' | 'none'
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    :placeholder="props.placeholder"
    :readonly="props.readonly"
    :inputmode="props.inputmode"
    :class="
      cn(
        // 16px — меньше нельзя: iOS Safari зумит страницу при фокусе на мелком инпуте
        'h-12 w-full rounded-full bg-sand-2 px-5 font-sans text-[16px] font-semibold text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-ink/10 transition-shadow',
        props.class,
      )
    "
  />
</template>
