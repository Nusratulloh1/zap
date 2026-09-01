<script setup lang="ts">
// Баннер установки PWA в стиле ZAP (референс — банковские инсталл-баннеры):
// чернильная карточка над таббаром, лаймовая плитка с вордмарком, CTA + «×».
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { installState, install, snooze } from '@/lib/installPrompt'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const route = useRoute()
// позиционирование: над таббаром (главная), выше нижней подсказки/CTA на
// онбординге/авторизации, иначе у нижнего края
const bottomClass = computed(() => {
  if (route.meta.tab) return 'bottom-[calc(env(safe-area-inset-bottom)+92px)]'
  if (route.path === '/onboarding' || route.path.startsWith('/auth/'))
    return 'bottom-[calc(env(safe-area-inset-bottom)+104px)]'
  // экран участника (/s/:code): над CTA «Открыть ZAP!», не перекрывая его
  if (route.path.startsWith('/s/')) return 'bottom-[calc(env(safe-area-inset-bottom)+120px)]'
  return 'bottom-[calc(env(safe-area-inset-bottom)+16px)]'
})
</script>

<template>
  <Teleport to="body">
    <Transition name="install-banner">
      <div
        v-if="installState.banner"
        class="pointer-events-none fixed inset-x-0 z-[35] mx-auto w-full max-w-app px-4"
        :class="bottomClass"
      >
        <div
          data-install-banner
          class="install-banner pointer-events-auto relative flex items-center gap-3 rounded-[22px] py-3.5 pl-4 pr-3 shadow-xl shadow-black/25"
        >
          <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-lime">
            <img src="/icon-192.png" alt="" class="h-full w-full object-cover" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="truncate text-[15px] font-bold leading-tight text-white">{{ t('install.title') }}</span>
            <span class="install-banner-desc text-[12px] font-semibold leading-snug text-white/[0.65]">
              {{ t('install.text') }}
            </span>
          </span>
          <button
            type="button"
            class="press flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-full bg-lime px-4 text-[13.5px] font-bold text-on-lime"
            @click="install()"
          >
            {{ t('install.cta') }}
          </button>
          <button
            type="button"
            :aria-label="t('common.hideAria')"
            class="press hit-area absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#2a2a28] text-white/70 shadow-md shadow-black/30"
            @click="snooze()"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
/* описание не раздувает баннер: максимум 2 строки */
.install-banner-desc {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
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
