<script setup lang="ts">
import { useI18n } from 'vue-i18n'
// Витрина партнёров в стиле маркетплейса: заголовок секции + подзаголовок +
// «Показать все», горизонтальный рельс карточек. Карточка: фирменная подложка
// с логотипом, бейдж предложения, рейтинг и категории.
export interface RailBrand {
  id: string
  name: string
  /** ключи кухонь (cuisine.*) — подпись собирает вызывающая сторона */
  tagKeys: string[]
  rating: number
  logo: string
  bg: string
  /** вид бейджа: шаблон берётся из badge.<kind> */
  badgeKind: 'promo' | 'cashback' | 'discount'
  /** подставляется в шаблон: «1+1», «10%», «×2» */
  badgeValue: string
  badgeIcon: string
  /** диапазон минут доставки, «20–30» */
  minutes?: string
}

defineProps<{
  title: string
  subtitle?: string
  tint?: string // фон секции (как лавандовый блок в примере)
  brands: RailBrand[]
}>()
const emit = defineEmits<{ pick: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <section
    class="rounded-card px-[18px] pb-[18px] pt-[18px]"
    :style="tint ? { backgroundColor: tint } : undefined"
    :class="!tint && 'bg-paper shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]'"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-[18px] font-extrabold leading-tight tracking-[-0.01em]">{{ title }}</h2>
        <p v-if="subtitle" class="mt-1 text-[12.5px] font-semibold leading-snug text-faint">{{ subtitle }}</p>
      </div>
      <button type="button" class="press shrink-0 text-[13px] font-bold text-muted">{{ t('home.seeAll') }}</button>
    </div>

    <div class="no-scrollbar -mx-[18px] mt-3.5 flex gap-3 overflow-x-auto px-[18px] pb-1">
      <button
        v-for="b in brands"
        :key="b.id"
        type="button"
        class="press flex w-[176px] shrink-0 flex-col overflow-hidden rounded-[18px] bg-paper text-left shadow-[0_6px_16px_rgba(30,28,16,0.07)]"
        @click="emit('pick', b.id)"
      >
        <!-- визуал: фирменная подложка + логотип, поверх — бейдж и время -->
        <span class="relative flex h-[104px] items-center justify-center px-4" :style="{ backgroundColor: b.bg }">
          <img :src="b.logo" :alt="b.name" class="max-h-[46px] w-auto max-w-[124px] object-contain" />
          <span class="absolute left-2 top-2 flex h-[26px] items-center gap-1 rounded-full bg-white/95 pl-2 pr-2.5 text-[11px] font-extrabold text-ink shadow-sm">
            <span>{{ b.badgeIcon }}</span>{{ t(`badge.${b.badgeKind}`, { v: b.badgeValue }) }}
          </span>
          <span
            v-if="b.minutes"
            class="absolute bottom-0 right-0 flex h-[24px] items-center rounded-tl-[10px] bg-black/70 px-2 text-[11px] font-bold text-white"
          >
            {{ t('badge.minutes', { v: b.minutes }) }}
          </span>
        </span>
        <span class="flex flex-col gap-1 p-3">
          <span class="truncate text-[15px] font-extrabold">{{ b.name }}</span>
          <span class="flex items-center gap-1.5 text-[11.5px] font-semibold text-faint">
            <span class="text-[#7FA800]">★</span>
            <span class="font-extrabold text-ink">{{ b.rating.toFixed(1) }}</span>
            <span class="truncate">· {{ b.tagKeys.map((k) => t(`cuisine.${k}`)).join(' · ') }}</span>
          </span>
        </span>
      </button>
    </div>
  </section>
</template>
