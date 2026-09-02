<script setup lang="ts">
/*
  Кэшбэк по заведениям — свайп-карточки вверху экрана: общая сумма, дальше по
  местам. Карточка чуть уже экрана, край следующей виден — понятно, что
  листается. Это витрина, а не отчёт: узор, стикер-кошелёк и знак категории
  фоном.
*/
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CountUp from '@/components/CountUp.vue'
import VenueIcon from '@/components/VenueIcon.vue'
import { money } from '@/lib/format'
import { merchantGlyph } from '@/lib/merchantLogo'
import type { CashbackEntry } from '@zap/shared/types'

const props = defineProps<{ entries: CashbackEntry[]; total: number }>()
const { t } = useI18n()

const page = ref(0)

const byMerchant = computed(() => {
  const acc = new Map<string, { title: string; amount: number; count: number; badge: string }>()
  for (const e of props.entries) {
    const cur = acc.get(e.title) ?? { title: e.title, amount: 0, count: 0, badge: e.badge }
    cur.amount += e.amount
    cur.count += 1
    acc.set(e.title, cur)
  }
  return [...acc.values()].sort((a, b) => b.amount - a.amount).slice(0, 4)
})

function onScroll(ev: Event) {
  const el = ev.target as HTMLElement
  page.value = Math.round(el.scrollLeft / (el.clientWidth * 0.88))
}
</script>

<template>
  <div>
    <div
      class="no-scrollbar -mx-6 mt-[18px] flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-6"
      @scroll="onScroll"
    >
      <div class="w-[86%] shrink-0 snap-start rounded-[24px] bg-lime p-[18px] text-on-lime">
        <p class="font-mono text-[9.5px] font-bold tracking-[0.15em] opacity-60">{{ t('cashback.available') }}</p>
        <CountUp :value="props.total" :duration="800" class="mt-1 block text-[38px] font-extrabold leading-none tracking-[-0.03em]" />
        <p class="mt-1.5 text-[12px] font-bold opacity-60">{{ t('cashback.allPlaces') }}</p>
      </div>

      <div
        v-for="m in byMerchant"
        :key="m.title"
        class="relative w-[86%] shrink-0 snap-start overflow-hidden rounded-[24px] bg-shell p-[18px]"
      >
        <span class="pointer-events-none absolute -bottom-5 -right-2 text-[96px] opacity-[0.07]">{{ merchantGlyph(m.title) }}</span>
        <div class="flex items-center justify-between">
          <VenueIcon :name="m.title" size="md" />
          <span class="flex h-[26px] items-center rounded-full bg-lime px-[11px] text-[11.5px] font-extrabold text-on-lime">
            {{ m.badge.split(' · ')[0] }}
          </span>
        </div>
        <p class="mt-3 text-[30px] font-extrabold leading-none tracking-[-0.03em]">{{ money(m.amount) }}</p>
        <p class="mt-1 text-[13.5px] font-extrabold">{{ m.title }}</p>
        <p class="text-[11px] font-semibold text-faint">{{ t('cashback.fromSplits', { n: m.count }) }}</p>
      </div>
    </div>

    <div v-if="byMerchant.length" class="mt-3 flex justify-center gap-1.5">
      <span
        v-for="i in byMerchant.length + 1"
        :key="i"
        class="h-1.5 rounded-full transition-all"
        :class="i - 1 === page ? 'w-4 bg-ink' : 'w-1.5 bg-sand-2'"
      />
    </div>
  </div>
</template>
