<script setup lang="ts">
// Дизайн 4a: чёрная плашка активного сплита над таб-баром —
// логотип мерчанта, «Активный сплит», «ждём Бека · 128 000», лаймовый прогресс.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSplitsStore } from '@/entities/stores/splits'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import { money } from '@/lib/format'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const splits = useSplitsStore()
const contacts = useContactsStore()
const user = useUserStore()

const split = computed(() => splits.activeSplit)

// только на главной: на пэде суммы плашка перекрывала «Далее»
const show = computed(() => user.isAuthed && route.path === '/' && split.value !== null)

const waitingNames = computed(() => {
  if (!split.value) return ''
  const names = split.value.members
    .filter((m) => m.status === 'waiting' || m.status === 'opened')
    .map((m) => contacts.byId(m.contactId)?.name ?? '?')
  if (!names.length) return ''
  
  return names.join(t('common.and'))
})

const remaining = computed(() =>
  (split.value?.members ?? [])
    .filter((m) => m.status !== 'paid' && m.status !== 'debt')
    .reduce((s, m) => s + m.amount, 0),
)

const progress = computed(() => {
  if (!split.value) return 0
  const paid = split.value.members
    .filter((m) => m.status === 'paid' || m.status === 'debt')
    .reduce((s, m) => s + m.amount, 0)
  return Math.round((paid / split.value.total) * 100)
})

const isBellissimo = computed(() => split.value?.merchantId === 'm_bellissimo')
const merchant = computed(() => contacts.merchantById(split.value?.merchantId))
</script>

<template>
  <Transition name="pill">
    <button
      v-if="show && split"
      type="button"
      class="press fixed bottom-[calc(86px+env(safe-area-inset-bottom))] left-1/2 z-30 flex w-[calc(100%-28px)] max-w-[374px] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-[13px] pl-[11px] pr-[18px] text-left shadow-[0_14px_34px_rgba(30,28,16,0.35)]"
      @click="router.push(`/split/${split.id}`)"
    >
      <img v-if="isBellissimo" :src="bellissimoLogo" alt="" class="merchant-img h-[42px] w-[42px] rounded-full object-cover" />
      <div
        v-else
        class="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[16px] font-extrabold text-paper"
        :style="{ background: merchant?.color ?? '#3E3C35' }"
      >
        {{ merchant?.letter ?? split.title[0]?.toUpperCase() }}
      </div>
      <div class="min-w-0 flex-1 space-y-[7px]">
        <div class="flex items-baseline justify-between gap-2">
          <span class="whitespace-nowrap text-[14.5px] font-extrabold text-paper">{{ t('home.activeSplit') }}</span>
          <span class="truncate text-[12px] font-bold text-paper/55">
            <template v-if="waitingNames">{{ t('home.waitingFor', { names: waitingNames, amount: money(remaining) }) }}</template>
            <template v-else>{{ t('home.allPaid') }}</template>
          </span>
        </div>
        <div class="h-[6px] overflow-hidden rounded-full bg-white/[0.18]">
          <div class="h-full w-full origin-left rounded-full bg-lime transition-transform duration-500 ease-zap" :style="{ transform: `scaleX(${progress / 100})` }" />
        </div>
      </div>
      <span class="text-[17px] font-semibold text-paper/50">›</span>
    </button>
  </Transition>
</template>
