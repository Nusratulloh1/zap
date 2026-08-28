<script setup lang="ts">
// Переключатель темы: солнце ↔ луна с морфом (поворот + кроссфейд, пружина 300ms),
// круговое раскрытие темы от центра кнопки (View Transitions в theme.ts).
import { computed } from 'vue'
import { themeState, toggleTheme } from '@/lib/theme'

const isDark = computed(() => themeState.theme === 'dark')

function onToggle(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  toggleTheme(r.left + r.width / 2, r.top + r.height / 2)
}
</script>

<template>
  <button
    type="button"
    :aria-label="isDark ? 'Светлая тема' : 'Тёмная тема'"
    class="press relative flex h-11 w-11 items-center justify-center rounded-full bg-sand"
    data-theme-toggle
    @click="onToggle"
  >
    <!-- солнце -->
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" class="tt-icon" :class="isDark ? 'tt-out' : 'tt-in'">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" class="text-slate" stroke-width="1.8" />
      <path
        d="M10 2.5V5M10 15V17.5M2.5 10H5M15 10H17.5M4.7 4.7L6.4 6.4M13.6 13.6L15.3 15.3M15.3 4.7L13.6 6.4M6.4 13.6L4.7 15.3"
        stroke="currentColor"
        class="text-slate"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
    <!-- луна -->
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" class="tt-icon absolute" :class="isDark ? 'tt-in' : 'tt-out'">
      <path
        d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z"
        stroke="currentColor"
        class="text-slate"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.tt-icon {
  transition:
    transform 300ms cubic-bezier(0.34, 1.4, 0.5, 1),
    opacity 200ms ease;
}
.tt-in {
  transform: rotate(0deg) scale(1);
  opacity: 1;
}
.tt-out {
  transform: rotate(120deg) scale(0.4);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .tt-icon {
    transition: opacity 150ms ease;
  }
  .tt-out {
    transform: none;
  }
}
</style>
