<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { themeState } from '@/lib/theme'

const props = defineProps<{ value: string; size?: number; light?: string }>()

const canvas = ref<HTMLCanvasElement | null>(null)

async function render() {
  if (!canvas.value) return
  // тёмная тема: крем-модули на surface (тихая зона сохранена);
  // jsQR/BarcodeDetector читают инверсные коды (inversionAttempts: attemptBoth)
  const dark = themeState.theme === 'dark'
  await QRCode.toCanvas(canvas.value, props.value, {
    width: props.size ?? 220,
    margin: 1,
    color: dark
      ? { dark: '#F5F3EE', light: '#22211D' }
      : { dark: '#111110', light: props.light ?? '#ffffff' },
  })
}

onMounted(render)
watch(() => [props.value, themeState.theme], render)
</script>

<template>
  <canvas ref="canvas" class="rounded-2xl" />
</template>
