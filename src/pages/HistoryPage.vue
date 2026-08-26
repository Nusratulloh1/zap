<script setup lang="ts">
// Дизайн 5i: «История» — поиск + аватар в шапке, чипы, моно-лейблы дней,
// строки 68px (лого мерчанта / лаймовый % / фото должника), суммы в ink.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { money, dayLabel } from '@/lib/format'
import type { HistoryEntry } from '@/entities/types'
import { useHistoryStore } from '@/entities/stores/history'
import ZapAvatar from '@/components/ZapAvatar.vue'
import AnimatedList from '@/components/AnimatedList.vue'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'
import myAvatar from '@/assets/brand/avatars/a12.png'

const router = useRouter()
const history = useHistoryStore()

onMounted(() => void history.hydrate())

const tab = ref('Все')
const tabs = ['Все', 'Сплиты', 'Кэшбэк', 'Долги']

const kindByTab: Record<string, HistoryEntry['kind'][]> = {
  Все: ['split', 'cashback', 'debt', 'payment'],
  Сплиты: ['split', 'payment'],
  Кэшбэк: ['cashback'],
  Долги: ['debt'],
}

const grouped = computed(() => {
  const rows = history.entries.filter((e) => kindByTab[tab.value]?.includes(e.kind))
  const out: { label: string; items: HistoryEntry[] }[] = []
  for (const e of rows) {
    const label = dayLabel(e.createdAt)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(e)
    else out.push({ label, items: [e] })
  }
  return out
})

function open(e: HistoryEntry) {
  if (e.splitId) router.push(`/split/${e.splitId}`)
}

function amountText(e: HistoryEntry): string {
  return (e.amount > 0 ? '+' : e.amount < 0 ? '−' : '') + money(Math.abs(e.amount))
}
</script>

<template>
  <div class="min-h-dvh bg-paper px-6 pb-28 pt-[calc(env(safe-area-inset-top)+24px)]">
    <div class="flex items-center justify-between">
      <h1 class="text-[27px] font-extrabold tracking-[-0.01em]">История</h1>
      <div class="flex items-center gap-3">
        <button type="button" aria-label="Поиск" class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.8" stroke="#5B594F" stroke-width="2" />
            <line x1="13" y1="13" x2="17" y2="17" stroke="#5B594F" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" aria-label="Профиль" class="press" @click="router.push('/profile')">
          <img :src="myAvatar" alt="Профиль" class="h-11 w-11 rounded-full border-2 border-lime object-cover" />
        </button>
      </div>
    </div>

    <div class="no-scrollbar -mx-6 mt-[18px] flex gap-2 overflow-x-auto px-6">
      <button
        v-for="t in tabs"
        :key="t"
        type="button"
        class="press flex h-[38px] shrink-0 items-center rounded-full px-4 text-[13px] transition-colors"
        :class="tab === t ? 'bg-lime font-extrabold text-on-lime' : 'bg-sand font-bold text-slate'"
        @click="tab = t"
      >
        {{ t }}
      </button>
    </div>

    <!-- табы заменяют весь датасет → своп контейнера out-in, внутри — стаггер -->
    <Transition name="listswap" mode="out-in">
    <div :key="tab">
    <template v-for="g in grouped" :key="g.label">
      <p class="mt-6 font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ g.label }}</p>
      <AnimatedList appear class="mt-1 flex flex-col">
          <div
            v-for="(e, i) in g.items"
            :key="e.id"
            class="flex min-h-[68px] items-center gap-3.5"
            :class="[i < g.items.length - 1 && 'border-b border-sand-2', e.splitId && 'cursor-pointer']"
            :style="{ '--i': i }"
            @click="open(e)"
          >
            <!-- иконка: кэшбэк — лаймовый %, долг — фото, Bellissimo — лого, иначе — буква -->
            <span v-if="e.kind === 'cashback'" class="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-lime text-[15px] font-extrabold text-on-lime">%</span>
            <ZapAvatar
              v-else-if="e.kind === 'debt' && e.contactId"
              :name="e.title"
              :color="e.color"
              :contact-id="e.contactId"
              class="h-[42px] w-[42px]"
              size="sm"
            />
            <img v-else-if="e.letter === 'B'" :src="bellissimoLogo" alt="" class="merchant-img h-[42px] w-[42px] rounded-[13px] object-cover" />
            <span v-else class="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-ink text-[15px] font-extrabold text-paper">
              {{ e.letter }}
            </span>

            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate text-[15px] font-bold">{{ e.title }}</span>
              <span class="truncate text-[12px] font-semibold text-faint">{{ e.subtitle }}</span>
            </div>
            <div class="flex flex-col items-end gap-0.5">
              <span class="hist-amount text-[15px] font-extrabold" :data-sign="e.amount > 0 ? 'p' : e.amount < 0 ? 'n' : ''">{{ amountText(e) }}</span>
              <span v-if="e.note" class="text-[11.5px] font-bold text-muted">{{ e.note }}</span>
            </div>
          </div>
      </AnimatedList>
    </template>
    <p v-if="!grouped.length" class="mt-16 text-center text-[14px] font-semibold text-muted">Пока пусто</p>
    </div>
    </Transition>
  </div>
</template>
