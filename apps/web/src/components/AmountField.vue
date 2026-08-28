<script setup lang="ts">
// Крупная сумма в JetBrains Mono, за которой стоит нативный numeric-input.
// В модели — сырые цифры, на экране — «1 200 000».
import { computed, onMounted, ref } from 'vue'
import AnimatedAmount from './AnimatedAmount.vue'

const props = defineProps<{
  maxDigits?: number
  displayClass?: string
  placeholderZero?: boolean
  autofocus?: boolean
  mono?: boolean
}>()

const model = defineModel<string>({ default: '' })

const input = ref<HTMLInputElement | null>(null)
const max = computed(() => props.maxDigits ?? 9)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, max.value)
  el.value = digits
  model.value = digits
}

function focus() {
  input.value?.focus({ preventScroll: true })
}

onMounted(() => {
  if (props.autofocus) setTimeout(focus, 80)
})

defineExpose({ focus })

</script>

<template>
  <div class="relative" @click="focus">
    <input
      ref="input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      :maxlength="max"
      :value="model"
      enterkeyhint="done"
      class="absolute inset-0 z-10 h-full w-full cursor-pointer text-[16px] opacity-0 [caret-color:transparent]"
      @input="onInput"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <AnimatedAmount
      :digits="model"
      :placeholder-zero="props.placeholderZero"
      :scale-steps="false"
      class="pointer-events-none font-mono font-bold"
      :class="props.displayClass"
    />
  </div>
</template>
