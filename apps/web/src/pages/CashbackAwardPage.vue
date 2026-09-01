<script setup lang="ts">
// Дизайн 3i: «Кэшбэк зачислен» — логотип мерчанта, +60 000 (каунт-ап),
// лаймовый пилл «×2», по 20 000 каждому (Бек — после возврата долга), итог группы.
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, equalShares } from '@/lib/format'
import { useSplitsStore } from '@/entities/stores/splits'
import { useGroupsStore } from '@/entities/stores/groups'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import ZapAvatar from '@/components/ZapAvatar.vue'
import CountUp from '@/components/CountUp.vue'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'
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

onMounted(() => {
  void splits.hydrate()
  void groups.hydrate()
  void contacts.hydrate()
  void user.hydrate()
})

const perMember = computed(() => {
  if (!split.value?.cashback) return []
  const shares = equalShares(split.value.cashback, split.value.members.length)
  return split.value.members.map((m, i) => ({
    contactId: m.contactId,
    amount: shares[i] ?? 0,
    held: m.status === 'debt',
  }))
})

function nameOf(cid: string): string {
  return cid === 'me' ? (user.user?.name ?? t('members.youShort')) : (contacts.byId(cid)?.name ?? '?')
}

function colorOf(cid: string): string {
  return cid === 'me' ? '#111110' : (contacts.byId(cid)?.color ?? '#8A887E')
}

const reason = computed(() => {
  const n = split.value?.members.length ?? 0
  return n === 2 ? t('cashbackAward.reasonTwo') : n === 3 ? t('cashbackAward.reasonThree') : t('cashbackAward.reasonMany')
})

function spend() {
  toast.success(t('cashbackAward.spendToast'))
  router.push('/')
}
</script>

<template>
  <div v-if="split" class="flex min-h-dvh flex-col bg-paper px-6 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[17px] font-semibold"
      @click="router.push('/')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <div class="mt-[30px]">
      <img v-if="isBellissimo" :src="bellissimoLogo" alt="" class="merchant-img -ml-2 h-[76px] w-[76px] object-cover" />
      <div v-else class="remind-chip flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ink text-[26px] font-extrabold text-lime">
        {{ merchant?.letter ?? split.title[0]?.toUpperCase() }}
      </div>
      <h1 class="mt-2.5 text-[25px] font-extrabold tracking-[-0.01em]">{{ t('cashbackAward.title') }}</h1>
      <p class="mt-[5px] text-[13.5px] font-semibold text-muted">
        {{ merchant?.name ?? split.title }}<template v-if="split.bill">{{ t('live.orderNo', { no: split.bill.orderNo }) }}</template><template v-if="group"> · {{ group.name }}</template>
      </p>
      <div class="mt-6 flex items-baseline gap-2">
        <span class="text-[48px] font-extrabold leading-none tracking-[-0.03em]">
          <CountUp :value="split.cashback ?? 0" prefix="+" :duration="1200" class="font-sans" />
        </span>
        <span class="font-mono text-[11px] font-bold text-faint-2">UZS</span>
      </div>
      <div v-if="split.cashbackX2" class="mt-3.5 flex h-[34px] w-fit items-center rounded-full bg-lime px-3.5 text-on-lime">
        <span class="text-[12.5px] font-extrabold">{{ reason }}</span>
      </div>
    </div>

    <div class="mt-[26px] border-t border-sand-2 pt-1.5">
      <div
        v-for="(p, i) in perMember"
        :key="p.contactId"
        class="flex min-h-[58px] items-center gap-3"
        :class="i < perMember.length - 1 && 'border-b border-sand-2'"
      >
        <ZapAvatar :name="nameOf(p.contactId)" :color="colorOf(p.contactId)" :contact-id="p.contactId" class="h-[38px] w-[38px]" size="sm" />
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="text-[15px] font-bold">{{ nameOf(p.contactId) }}<template v-if="p.contactId === 'me'">{{ t('live.youSuffix') }}</template></span>
          <span v-if="p.held" class="text-[12px] font-semibold text-faint">{{ t('cashbackAward.afterDebt') }}</span>
        </div>
        <span class="text-[15px] font-extrabold" :class="p.held ? 'text-faint' : ''">+{{ money(p.amount) }}</span>
      </div>
    </div>

    <div v-if="group" class="mt-5 flex items-baseline justify-between">
      <span class="text-[14.5px] font-bold text-muted">{{ t('cashbackAward.groupTotalLabel', { name: group.name }) }}</span>
      <span class="text-[19px] font-extrabold">{{ money(group.cashback) }}</span>
    </div>

    <div class="flex-1" />

    <div class="flex flex-col gap-2.5">
      <button type="button" class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime" @click="spend">
        {{ t('cashbackAward.spend') }}
      </button>
      <button type="button" class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink" @click="router.push('/')">
        {{ t('cashbackAward.keep') }}
      </button>
    </div>
  </div>
</template>
