<script setup lang="ts">
// Общий анимированный список: уходящие элементы выпадают из потока
// (absolute с зафиксированной геометрией), остальные FLIP-съезжают на места,
// высота контейнера анимируется — ничего не прыгает и не наслаивается.
import { onBeforeUpdate, onUpdated, ref } from 'vue'
import { gsap, reducedMotion } from '@/lib/motion'

const props = withDefaults(defineProps<{ tag?: string; appear?: boolean }>(), {
  tag: 'div',
  appear: false,
})

const tg = ref<{ $el: HTMLElement } | null>(null)
const rootEl = () => tg.value?.$el ?? null

/** До position:absolute фиксируем текущую геометрию — иначе элемент
    схлопывается по ширине и прыгает к краю контейнера. */
function beforeLeave(el: Element) {
  const e = el as HTMLElement
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = e
  e.style.width = offsetWidth + 'px'
  e.style.height = offsetHeight + 'px'
  e.style.left = offsetLeft + 'px'
  e.style.top = offsetTop + 'px'
  e.style.margin = '0'
}

// высота контейнера: FLIP prev → next за 240мс, CTA снизу «плывёт», а не прыгает
let prevHeight = 0
onBeforeUpdate(() => {
  prevHeight = rootEl()?.offsetHeight ?? 0
})
onUpdated(() => {
  const el = rootEl()
  if (!el || reducedMotion() || !prevHeight) return
  const next = el.offsetHeight
  if (Math.abs(next - prevHeight) > 2) {
    gsap.fromTo(
      el,
      { height: prevHeight },
      { height: next, duration: 0.24, ease: 'power2.out', clearProps: 'height', overwrite: 'auto' },
    )
  }
})
</script>

<template>
  <TransitionGroup
    ref="tg"
    :tag="props.tag"
    name="alist"
    :appear="props.appear"
    class="relative"
    @before-leave="beforeLeave"
  >
    <slot />
  </TransitionGroup>
</template>
