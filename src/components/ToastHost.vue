<script setup lang="ts">
// Хост тостов: закреплён сверху с учётом safe-area, новые пушат старые вниз (FLIP),
// вход — слайд с пружинкой, выход — фейд с подъёмом.
import { toastState, dismiss } from '@/lib/toast'
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-[70] mx-auto flex w-full max-w-app flex-col items-stretch gap-2 px-4"
    >
      <TransitionGroup name="toasty">
        <button
          v-for="t in toastState.items"
          :key="t.id"
          data-zap-toast
          type="button"
          class="pointer-events-auto flex w-full items-center gap-2.5 rounded-full bg-ink py-3.5 pl-5 pr-4 text-left shadow-xl shadow-black/20"
          @click="dismiss(t.id)"
        >
          <span v-if="t.kind === 'success'" class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span class="toast-label min-w-0 flex-1 truncate text-[14px] font-semibold text-paper">{{ t.text }}</span>
          <span v-if="t.count > 1" class="toast-label shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-paper">
            ×{{ t.count }}
          </span>
          <span
            v-if="t.action"
            class="shrink-0 rounded-full bg-lime px-3 py-1.5 text-[12px] font-bold text-on-lime"
            @click.stop="t.action.fn()"
          >
            {{ t.action.label }}
          </span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
/* вход: слайд сверху с лёгкой пружиной */
.toasty-enter-active {
  transition:
    transform 320ms cubic-bezier(0.34, 1.4, 0.5, 1),
    opacity 220ms ease;
}
.toasty-enter-from {
  transform: translateY(-16px) scale(0.96);
  opacity: 0;
}
/* выход: фейд с подъёмом; absolute — чтобы FLIP соседей сработал */
.toasty-leave-active {
  transition:
    transform 200ms ease,
    opacity 200ms ease;
  position: absolute;
  left: 1rem;
  right: 1rem;
}
.toasty-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
/* FLIP: остальные тосты уезжают вниз/вверх плавно */
.toasty-move {
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  .toasty-enter-active,
  .toasty-leave-active {
    transition: opacity 150ms ease !important;
  }
  .toasty-enter-from,
  .toasty-leave-to {
    transform: none !important;
  }
  .toasty-move {
    transition: none !important;
  }
}
</style>
