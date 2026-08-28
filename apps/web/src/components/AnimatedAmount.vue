<script setup lang="ts">
// Живая сумма: каждый символ — отдельный элемент со СТАБИЛЬНЫМ ключом от правого
// края (единицы = d0), поэтому «555»→«5 555» не перемонтирует цифры: существующие
// FLIP-глайдят на новые позиции, монтируется только новая левая. Ужатие при росте —
// scale контейнера, а не смена font-size.
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** сырые цифры без разделителей ('' = zero-state) */
    digits: string
    /** приглушённый «0» при пустом вводе */
    placeholderZero?: boolean
    /** ужимать масштабом при 7/9/11 символах (для полноэкранного пада) */
    scaleSteps?: boolean
  }>(),
  { scaleSteps: true },
)

type Char = { key: string; ch: string; sep: boolean }

const chars = computed<Char[]>(() => {
  const d = props.digits
  if (!d) return [{ key: 'zero', ch: '0', sep: false }]
  const n = d.length
  const out: Char[] = []
  // слева направо: цифра с right-index r; после цифры с r%3===0 (r>0) — разделитель s{r}
  for (let r = n - 1; r >= 0; r--) {
    out.push({ key: 'd' + r, ch: d[n - 1 - r]!, sep: false })
    if (r > 0 && r % 3 === 0) out.push({ key: 's' + r, ch: '', sep: true })
  }
  return out
})

// 64px-эквиваленты 52/44/38 через transform: scale
const scale = computed(() => {
  if (!props.scaleSteps) return 1
  const len = chars.value.length
  if (len >= 11) return 38 / 64
  if (len >= 9) return 44 / 64
  if (len >= 7) return 52 / 64
  return 1
})

const dim = computed(() => props.placeholderZero && !props.digits)

/** до absolute фиксируем ширину — соседи глайдят на освободившееся место */
function beforeLeave(el: Element) {
  const e = el as HTMLElement
  e.style.width = e.offsetWidth + 'px'
  e.style.left = e.offsetLeft + 'px'
  e.style.top = e.offsetTop + 'px'
}
</script>

<template>
  <!-- фиксированная высота строки: масштаб не двигает контент ниже -->
  <div class="flex items-center justify-center overflow-visible" style="height: 1em">
    <span
      class="amount-scale inline-flex items-baseline whitespace-nowrap tabular-nums transition-colors duration-150 [font-variant-numeric:tabular-nums]"
      :class="dim ? 'text-ink/35' : ''"
      :style="{ transform: `scale(${scale})` }"
    >
      <TransitionGroup name="achar" @before-leave="beforeLeave">
        <span v-for="c in chars" :key="c.key" class="achar relative inline-block">
          <template v-if="c.sep"><span class="inline-block" style="width: 0.32em" /></template>
          <template v-else>{{ c.ch }}</template>
        </span>
      </TransitionGroup>
    </span>
  </div>
</template>

<style>
.amount-scale {
  transform-origin: center;
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
}
/* новая цифра: подъём + лёгкий скейл с пружинкой */
.achar-enter-active {
  transition:
    opacity 200ms cubic-bezier(0.34, 1.4, 0.5, 1),
    transform 200ms cubic-bezier(0.34, 1.4, 0.5, 1);
}
.achar-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
}
/* удаление: absolute (ширина зафиксирована хуком) — соседи глайдят */
.achar-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
  position: absolute;
  pointer-events: none;
}
.achar-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.9);
}
/* FLIP: перегруппировка «555»→«5 555» едет, а не прыгает */
.achar-move {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  .amount-scale {
    transition: none;
  }
  .achar-enter-active,
  .achar-leave-active {
    transition: opacity 100ms ease !important;
  }
  .achar-enter-from,
  .achar-leave-to {
    transform: none !important;
  }
  .achar-move {
    transition: none !important;
  }
}
</style>
