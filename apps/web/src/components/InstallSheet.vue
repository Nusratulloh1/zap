<script setup lang="ts">
// Инструкция по установке: iOS Safari (3 шага с iOS-глифами), iOS-не-Safari
// («откройте в Safari» + копия ссылки), Android без beforeinstallprompt (меню ⋮).
import { computed } from 'vue'
import { installState, closeSheet } from '@/lib/installPrompt'
import { toast } from '@/lib/toast'
import BottomSheet from '@/components/BottomSheet.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const location = window.location
const variant = computed(() => installState.sheetVariant)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.origin)
    toast.success(t('common.copied'))
  } catch {
    toast(t('install.copyFromBar'))
  }
}
</script>

<template>
  <BottomSheet :open="installState.sheet" @close="closeSheet()">
    <div class="flex flex-col items-center px-1 pb-2 pt-1">
      <span class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[16px] bg-lime">
        <img src="/icon-192.png" alt="" class="h-full w-full object-cover" />
      </span>
      <h2 class="mt-3 text-center text-[19px] font-extrabold tracking-[-0.01em]">
        {{ variant === 'ios-safari' ? t('install.titleIos') : t('install.title') }}
      </h2>
      <p class="mt-1 text-center text-[13px] font-semibold text-muted">
        {{ t('install.subtitle') }}
      </p>

      <!-- iOS Safari: 3 шага -->
      <div v-if="variant === 'ios-safari'" class="mt-5 flex w-full flex-col gap-3.5">
        <div class="st flex items-center gap-3.5" style="--d: 1">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] font-bold text-paper">1</span>
          <span class="flex-1 text-[15px] font-semibold leading-snug">
            {{ t('install.iosStep1') }}
            <svg class="-mt-0.5 inline" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 12.5V2.8M6.6 5.6 10 2.3l3.4 3.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M5.5 9H4.6C4 9 3.5 9.5 3.5 10.1v6.3c0 .6.5 1.1 1.1 1.1h10.8c.6 0 1.1-.5 1.1-1.1v-6.3c0-.6-.5-1.1-1.1-1.1h-.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            {{ t('install.iosStep1Hint') }}
          </span>
        </div>
        <div class="st flex items-center gap-3.5" style="--d: 2">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] font-bold text-paper">2</span>
          <span class="flex-1 text-[15px] font-semibold leading-snug">
            {{ t('install.iosStep2') }}
            <svg class="-mt-0.5 inline" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2.8" y="2.8" width="14.4" height="14.4" rx="3.6" stroke="currentColor" stroke-width="1.7" />
              <path d="M10 6.6v6.8M6.6 10h6.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </span>
        </div>
        <div class="st flex items-center gap-3.5" style="--d: 3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] font-bold text-paper">3</span>
          <span class="flex-1 text-[15px] font-semibold leading-snug">{{ t('install.iosStep3') }}</span>
        </div>
      </div>

      <!-- iOS не-Safari -->
      <div v-else-if="variant === 'ios-other'" class="mt-5 flex w-full flex-col items-center gap-4">
        <p class="text-center text-[15px] font-semibold leading-snug">
          {{ t('install.openInSafari', { host: location.host }) }}
        </p>
        <button type="button" class="press h-12 w-full rounded-full bg-sand text-[15px] font-bold text-ink" @click="copyLink">
          {{ t('common.copy') }}
        </button>
      </div>

      <!-- Android без нативного промпта -->
      <div v-else class="mt-5 flex w-full flex-col gap-3.5">
        <div class="st flex items-center gap-3.5" style="--d: 1">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] font-bold text-paper">1</span>
          <span class="flex-1 text-[15px] font-semibold leading-snug">
            {{ t('install.chromeStep1') }}
            <svg class="-mt-0.5 inline" width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="4" r="1.7" fill="currentColor" /><circle cx="10" cy="10" r="1.7" fill="currentColor" /><circle cx="10" cy="16" r="1.7" fill="currentColor" />
            </svg>
            {{ t('install.chromeStep1Hint') }}
          </span>
        </div>
        <div class="st flex items-center gap-3.5" style="--d: 2">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] font-bold text-paper">2</span>
          <span class="flex-1 text-[15px] font-semibold leading-snug">{{ t('install.chromeStep2') }}</span>
        </div>
      </div>

      <!-- подсказка-стрелка к кнопке «Поделиться» Safari (внизу по центру iPhone) -->
      <svg
        v-if="variant === 'ios-safari'"
        class="install-hint-arrow mt-5 text-faint"
        width="22"
        height="26"
        viewBox="0 0 22 26"
        fill="none"
        aria-hidden="true"
      >
        <path d="M11 2v19M4.5 15.5 11 22l6.5-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>

      <button type="button" class="press mt-5 h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime" @click="closeSheet()">
        {{ t('common.gotIt') }}
      </button>
    </div>
  </BottomSheet>
</template>

<style>
@keyframes install-hint {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  50% {
    transform: translateY(6px);
    opacity: 1;
  }
}
.install-hint-arrow {
  animation: install-hint 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .install-hint-arrow {
    animation: none;
  }
}
</style>
