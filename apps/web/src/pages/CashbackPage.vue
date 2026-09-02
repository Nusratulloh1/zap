<script setup lang="ts">
import MerchantCashbackSlider from '@/components/MerchantCashbackSlider.vue'
import VenueIcon from '@/components/VenueIcon.vue'
// Дизайн 5h: «Накопленные кэшбеки» — баланс 44px, чипы групп,
// записи с логотипами мерчантов, CTA «Потратить» / «Вывести».
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money } from '@/lib/format'
import { humanDateLc } from '@/lib/datetime'
import { useCashbackStore } from '@/entities/stores/cashback'
import { useGroupsStore } from '@/entities/stores/groups'
import { useUserStore } from '@/entities/stores/user'
import { spendCashbackNext, withdrawCashback } from '@/api'
import BottomSheet from '@/components/BottomSheet.vue'
import AmountField from '@/components/AmountField.vue'
import PinSheet from '@/components/PinSheet.vue'
import AnimatedList from '@/components/AnimatedList.vue'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const cashback = useCashbackStore()
const groups = useGroupsStore()
const user = useUserStore()

onMounted(() => {
  void cashback.hydrate()
  void groups.hydrate()
  void user.hydrate()
})

const { t } = useI18n()
const filter = ref<string>('all')

const filters = computed(() => [
  { value: 'all', label: t('cashback.allGroups') },
  ...groups.groups.map((g) => ({ value: g.id, label: g.name })),
])

const rows = computed(() =>
  filter.value === 'all' ? cashback.entries : cashback.entries.filter((e) => e.groupId === filter.value),
)


function badgeOf(e: { badge: string }): string {
  // в дизайне бейдж — только множитель/процент, группа отдельно
  return e.badge.split(' · ')[0] ?? e.badge
}

function groupName(e: { groupId?: string }): string {
  return e.groupId ? (groups.byId(e.groupId)?.name ?? '') : ''
}

const entryDate = (ts: number) => humanDateLc(ts)

async function spend() {
  const reserved = await spendCashbackNext()
  toast.success(t('cashback.spendToastAmount', { amount: money(reserved) }))
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
    toast(t('cashback.outOfRange'))
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
  toast.success(t('cashback.withdrawToastAmount', { amount: money(v), last4: card?.last4 ?? '' }))
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
      @click="router.push('/')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <h1 class="mt-6 text-[27px] font-extrabold tracking-[-0.01em]">{{ t('home.cashbackCard') }}</h1>
    <!-- свайп-карточки по заведениям: общая сумма + где именно накопилось -->
    <MerchantCashbackSlider :entries="cashback.entries" :total="cashback.balance" />
    <p class="mt-[18px] text-[13px] font-semibold text-muted">{{ t('cashback.empty') }}</p>

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
          <VenueIcon :name="e.title" size="md" />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="truncate text-[15.5px] font-bold">{{ e.title }}</span>
            <span class="text-[12px] font-semibold text-faint">
              <template v-if="groupName(e)">{{ groupName(e) }} · </template>{{ badgeOf(e) }} · {{ entryDate(e.createdAt) }}
            </span>
          </div>
          <span class="text-[16px] font-extrabold">{{ money(e.amount) }}</span>
        </div>
      </AnimatedList>
      <p v-if="!rows.length" class="py-8 text-center text-[13px] font-semibold text-muted">{{ t('history.empty') }}</p>
    </div>

    <div class="flex-1" />

    <div class="mt-5 flex flex-col gap-2.5">
      <button type="button" class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime" @click="spend">
        {{ t('cashback.spend') }}
      </button>
      <button type="button" class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink" @click="withdraw">
        {{ t('cashback.withdraw') }}
      </button>
    </div>
    <!-- вывод на карту -->
    <BottomSheet :open="withdrawSheet" @close="withdrawSheet = false">
      <div class="pb-4">
        <p class="text-center text-[15px] font-extrabold">{{ t('cashback.withdrawTitle') }}</p>
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
        <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('cashback.availableWith', { amount: money(cashback.balance) }) }}</p>
        <button type="button" class="press mt-4 h-12 w-full rounded-full bg-lime text-[15px] font-extrabold text-on-lime" @click="withdrawNext">
          {{ t('common.continue') }}
        </button>
      </div>
    </BottomSheet>

    <PinSheet
      :open="withdrawPin"
      :hint="t('cashback.withdrawHint', { amount: money(Number(withdrawRaw || '0')) })"
      @close="withdrawPin = false"
      @confirm="confirmWithdraw"
    />
  </div>
</template>
