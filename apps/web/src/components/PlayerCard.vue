<script setup lang="ts">
/*
  Карточка игрока — шапка профиля, как в приложении: аватар по центру, слева
  уровень и сплиты, справа компании и кэшбэк, ниже полоса опыта до следующего
  ранга. Профиль перестаёт быть «просто аккаунтом».

  Ранг считается от числа сплитов: единственная метрика, которая растёт от
  использования продукта и не зависит от денег.
*/
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { myPersona } from '@/lib/personas'

const props = defineProps<{
  name: string
  handle: string
  since: string
  splits: number
  cashback: string
  groups: number
}>()

const emit = defineEmits<{ (e: 'pick'): void }>()

const { t } = useI18n()

const RANKS = [0, 5, 15, 30, 60, 120]

const level = computed(() => {
  let l = 0
  RANKS.forEach((v, i) => {
    if (props.splits >= v) l = i
  })
  return l
})
const from = computed(() => RANKS[level.value]!)
const next = computed<number | null>(() => RANKS[level.value + 1] ?? null)
const progress = computed(() =>
  next.value ? Math.min(1, (props.splits - from.value) / (next.value - from.value)) : 1,
)
</script>

<template>
  <div class="rounded-[26px] bg-shell p-[18px]">
    <div class="flex items-center justify-between">
      <div class="w-[82px] text-center">
        <p class="font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-faint-2">{{ t('profile.level') }}</p>
        <p class="mt-0.5 text-[19px] font-extrabold tracking-[-0.02em]">✦ {{ level + 1 }}</p>
        <p class="mt-3.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-faint-2">{{ t('profile.statSplitsUnit') }}</p>
        <p class="mt-0.5 text-[19px] font-extrabold tracking-[-0.02em]">{{ props.splits }}</p>
      </div>

      <button type="button" class="press relative" @click="emit('pick')">
        <img :src="myPersona()" alt="" class="h-[104px] w-[104px] rounded-full ring-[3.5px] ring-lime" />
        <span class="absolute -bottom-0.5 -left-1 grid h-[30px] min-w-[30px] place-items-center rounded-full border-[3px] border-shell bg-ink px-1.5 text-[13px] font-extrabold text-lime">
          {{ level + 1 }}
        </span>
        <span class="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-shell bg-lime text-[12px] text-on-lime">✎</span>
      </button>

      <div class="w-[82px] text-center">
        <p class="font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-faint-2">{{ t('profile.statGroupsUnit') }}</p>
        <p class="mt-0.5 text-[19px] font-extrabold tracking-[-0.02em]">{{ props.groups }}</p>
        <p class="mt-3.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-faint-2">{{ t('profile.statCashbackUnit') }}</p>
        <p class="mt-0.5 truncate text-[15px] font-extrabold tracking-[-0.02em]">{{ props.cashback }}</p>
      </div>
    </div>

    <div class="mt-3 flex flex-col items-center gap-[3px]">
      <h1 class="text-[22px] font-extrabold tracking-[-0.02em]">{{ props.name }}</h1>
      <p class="text-[13px] font-semibold text-muted">{{ props.handle }} · {{ props.since }}</p>
      <span class="mt-1 flex h-[26px] items-center rounded-full bg-lime px-[11px] text-[12px] font-extrabold tracking-[0.01em] text-on-lime">
        {{ t(`profile.rank${level}`) }}
      </span>
    </div>

    <div class="mt-[18px]">
      <div class="mb-[7px] flex items-baseline justify-between gap-2">
        <span class="text-[12px] font-semibold text-muted">
          {{ next ? t('profile.toNextRank', { n: next - props.splits, rank: t(`profile.rank${level + 1}`) }) : t('profile.maxRank') }}
        </span>
        <span class="text-[12px] font-extrabold">{{ next ? `${props.splits}/${next}` : props.splits }}</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-sand">
        <div class="h-full rounded-full bg-lime transition-[width] duration-500" :style="{ width: `${Math.max(6, progress * 100)}%` }" />
      </div>
    </div>
  </div>
</template>
