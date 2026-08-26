<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <SwitchRoot
    v-model="model"
    class="relative h-[30px] w-[52px] shrink-0 cursor-pointer rounded-full bg-stone transition-colors duration-200 data-[state=checked]:bg-ink"
  >
    <SwitchThumb
      class="block h-[24px] w-[24px] translate-x-[3px] rounded-full bg-paper shadow-sm transition-transform duration-200 ease-zap data-[state=checked]:translate-x-[25px]"
    />
  </SwitchRoot>
</template>
