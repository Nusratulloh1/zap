<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { money } from '@/lib/format'

const props = withDefaults(
  defineProps<{
    value: number
    duration?: number
    prefix?: string
    autostart?: boolean
  }>(),
  // важно: отсутствующий boolean-проп Vue приводит к false, поэтому явный default
  { autostart: true },
)

const current = ref(0)
let raf = 0

const reduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function animate(to: number) {
  cancelAnimationFrame(raf)
  if (reduced) {
    current.value = to
    return
  }
  const from = current.value
  const dur = props.duration ?? 1100
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur)
    const eased = 1 - Math.pow(1 - t, 3)
    current.value = Math.round(from + (to - from) * eased)
    if (t < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => {
  if (props.autostart) animate(props.value)
})

watch(
  () => props.value,
  (v) => animate(v),
)

const text = computed(() => (props.prefix ?? '') + money(current.value))
</script>

<template>
  <span class="tabular-nums">{{ text }}</span>
</template>
