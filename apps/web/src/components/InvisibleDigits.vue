<script setup lang="ts">
// Невидимый input поверх визуала (ячейки кода, PIN-точки, маска карты):
// цифры вводятся нативной клавиатурой, тап по визуалу фокусирует поле.
import { onMounted, ref } from 'vue'

const props = defineProps<{
  length: number
  /** скрывать вводимое (PIN) */
  password?: boolean
  /** iOS/Android SMS-автозаполнение кода */
  oneTimeCode?: boolean
  autofocus?: boolean
}>()

const model = defineModel<string>({ default: '' })

const input = ref<HTMLInputElement | null>(null)
const focused = ref(false)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/\D/g, '').slice(0, props.length)
  el.value = digits
  model.value = digits
}

function focus() {
  input.value?.focus({ preventScroll: true })
}

onMounted(() => {
  // после транзишена экрана/шита, чтобы фокус не срывал анимацию
  if (props.autofocus) setTimeout(focus, 80)
})

defineExpose({ focus })
</script>

<template>
  <div class="relative" @click="focus">
    <!-- 16px — iOS не зумит; opacity-0 + прозрачный caret: виден только визуал из слота -->
    <input
      ref="input"
      :type="props.password ? 'password' : 'text'"
      inputmode="numeric"
      :autocomplete="props.oneTimeCode ? 'one-time-code' : 'off'"
      :maxlength="props.length"
      :value="model"
      enterkeyhint="done"
      class="absolute inset-0 z-10 h-full w-full cursor-pointer text-[16px] opacity-0 [caret-color:transparent]"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
    />
    <slot :focused="focused" />
  </div>
</template>
