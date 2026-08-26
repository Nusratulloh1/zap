<script setup lang="ts">
// Баннер установки PWA в стиле ZAP (референс — банковские инсталл-баннеры):
// чернильная карточка над таббаром, лаймовая плитка с вордмарком, CTA + «×».
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { installState, install, snooze } from '@/lib/installPrompt'

const route = useRoute()
// над таббаром на табовых экранах, иначе у нижнего края
const bottomClass = computed(() =>
  route.meta.tab
    ? 'bottom-[calc(env(safe-area-inset-bottom)+92px)]'
    : 'bottom-[calc(env(safe-area-inset-bottom)+16px)]',
)
</script>

<template>
  <Teleport to="body">
    <Transition name="install-banner">
      <div
        v-if="installState.banner"
        class="fixed inset-x-0 z-[35] mx-auto w-full max-w-app px-4"
        :class="bottomClass"
      >
        <div
          data-install-banner
          class="install-banner flex items-center gap-3 rounded-[22px] px-4 py-3.5 shadow-xl shadow-black/25"
        >
          <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-lime">
            <img src="/icon-192.png" alt="" class="h-full w-full object-cover" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[15px] font-bold leading-tight text-white">Установите ZAP!</span>
            <span class="text-[12.5px] font-semibold leading-snug text-white/[0.65]">
              Быстрый доступ с экрана «Домой» — как приложение
            </span>
          </span>
          <button
            type="button"
            class="press flex h-[38px] shrink-0 items-center rounded-full bg-lime px-4 text-[13.5px] font-bold text-on-lime"
            @click="install()"
          >
            Установить
          </button>
          <button
            type="button"
            aria-label="Скрыть"
            class="press hit-area relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60"
            @click="snooze()"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="m3.5 3.5 7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.install-banner {
  background-color: #111110;
}
[data-theme='dark'] .install-banner {
  background-color: var(--elevated);
}
/* вход: пружинный слайд снизу; уход: слайд вниз */
.install-banner-enter-active {
  transition:
    transform 420ms cubic-bezier(0.34, 1.35, 0.5, 1),
    opacity 240ms ease;
}
.install-banner-leave-active {
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms ease;
}
.install-banner-enter-from,
.install-banner-leave-to {
  transform: translateY(calc(100% + 24px));
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .install-banner-enter-active,
  .install-banner-leave-active {
    transition: opacity 150ms ease;
  }
  .install-banner-enter-from,
  .install-banner-leave-to {
    transform: none;
  }
}
</style>
