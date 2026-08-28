<script setup lang="ts">
// Дизайн 3g: лаймовый «Готово, сплит закрыт» — логотип мерчанта, сумма 48px,
// чёрный пилл «+60 000 групповой кэшбэк», участники, итог группы, CTA.
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { money } from '@/lib/format'
import { useSplitsStore } from '@/entities/stores/splits'
import { useGroupsStore } from '@/entities/stores/groups'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import { ref } from 'vue'
import ZapAvatar from '@/components/ZapAvatar.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'
import CountUp from '@/components/CountUp.vue'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const splits = useSplitsStore()
const groups = useGroupsStore()
const contacts = useContactsStore()
const user = useUserStore()

const id = computed(() => String(route.params.id))
const split = computed(() => splits.byId(id.value))
const group = computed(() => (split.value?.groupId ? groups.byId(split.value.groupId) : undefined))
const merchant = computed(() => contacts.merchantById(split.value?.merchantId))
const isBellissimo = computed(() => split.value?.merchantId === 'm_bellissimo')
const isSolo = computed(() => (split.value?.members.length ?? 0) < 2)
const billSheet = ref(false)

onMounted(() => {
  void splits.hydrate()
  void groups.hydrate()
  void contacts.hydrate()
  void user.hydrate()
})

function nameOf(cid: string): string {
  return cid === 'me' ? (user.user?.name ?? t('members.youShort')) : (contacts.byId(cid)?.name ?? '?')
}

function colorOf(cid: string): string {
  return cid === 'me' ? '#111110' : (contacts.byId(cid)?.color ?? '#8A887E')
}
</script>

<template>
  <div v-if="split" class="theme-fixed flex min-h-dvh flex-col bg-lime px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)] text-ink">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.08] text-[17px] font-semibold"
      @click="router.push('/')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <div class="mt-[30px]">
      <img v-if="isBellissimo" :src="bellissimoLogo" alt="" class="-ml-2 h-[76px] w-[76px] object-cover" />
      <div v-else class="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ink text-[26px] font-extrabold text-lime">
        {{ merchant?.letter ?? split.title[0]?.toUpperCase() }}
      </div>
      <h1 class="mt-2.5 text-[25px] font-extrabold tracking-[-0.01em]">{{ t('closed.title') }}</h1>
      <p class="mt-[5px] text-[13.5px] font-semibold text-ink/60">
        {{ merchant?.name ?? split.title }}<template v-if="split.bill">{{ t('live.orderNo', { no: split.bill.orderNo }) }}</template><template v-if="group"> · {{ group.name }}</template><template v-else-if="isSolo">{{ t('closed.paidWhole') }}</template>
      </p>
      <div class="mt-6 flex items-baseline gap-2">
        <CountUp :value="split.total" :duration="900" class="text-[48px] font-extrabold leading-none tracking-[-0.03em]" />
        <span class="font-mono text-[11px] font-bold text-ink/55">UZS</span>
      </div>
      <div v-if="split.cashback" class="mt-3.5 flex h-[34px] w-fit items-center gap-2 rounded-full bg-ink px-3.5">
        <span class="text-[12.5px] font-extrabold text-lime">{{ t('closed.cashbackBadge', { amount: money(split.cashback) }) }}</span>
      </div>
    </div>

    <div v-if="!isSolo" class="mt-[26px] border-t border-ink/[0.14] pt-1.5">
      <div
        v-for="(m, i) in split.members"
        :key="m.contactId"
        class="flex min-h-[58px] items-center gap-3"
        :class="i < split.members.length - 1 && 'border-b border-ink/[0.14]'"
      >
        <ZapAvatar :name="nameOf(m.contactId)" :color="colorOf(m.contactId)" :contact-id="m.contactId" class="h-[38px] w-[38px]" size="sm" />
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="text-[15px] font-bold">{{ nameOf(m.contactId) }}<template v-if="m.isYou">{{ t('live.youSuffix') }}</template></span>
          <span v-if="m.status === 'debt'" class="text-[12px] font-semibold text-ink/55">{{ t('closed.covered') }}</span>
        </div>
        <span class="text-[15px] font-extrabold">{{ money(m.amount) }}</span>
      </div>
    </div>

    <div v-if="group" class="mt-5 flex items-baseline justify-between">
      <span class="text-[14.5px] font-bold text-ink/60">{{ t('closed.groupTotalLabel', { name: group.name }) }}</span>
      <span class="text-[19px] font-extrabold">{{ money(group.cashback) }}</span>
    </div>

    <div class="flex-1" />

    <!-- групповой сплит: сохранить группу → кэшбэк; соло: только закрыть/чек -->
    <div v-if="!isSolo" class="flex flex-col gap-2.5">
      <button type="button" class="press h-14 rounded-full bg-ink text-[16px] font-extrabold text-paper" @click="router.push(`/split/${id}/save-group`)">
        {{ t('closed.saveGroup') }}
      </button>
      <button type="button" class="press h-14 rounded-full bg-white/55 text-[16px] font-bold text-ink" @click="router.push(`/split/${id}/cashback`)">
        {{ t('closed.close') }}
      </button>
    </div>
    <div v-else class="flex flex-col gap-2.5">
      <button type="button" class="press h-14 rounded-full bg-ink text-[16px] font-extrabold text-paper" @click="router.push('/')">
        {{ t('closed.close') }}
      </button>
      <button v-if="split.bill" type="button" class="press h-14 rounded-full bg-white/55 text-[16px] font-bold text-ink" @click="billSheet = true">
        {{ t('closed.viewReceipt') }}
      </button>
    </div>

    <!-- чек соло-оплаты -->
    <BottomSheet :open="billSheet" @close="billSheet = false">
      <div v-if="split.bill" class="pb-4">
        <p class="text-center text-[15px] font-extrabold">{{ merchant?.name }} · #{{ split.bill.orderNo }}</p>
        <div class="mt-3 border-t-2 border-dashed border-hairline" />
        <div class="mt-2 flex flex-col">
          <div v-for="item in split.bill.items" :key="item.id" class="flex min-h-[34px] items-center justify-between">
            <span class="text-[14px] font-semibold">{{ item.title }}<template v-if="item.qty > 1"> ×{{ item.qty }}</template></span>
            <span class="font-mono text-[12.5px] font-bold tabular-nums">{{ money(item.amount) }}</span>
          </div>
        </div>
        <div class="mt-2 border-t-2 border-dashed border-hairline" />
        <div class="mt-3 flex items-baseline justify-between">
          <span class="text-[15px] font-extrabold">{{ t('closed.totalRow') }}</span>
          <span class="text-[17px] font-extrabold">{{ money(split.bill.total) }}</span>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>
