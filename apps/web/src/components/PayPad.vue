<script setup lang="ts">
// Платёжная клавиатура экрана 3a: 1-9 / 000 0 ⌫.
// Нажатие: scale 0.9 + радиальная вспышка ink-8% (GSAP, пружинный отскок).
import { gsap, reducedMotion } from '@/lib/motion'
import { tap } from '@/lib/haptics'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{ key: [value: string]; backspace: [] }>()

const rows: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', '⌫'],
]

function press(e: PointerEvent, key: string) {
  tap()
  const el = e.currentTarget as HTMLElement
  if (!reducedMotion()) {
    const flash = el.querySelector('.key-glow') as HTMLElement | null
    if (flash) {
      gsap.fromTo(flash, { opacity: 1, scale: 0.4 }, { opacity: 0, scale: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
    }
    gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)', overwrite: 'auto' })
  }
  if (key === '⌫') emit('backspace')
  else emit('key', key)
}
</script>

<template>
  <div class="mx-3 grid select-none grid-cols-3">
    <template v-for="row in rows" :key="row[0]">
      <button
        v-for="k in row"
        :key="k"
        type="button"
        class="relative flex h-14 items-center justify-center overflow-visible font-sans text-[26px] font-bold text-ink"
        :class="k === '000' && 'text-[23px] font-extrabold'"
        :aria-label="k === '⌫' ? t('common.eraseAria') : k"
        @pointerdown="press($event, k)"
      >
        <span class="key-glow pointer-events-none absolute inset-x-2 inset-y-0 rounded-2xl bg-ink/[0.08] opacity-0" />
        <span class="relative" :class="k === '⌫' && 'text-[23px]'">{{ k }}</span>
      </button>
    </template>
  </div>
</template>
