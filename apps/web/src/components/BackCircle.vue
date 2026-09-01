<script setup lang="ts">
// Кнопка «назад» из дизайна: круг 44px #F5F3EE со стрелкой.
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ to?: string }>()
const router = useRouter()
const { t } = useI18n()

function go() {
  if (props.to) router.push(props.to)
  else if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <button
    type="button"
    :aria-label="t('common.backAria')"
    class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-ink"
    @click="go"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
