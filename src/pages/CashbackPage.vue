<script setup lang="ts">
// Дизайн 5h: «Накопленные кэшбеки» — баланс 44px, чипы групп,
// записи с логотипами мерчантов, CTA «Потратить» / «Вывести».
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, isSameDay } from '@/lib/format'
import { useCashbackStore } from '@/entities/stores/cashback'
import { useGroupsStore } from '@/entities/stores/groups'
import { useUserStore } from '@/entities/stores/user'
import { spendCashbackNext, withdrawCashback } from '@/api'
import BottomSheet from '@/components/BottomSheet.vue'
import AmountField from '@/components/AmountField.vue'
import PinSheet from '@/components/PinSheet.vue'
import AnimatedList from '@/components/AnimatedList.vue'
import CountUp from '@/components/CountUp.vue'
import partnerSafia from '@/assets/brand/partners/safia-sq.png'
import partnerTexnomart from '@/assets/brand/partners/texnomart-sq.png'
import partnerIdea from '@/assets/brand/partners/idea-sq.png'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'

const router = useRouter()
const cashback = useCashbackStore()
const groups = useGroupsStore()
const user = useUserStore()

onMounted(() => {
  void cashback.hydrate()
  void groups.hydrate()
  void user.hydrate()
})

const filter = ref<string>('all')

const filters = computed(() => [
  { value: 'all', label: 'Все группы' },
  ...groups.groups.map((g) => ({ value: g.id, label: g.name })),
])

const rows = computed(() =>
  filter.value === 'all' ? cashback.entries : cashback.entries.filter((e) => e.groupId === filter.value),
)

const logoByTitle: Record<string, string> = {
  'Bellissimo Pizza': bellissimoLogo,
  'Safia café': partnerSafia,
  Texnomart: partnerTexnomart,
  idea: partnerIdea,
}

function badgeOf(e: { badge: string }): string {
  // в дизайне бейдж — только множитель/процент, группа отдельно
  return e.badge.split(' · ')[0] ?? e.badge
}

function groupName(e: { groupId?: string }): string {
  return e.groupId ? (groups.byId(e.groupId)?.name ?? '') : ''
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function entryDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (isSameDay(d, now)) return 'сегодня'
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return 'вчера'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

async function spend() {
  const reserved = await spendCashbackNext()
  toast.success('Кэшбэк ' + money(reserved) + ' применим к следующему сплиту')
}

// вывод на карту: карта → сумма → PIN → тост + записи
const withdrawSheet = ref(false)
const withdrawCard = ref('')
const withdrawRaw = ref('')
const withdrawPin = ref(false)

function withdraw() {
  withdrawCard.value = user.cards.find((c) => c.primary)?.id ?? user.cards[0]?.id ?? ''
  withdrawRaw.value = String(cashback.balance)
  withdrawSheet.value = true
}

function withdrawNext() {
  const v = Number(withdrawRaw.value || '0')
  if (v <= 0 || v > cashback.balance) {
    toast('Сумма должна быть в пределах баланса')
    return
  }
  withdrawSheet.value = false
  withdrawPin.value = true
}

async function confirmWithdraw() {
  withdrawPin.value = false
  const v = Number(withdrawRaw.value || '0')
  await withdrawCashback(withdrawCard.value, v)
  const card = user.cards.find((c) => c.id === withdrawCard.value)
  toast.success('Вывод ' + money(v) + ' на карту ·· ' + (card?.last4 ?? '') + ' — в течение минуты')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      aria-label="Назад"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.push('/')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <h1 class="mt-6 text-[27px] font-extrabold tracking-[-0.01em]">Накопленные кэшбеки</h1>
    <div class="mt-3 flex items-baseline gap-2">
      <CountUp :value="cashback.balance" :duration="800" class="text-[44px] font-extrabold leading-none tracking-[-0.03em]" />
      <span class="font-mono text-[11px] font-bold text-faint-2">UZS · ДОСТУПНО</span>
    </div>
    <p class="mt-2 text-[13px] font-semibold text-muted">Только групповые — начисляются, когда сплитите вместе</p>

    <div class="no-scrollbar -mx-6 mt-5 flex gap-2 overflow-x-auto px-6">
      <button
        v-for="f in filters"
        :key="f.value"
        type="button"
        class="press flex h-[38px] shrink-0 items-center rounded-full px-4 text-[13px] transition-colors"
        :class="filter === f.value ? 'bg-lime font-extrabold text-on-lime' : 'bg-sand font-bold text-slate'"
        @click="filter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div class="mt-5">
      <AnimatedList appear class="flex flex-col">
        <div
          v-for="(e, i) in rows"
          :key="e.id"
          class="flex min-h-[72px] items-center gap-3.5"
          :class="i < rows.length - 1 && 'border-b border-sand-2'"
          :style="{ '--i': i }"
        >
          <img v-if="logoByTitle[e.title]" :src="logoByTitle[e.title]" :alt="e.title" class="h-11 w-11 rounded-[13px] object-cover" />
          <div v-else class="flex h-11 w-11 items-center justify-center rounded-[13px] bg-ink text-[15px] font-extrabold text-paper">
            {{ e.title[0]?.toUpperCase() }}
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="truncate text-[15.5px] font-bold">{{ e.title }}</span>
            <span class="text-[12px] font-semibold text-faint">
              <template v-if="groupName(e)">{{ groupName(e) }} · </template>{{ badgeOf(e) }} · {{ entryDate(e.createdAt) }}
            </span>
          </div>
          <span class="text-[16px] font-extrabold">{{ money(e.amount) }}</span>
        </div>
      </AnimatedList>
      <p v-if="!rows.length" class="py-8 text-center text-[13px] font-semibold text-muted">Пока пусто</p>
    </div>

    <div class="flex-1" />

    <div class="mt-5 flex flex-col gap-2.5">
      <button type="button" class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime" @click="spend">
        Потратить на следующий сплит
      </button>
      <button type="button" class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink" @click="withdraw">
        Вывести на карту
      </button>
    </div>
    <!-- вывод на карту -->
    <BottomSheet :open="withdrawSheet" @close="withdrawSheet = false">
      <div class="pb-4">
        <p class="text-center text-[15px] font-extrabold">Вывести на карту</p>
        <div class="mt-4 flex justify-center gap-2">
          <button
            v-for="c in user.cards"
            :key="c.id"
            type="button"
            class="press flex h-10 items-center gap-2 rounded-full px-4 font-mono text-[12px] font-bold transition-colors"
            :class="withdrawCard === c.id ? 'bg-ink text-paper' : 'bg-sand text-muted'"
            @click="withdrawCard = c.id"
          >
            {{ c.network }} ·· {{ c.last4 }}
          </button>
        </div>
        <AmountField v-model="withdrawRaw" placeholder-zero display-class="text-[36px] leading-none" class="my-5" />
        <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">UZS · ДОСТУПНО {{ money(cashback.balance) }}</p>
        <button type="button" class="press mt-4 h-12 w-full rounded-full bg-lime text-[15px] font-extrabold text-on-lime" @click="withdrawNext">
          Продолжить
        </button>
      </div>
    </BottomSheet>

    <PinSheet
      :open="withdrawPin"
      :hint="'Вывод · ' + money(Number(withdrawRaw || '0')) + ' UZS'"
      @close="withdrawPin = false"
      @confirm="confirmWithdraw"
    />
  </div>
</template>
