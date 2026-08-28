<script setup lang="ts">
// Флаги рисуем SVG, а не эмодзи: Windows не показывает цветные флаги —
// вместо 🇺🇿 там остаются буквы «UZ», и переключатель выглядит сломанным.
// Пропорция 3:2, скруглённый угол — читаются даже на 18px.
import type { Locale } from '@/lib/i18n'

const props = withDefaults(defineProps<{ locale: Locale; size?: number }>(), { size: 20 })
</script>

<template>
  <svg
    :width="props.size"
    :height="(props.size / 3) * 2"
    viewBox="0 0 24 16"
    role="img"
    aria-hidden="true"
    class="shrink-0"
  >
    <defs>
      <clipPath :id="`flag-clip-${props.locale}`">
        <rect x="0" y="0" width="24" height="16" rx="2.6" />
      </clipPath>
    </defs>
    <g :clip-path="`url(#flag-clip-${props.locale})`">
      <template v-if="props.locale === 'uz'">
        <rect width="24" height="5" fill="#0099B5" />
        <rect y="5" width="24" height="6" fill="#fff" />
        <rect y="11" width="24" height="5" fill="#1EB53A" />
        <rect y="4.7" width="24" height="0.6" fill="#CE1126" />
        <rect y="10.7" width="24" height="0.6" fill="#CE1126" />
        <path d="M5.1 1.2a1.9 1.9 0 1 0 0 3.4 2.2 2.2 0 1 1 0-3.4Z" fill="#fff" />
        <circle cx="7.6" cy="1.6" r="0.42" fill="#fff" />
        <circle cx="7.6" cy="3.2" r="0.42" fill="#fff" />
        <circle cx="9.2" cy="2.4" r="0.42" fill="#fff" />
        <circle cx="9.2" cy="4" r="0.42" fill="#fff" />
      </template>

      <template v-else-if="props.locale === 'ru'">
        <rect width="24" height="16" fill="#fff" />
        <rect y="5.34" width="24" height="5.33" fill="#0039A6" />
        <rect y="10.67" width="24" height="5.33" fill="#D52B1E" />
      </template>

      <template v-else>
        <rect width="24" height="16" fill="#012169" />
        <path d="M0 0 24 16M24 0 0 16" stroke="#fff" stroke-width="3.2" />
        <path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" stroke-width="1.9" />
        <path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5.3" />
        <path d="M12 0v16M0 8h24" stroke="#C8102E" stroke-width="3.2" />
      </template>

      <rect x="0.25" y="0.25" width="23.5" height="15.5" rx="2.4" fill="none" stroke="currentColor" stroke-opacity="0.16" stroke-width="0.5" />
    </g>
  </svg>
</template>
