<script setup lang="ts">
// Шит с пружинным входом (лёгкий overshoot), drag-to-dismiss с резинкой
// и velocity-релизом; контент стаггерится после приземления.
import { onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { gsap, DUR, reducedMotion, staggerIn } from '@/lib/motion'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const backdrop = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      await nextTick()
      if (!panel.value) return
      if (reducedMotion()) {
        gsap.fromTo(panel.value, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none', clearProps: 'opacity' })
        return
      }
      gsap.fromTo(backdrop.value, { opacity: 0 }, { opacity: 1, duration: 0.24, ease: 'none' })
      // Контент стаггерится ВНАХЛЁСТ со слайдом (спрятан с первого кадра через
      // immediateRender). Раньше staggerIn стартовал в onComplete: уже видимый
      // контент прятался и анимировался заново — читалось как «прыжок»
      // через секунду после открытия.
      if (content.value) staggerIn(content.value, 0.03, 0.16)
      gsap.fromTo(
        panel.value,
        { y: '100%' },
        {
          keyframes: [
            { y: '-4px', duration: 0.3, ease: 'power3.out' },
            { y: '0px', duration: 0.14, ease: 'power2.inOut' },
          ],
          onComplete: () => {
            // возвращаем transform классу kb-avoid (GSAP-инлайн его перебивает)
            if (panel.value) gsap.set(panel.value, { clearProps: 'transform' })
          },
        },
      )
    }
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

// --- drag-to-dismiss ---
let dragY = 0
let startY = 0
let lastY = 0
let lastT = 0
let velocity = 0
let dragging = false

function onDragStart(e: PointerEvent) {
  if (!panel.value) return
  dragging = true
  startY = e.clientY
  lastY = e.clientY
  lastT = performance.now()
  velocity = 0
  gsap.killTweensOf(panel.value)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onDragMove(e: PointerEvent) {
  if (!dragging || !panel.value) return
  const now = performance.now()
  velocity = (e.clientY - lastY) / Math.max(1, now - lastT)
  lastY = e.clientY
  lastT = now
  const dy = e.clientY - startY
  // вниз — как есть, вверх — резинка
  dragY = dy > 0 ? dy : dy * 0.2
  gsap.set(panel.value, { y: dragY })
}

function onDragEnd() {
  if (!dragging || !panel.value) return
  dragging = false
  const h = panel.value.offsetHeight
  if (velocity > 0.5 || dragY > h * 0.35) {
    gsap.to(panel.value, {
      y: '100%',
      duration: DUR.slow,
      ease: 'power2.in',
      onComplete: () => emit('close'),
    })
    gsap.to(backdrop.value, { opacity: 0, duration: DUR.slow })
  } else {
    gsap.to(panel.value, {
      y: 0,
      duration: 0.4,
      ease: 'back.out(1.6)',
      onComplete: () => panel.value && gsap.set(panel.value, { clearProps: 'transform' }),
    })
  }
  dragY = 0
}
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div v-if="props.open" ref="backdrop" class="zap-backdrop fixed inset-0 z-40 bg-ink/40" @click="emit('close')" />
    </Transition>
    <Transition :name="reducedMotion() ? 'backdrop' : 'sheet-none'">
      <div
        v-if="props.open"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-app"
        role="dialog"
        aria-modal="true"
      >
        <!-- kb-avoid на панели: transform контейнера занят GSAP-драгом -->
        <div ref="panel" class="zap-sheet kb-avoid rounded-t-card bg-paper px-5 pb-safe pt-2 shadow-2xl">
          <div
            class="mx-auto mb-3 h-1 w-10 cursor-grab touch-none rounded-full bg-stone"
            @pointerdown="onDragStart"
            @pointermove="onDragMove"
            @pointerup="onDragEnd"
            @pointercancel="onDragEnd"
          />
          <div ref="content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* моментальный enter/leave — движение панелью управляет GSAP */
.sheet-none-enter-active,
.sheet-none-leave-active {
  transition: opacity 240ms ease;
}
.sheet-none-leave-to {
  opacity: 0;
}
</style>
