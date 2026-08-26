<script setup lang="ts">
// Дизайн 3e: белый экран-чек Bellissimo — логотип, пунктирные разделители,
// позиции, итого, плашка кэшбэка, CTA «Разделить» / «Оплатить целиком».
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money } from '@/lib/format'
import { useDraftStore } from '@/entities/stores/draft'
import { useContactsStore } from '@/entities/stores/contacts'
import { useSplitsStore } from '@/entities/stores/splits'
import PinSheet from '@/components/PinSheet.vue'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'

const router = useRouter()
const draft = useDraftStore()
const contacts = useContactsStore()
const splits = useSplitsStore()

const bill = computed(() => draft.bill)
const merchant = computed(() => contacts.merchantById(bill.value?.merchantId))

const payWholeSheet = ref(false)
const paying = ref(false)

if (!draft.bill) router.replace('/split/scan')

async function confirmPayWhole() {
  payWholeSheet.value = false
  if (paying.value || !bill.value) return
  paying.value = true
  // соло-сплит: один участник, закрывается сразу → экран «Готово»
  const split = await splits.create({
    title: 'Счёт целиком',
    total: bill.value.total,
    mode: 'equal',
    merchantId: bill.value.merchantId,
    bill: bill.value,
    members: [{ contactId: 'me', amount: bill.value.total }],
  })
  toast.success('Оплачено · ' + money(bill.value.total))
  router.replace('/split/' + split.id + '/closed')
}
</script>

<template>
  <div v-if="bill" class="flex min-h-dvh flex-col bg-paper px-5 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      aria-label="Назад"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[17px] font-semibold"
      @click="router.push('/split/scan')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <div class="mt-[26px] px-1">
      <div class="flex flex-col items-start gap-1.5">
        <img :src="bellissimoLogo" alt="Bellissimo Pizza" class="merchant-img -ml-2.5 h-[84px] w-[84px] object-cover" />
        <h1 class="text-[19px] font-extrabold">{{ merchant?.name ?? 'Bellissimo Pizza' }}</h1>
        <p class="font-mono text-[9.5px] font-bold tracking-[0.12em] text-faint-2">
          ЗАКАЗ #{{ bill.orderNo }} · СТОЛ {{ bill.table }} · {{ bill.time }}
        </p>
      </div>

      <div class="mt-4 border-t-2 border-dashed border-hairline" />

      <div class="mt-2.5 flex flex-col">
        <div
          v-for="item in bill.items"
          :key="item.id"
          class="flex min-h-[34px] items-center justify-between"
        >
          <span class="text-[14px] font-semibold">
            {{ item.title }}<template v-if="item.qty > 1"> ×{{ item.qty }}</template>
          </span>
          <span class="font-mono text-[12.5px] font-bold tabular-nums">{{ money(item.amount) }}</span>
        </div>
      </div>

      <div class="mt-2.5 border-t-2 border-dashed border-hairline" />

      <div class="mt-3.5 flex items-baseline justify-between">
        <span class="text-[15px] font-extrabold">Итого</span>
        <span class="flex items-baseline gap-1.5">
          <span class="text-[19px] font-extrabold tracking-[-0.01em]">{{ money(bill.total) }}</span>
          <span class="font-mono text-[10px] font-bold text-faint-2">UZS</span>
        </span>
      </div>

      <div class="mt-3 flex h-9 items-center gap-2 rounded-full bg-shell px-3.5">
        <span class="text-[12.5px] font-bold">{{ bill.promo }}</span>
      </div>
    </div>

    <div class="flex-1" />

    <div class="flex flex-col gap-2.5">
      <button
        type="button"
        class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime"
        @click="router.push('/split/members')"
      >
        Разделить
      </button>
      <button
        type="button"
        class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink"
        @click="payWholeSheet = true"
      >
        Оплатить целиком
      </button>
    </div>

    <PinSheet
      :open="payWholeSheet"
      :hint="`Оплата целиком · ${money(bill.total)} UZS · ${merchant?.name ?? 'Bellissimo'}`"
      @close="payWholeSheet = false"
      @confirm="confirmPayWhole"
    />
  </div>
</template>
