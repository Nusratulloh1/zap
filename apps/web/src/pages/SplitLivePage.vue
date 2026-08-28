<script setup lang="ts">
// Дизайн 3f: живой статус — сумма 42px, прогресс с чёрной точкой,
// участники с фото (ожидающий — grayscale), CTA «Напомнить N» / «Покрыть остаток».
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money } from '@/lib/format'
import { useSplitsStore } from '@/entities/stores/splits'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import ZapAvatar from '@/components/ZapAvatar.vue'
import PinSheet from '@/components/PinSheet.vue'
import CountUp from '@/components/CountUp.vue'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const splits = useSplitsStore()
const contacts = useContactsStore()
const user = useUserStore()

const id = computed(() => String(route.params.id))
const split = computed(() => splits.byId(id.value))
const merchant = computed(() => contacts.merchantById(split.value?.merchantId))

// был ли сплит активен при открытии — тогда закрытие анимируем переходом
const wasActive = ref(false)

onMounted(async () => {
  await Promise.all([splits.hydrate(), contacts.hydrate(), user.hydrate()])
  wasActive.value = split.value?.status === 'active'
})

watch(
  () => split.value?.status,
  (status) => {
    if (status === 'closed' && wasActive.value) {
      setTimeout(() => router.replace(`/split/${id.value}/closed`), 900)
    }
  },
)

const paidAmount = computed(() =>
  (split.value?.members ?? [])
    .filter((m) => m.status === 'paid' || m.status === 'debt')
    .reduce((s, m) => s + m.amount, 0),
)

const progress = computed(() => (split.value ? paidAmount.value / split.value.total : 0))

const remainder = computed(() =>
  (split.value?.members ?? [])
    .filter((m) => m.status !== 'paid' && m.status !== 'debt')
    .reduce((s, m) => s + m.amount, 0),
)

const pendingMembers = computed(() =>
  (split.value?.members ?? []).filter((m) => m.status === 'waiting' || m.status === 'opened'),
)

function nameOf(cid: string): string {
  return cid === 'me' ? (user.user?.name ?? t('members.youShort')) : (contacts.byId(cid)?.name ?? '?')
}

function colorOf(cid: string): string {
  return cid === 'me' ? '#111110' : (contacts.byId(cid)?.color ?? '#8A887E')
}



const remindedIds = ref<Set<string>>(new Set())

async function remind(cid: string) {
  remindedIds.value = new Set([...remindedIds.value, cid])
  try {
    await splits.remindMember(id.value, cid)
    toast.success(t('live.reminded'))
  } catch (e) {
    // сервер троттлит повторы (30 мин) — показываем его сообщение, кнопка остаётся «отправлено»
    toast(e instanceof Error ? e.message : t('debts.alreadyReminded'))
  }
}

const coverSheet = ref(false)
const covering = ref(false)

async function confirmCover() {
  coverSheet.value = false
  if (covering.value) return
  covering.value = true
  await splits.coverRemainder(id.value)
  covering.value = false
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-5 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[17px] font-semibold"
      @click="router.push('/')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <template v-if="split">
      <div class="flex flex-col items-start gap-1.5 px-0.5 pb-1.5 pt-[26px]">
        <p class="text-[13.5px] font-semibold text-muted">
          {{ merchant?.name ?? split.title }}<template v-if="split.bill">{{ t('live.orderNo', { no: split.bill.orderNo }) }}</template>
        </p>
        <CountUp :value="paidAmount" :duration="600" class="block text-[42px] font-extrabold leading-none tracking-[-0.03em]" />
        <p class="text-[13px] font-semibold text-faint">{{ t('live.paidOfTotal', { total: money(split.total) }) }}</p>
        <div class="mt-3 flex h-2.5 w-full items-center rounded-full bg-pebble">
          <div class="h-2.5 rounded-full bg-lime transition-all duration-700 ease-zap" :style="{ width: progress * 100 + '%' }" />
          <div class="-ml-[5px] h-2.5 w-2.5 rounded-full bg-ink" />
        </div>
      </div>

      <!-- участники -->
      <div class="mt-2 px-0.5 py-1">
        <div
          v-for="(m, i) in split.members"
          :key="m.contactId"
          class="flex min-h-[64px] items-center gap-3"
          :class="i < split.members.length - 1 && 'border-b border-sand-2'"
        >
          <ZapAvatar
            :name="nameOf(m.contactId)"
            :color="colorOf(m.contactId)"
            :contact-id="m.contactId"
            class="h-10 w-10"
            :class="m.status === 'waiting' || m.status === 'opened' ? 'opacity-80 grayscale' : ''"
            size="sm"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-px">
            <span class="text-[15px] font-bold">{{ nameOf(m.contactId) }}<template v-if="m.isYou">{{ t('live.youSuffix') }}</template></span>
            <span class="text-[12px] font-semibold text-faint">
              {{ money(m.amount) }}<template v-if="m.status === 'opened'">{{ t('live.openedLink') }}</template><template v-else-if="m.status === 'debt'">{{ t('live.debtCovered') }}</template>
            </span>
          </div>
          <span
            v-if="m.status === 'paid' || m.status === 'debt'"
            class="flex h-[30px] items-center gap-[5px] rounded-full bg-ink px-3"
          >
            <span class="text-[11px] font-extrabold text-lime">✓</span>
            <span class="text-[12px] font-bold text-paper">{{ m.status === 'debt' ? t('live.debtBadge') : t('live.statusPaid') }}</span>
          </span>
          <span v-else class="flex h-[30px] items-center rounded-full bg-pebble px-3 text-[12px] font-bold text-muted">
            {{ t('live.statusWaiting') }}
          </span>
        </div>
      </div>

      <div class="flex-1" />

      <div v-if="split.status === 'active'" class="flex flex-col gap-2.5">
        <button
          v-for="m in pendingMembers"
          :key="m.contactId"
          type="button"
          class="press h-14 rounded-full bg-ink text-[16px] font-extrabold text-paper disabled:opacity-40"
          :disabled="remindedIds.has(m.contactId)"
          @click="remind(m.contactId)"
        >
          {{ remindedIds.has(m.contactId) ? t('live.reminded') : t('live.remind', { name: nameOf(m.contactId) }) }}
        </button>
        <button
          v-if="remainder > 0"
          type="button"
          class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink disabled:opacity-40"
          :disabled="covering"
          @click="coverSheet = true"
        >
          {{ t('live.coverRest', { amount: money(remainder) }) }}
        </button>
      </div>
    </template>

    <PinSheet
      :open="coverSheet"
      :hint="merchant
        ? t('live.pinHintMerchant', { amount: money(remainder), merchant: merchant.name })
        : t('live.pinHint', { amount: money(remainder) })"
      @close="coverSheet = false"
      @confirm="confirmCover"
    />
  </div>
</template>
