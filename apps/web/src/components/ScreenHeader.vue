<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title?: string
  back?: boolean
  /** куда вести по кнопке назад, иначе router.back() */
  backTo?: string
  light?: boolean
}>()

const router = useRouter()
const { t } = useI18n()

function goBack() {
  if (props.backTo) router.push(props.backTo)
  else if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <header class="flex h-14 items-center gap-2 px-4 pt-safe">
    <button
      v-if="props.back"
      type="button"
      :aria-label="t('common.backAria')"
      class="press -ml-2 flex h-11 w-11 items-center justify-center rounded-full"
      :class="props.light ? 'text-paper' : 'text-ink'"
      @click="goBack"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 v-if="props.title" class="text-[17px] font-extrabold" :class="props.light && 'text-paper'">
      {{ props.title }}
    </h1>
    <div class="ml-auto flex items-center gap-1">
      <slot name="right" />
    </div>
  </header>
</template>
