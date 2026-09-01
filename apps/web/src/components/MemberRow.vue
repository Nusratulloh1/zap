<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SplitMemberStatus } from '@zap/shared/types'
import { money } from '@/lib/format'
import ZapAvatar from './ZapAvatar.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  name: string
  color: string
  amount: number
  status: SplitMemberStatus
  isYou?: boolean
}>()

const flash = ref(false)

watch(
  () => props.status,
  (next, prev) => {
    if (next === 'paid' && prev !== 'paid') {
      flash.value = true
      setTimeout(() => (flash.value = false), 1200)
    }
  },
)
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-inner px-3 py-3"
    :class="[flash && 'row-paid-flash', (status === 'waiting' || status === 'opened') && 'animate-soft-pulse']"
  >
    <ZapAvatar :name="name" :color="color" size="md" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-[15px] font-bold">
        {{ name }}
        <span v-if="isYou" class="font-medium text-muted">· {{ t('common.you').toLowerCase() }}</span>
      </p>
      <p class="text-[12px] font-medium text-muted">
        <template v-if="status === 'paid'">{{ t('live.statusPaid') }}</template>
        <template v-else-if="status === 'opened'">{{ t('live.statusOpened') }}</template>
        <template v-else-if="status === 'debt'">{{ t('live.statusDebt') }}</template>
        <template v-else>{{ t('live.statusWaiting') }}</template>
      </p>
    </div>
    <span class="font-mono text-[14px] font-bold tabular-nums">{{ money(amount) }}</span>
    <span
      v-if="status === 'paid' || status === 'debt'"
      class="flex h-6 w-6 items-center justify-center rounded-full"
      :class="status === 'paid' ? 'bg-lime' : 'bg-stone'"
    >
      <svg v-if="status === 'paid'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path class="check-draw" d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3E3C35" stroke-width="2.4" stroke-linecap="round">
        <path d="M12 6v6l4 2" />
        <circle cx="12" cy="12" r="9" stroke-width="2" />
      </svg>
    </span>
    <span v-else class="h-6 w-6 rounded-full border-2 border-dashed border-stone" />
  </div>
</template>
