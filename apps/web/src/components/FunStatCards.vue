<script setup lang="ts">
/*
  Смешная статистика компании как игровые ачивки: сетка 2×2 без прокрутки —
  всё помещается в экран. Тон ироничный (vision §C11), это не лидерборд.
*/
import { useI18n } from 'vue-i18n'
import { money } from '@/lib/format'
import type { FunStat } from '@/lib/funStats'

const props = defineProps<{
  fun: FunStat[]
  nameOf: (contactId: string) => string
}>()

const { t } = useI18n()

const GLYPH: Record<FunStat['kind'], string> = {
  fastest: '⚡',
  alwaysLast: '👀',
  biggest: '🍕',
  buddy: '🤝',
  bigWallet: '💸',
  smallWallet: '🪙',
  alwaysBroke: '🫠',
}

function value(s: FunStat): string {
  if (s.kind === 'biggest') return money(s.value)
  return props.nameOf(s.contactId ?? '') || '—'
}

function label(s: FunStat): string {
  return t(`crew.card${s.kind.charAt(0).toUpperCase()}${s.kind.slice(1)}`)
}
</script>

<template>
  <div v-if="props.fun.length" class="grid grid-cols-2 gap-2.5">
    <div
      v-for="s in props.fun"
      :key="s.kind"
      class="flex items-center gap-2.5 rounded-[18px] bg-shell px-3 py-2.5"
    >
      <span class="text-[22px]">{{ GLYPH[s.kind] }}</span>
      <div class="min-w-0">
        <p class="truncate text-[15px] font-extrabold tracking-[-0.01em]">{{ value(s) }}</p>
        <p class="truncate text-[10.5px] font-semibold text-muted">{{ label(s) }}</p>
      </div>
    </div>
  </div>
</template>
