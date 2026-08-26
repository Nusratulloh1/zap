<script setup lang="ts">
// Дизайн 3e: белый экран-чек Bellissimo — логотип, пунктирные разделители,
// позиции, итого, плашка кэшбэка, CTA «Разделить» / «Оплатить целиком».
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money } from '@/lib/format'
import { clientFetchAvailable, fetchReceiptOnDevice } from '@/lib/fiscalClient'
import { useDraftStore } from '@/entities/stores/draft'
import { useContactsStore } from '@/entities/stores/contacts'
import { useSplitsStore } from '@/entities/stores/splits'
import PinSheet from '@/components/PinSheet.vue'
import bellissimoLogo from '@/assets/brand/partners/bellissimo.png'
import { onBeforeUnmount, onMounted } from 'vue'
import { bus } from '@/lib/bus'
import * as api from '@/api'

const router = useRouter()
const draft = useDraftStore()
const contacts = useContactsStore()
const splits = useSplitsStore()

const bill = computed(() => draft.bill)
const merchant = computed(() => contacts.merchantById(bill.value?.merchantId))

const payWholeSheet = ref(false)
const paying = ref(false)

// --- фискальный чек: позиции догружаются асинхронно, флоу не блокируется ---
const fiscal = computed(() => draft.fiscal)
const isFiscal = computed(() => draft.source === 'fiscal')
const fiscalLoading = computed(() => isFiscal.value && fiscal.value?.status === 'pending')
const fiscalFailed = computed(() => isFiscal.value && fiscal.value?.status === 'failed')
// узбекский чек не несёт суммы в QR — при неудаче фетча тотала нет вовсе
const fiscalNoTotal = computed(() => fiscalFailed.value && !bill.value?.total)

async function loadFiscalResult() {
  if (!draft.fiscal?.jobId) return
  try {
    const res = await api.fiscalStatus(draft.fiscal.jobId)
    if (res.status === 'ready' && res.receipt) draft.applyFiscalItems(res.receipt as never, false)
    else if (res.status === 'failed') draft.fiscalFailed()
  } catch {
    draft.fiscalFailed()
  }
}

let fiscalTimeout = 0
const offFiscal = bus.on('fiscal:update', ({ jobId, status }) => {
  if (jobId !== draft.fiscal?.jobId) return
  clearTimeout(fiscalTimeout)
  if (status === 'ready') void loadFiscalResult()
  else draft.fiscalFailed()
})

// БЫСТРЫЙ ПУТЬ: телефон пользователя (узбекский IP) сам забирает чек с ОФД и
// перепроверенный сервером результат возвращается сразу — без ожидания сервера,
// который к соликом заблокирован. Неудача → тихо в серверный/таймаут-фолбэк.
async function tryClientFetch(): Promise<boolean> {
  const url = draft.scannedPayload
  if (!url || !clientFetchAvailable()) return false
  const receipt = await fetchReceiptOnDevice(url)
  if (!receipt) return false
  try {
    const res = await api.submitFiscalClientResult(receipt)
    if (res.status === 'ready' && res.receipt) {
      draft.applyFiscalItems(res.receipt as never, false)
      return true
    }
  } catch {
    /* сервер отверг — уходим в фолбэк */
  }
  return false
}

onMounted(() => {
  if (isFiscal.value && draft.fiscal?.status === 'pending') {
    void tryClientFetch().then((ok) => {
      if (ok || draft.fiscal?.status !== 'pending') return
      // клиентский путь не сработал → ждём сервер по сокету, иначе таймаут-фейл
      fiscalTimeout = window.setTimeout(() => void loadFiscalResult().then(() => {
        if (draft.fiscal?.status === 'pending') draft.fiscalFailed()
      }), 8_000)
    })
  }
})
onBeforeUnmount(() => {
  clearTimeout(fiscalTimeout)
  offFiscal()
})

// 📷 OCR-фолбэк: фото чека → позиции → экран проверки
const ocrBusy = ref(false)
async function onOcrFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || ocrBusy.value) return
  ocrBusy.value = true
  try {
    const res = await api.fiscalOcr(file)
    if (res.receipt) {
      draft.applyFiscalItems(res.receipt as never, true)
      toast.success('Чек распознан с фото')
      router.push('/split/review')
    }
  } catch (err) {
    toast(err instanceof Error && err.message ? err.message : 'Не удалось распознать фото')
  } finally {
    ocrBusy.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

function toSplit() {
  // фискальные/OCR позиции обязаны пройти экран проверки перед сплитом
  if (isFiscal.value && bill.value?.items.length) router.push('/split/review')
  else router.push('/split/members')
}

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
        <template v-if="isFiscal">
          <span class="flex h-[64px] w-[64px] items-center justify-center rounded-[18px] bg-ink text-[24px] font-extrabold text-lime">
            {{ (fiscal?.merchant ?? 'Ч')[0] }}
          </span>
          <!-- пока чек грузится и продавец неизвестен — скелетон вместо заглушки -->
          <span v-if="fiscalLoading && !fiscal?.merchant" class="zap-skeleton mt-0.5 h-6 w-40 animate-pulse rounded-md bg-stone/60" />
          <h1 v-else class="text-[19px] font-extrabold">{{ fiscal?.merchant ?? 'Фискальный чек' }}</h1>
          <p class="font-mono text-[9.5px] font-bold tracking-[0.12em] text-faint-2">ЧЕК ИЗ QR · ОФД</p>
          <!-- DEBUG: отсканированная ссылка (временно) -->
          <p v-if="draft.scannedPayload" class="mt-1.5 max-w-full break-all rounded-md bg-shell px-2 py-1 font-mono text-[9px] leading-tight text-muted">
            🐛 {{ draft.scannedPayload }}
          </p>
        </template>
        <template v-else>
          <img :src="bellissimoLogo" alt="Bellissimo Pizza" class="merchant-img -ml-2.5 h-[84px] w-[84px] object-cover" />
          <h1 class="text-[19px] font-extrabold">{{ merchant?.name ?? 'Bellissimo Pizza' }}</h1>
          <p class="font-mono text-[9.5px] font-bold tracking-[0.12em] text-faint-2">
            ЗАКАЗ #{{ bill.orderNo }} · СТОЛ {{ bill.table }} · {{ bill.time }}
          </p>
        </template>
      </div>

      <div class="mt-4 border-t-2 border-dashed border-hairline" />

      <!-- фискальный чек: позиции догружаются — скелетон; фейл — тихие чипы -->
      <div v-if="isFiscal && fiscal?.status === 'pending'" class="mt-2.5 flex flex-col gap-2.5 py-1">
        <p class="text-[12.5px] font-semibold text-muted">Получаем чек…</p>
        <div v-for="i in 3" :key="i" class="flex items-center justify-between">
          <span class="zap-skeleton h-4 animate-pulse rounded-md bg-stone/60" :style="{ width: 120 + i * 30 + 'px' }" />
          <span class="zap-skeleton h-4 w-16 animate-pulse rounded-md bg-stone/60" />
        </div>
      </div>
      <div v-else-if="fiscalFailed" class="mt-2.5 rounded-inner bg-shell px-4 py-4">
        <p class="text-[14px] font-bold">Чек не загрузился</p>
        <p class="mt-0.5 text-[12.5px] font-semibold leading-snug text-muted">
          {{ fiscalNoTotal ? 'Сфотографируйте чек или введите сумму вручную' : 'Сумма чека уже есть — можно продолжать' }}
        </p>
        <div class="mt-3.5 flex flex-col gap-2">
          <label class="press flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-bold text-paper">
            <span>📷</span> Сфотографировать чек
            <input type="file" accept="image/*" capture="environment" class="hidden" @change="onOcrFile" />
          </label>
          <button
            type="button"
            class="press h-12 w-full rounded-full bg-sand text-[14px] font-bold text-ink"
            @click="fiscalNoTotal ? router.push('/split/amount') : router.push('/split/members')"
          >
            {{ fiscalNoTotal ? 'Ввести сумму вручную' : `Продолжить с суммой · ${money(bill.total)}` }}
          </button>
        </div>
      </div>
      <div v-else class="mt-2.5 flex flex-col">
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

      <!-- «Итого» скрываем, когда суммы нет вовсе (фискальный фейл без тотала) -->
      <template v-if="!fiscalNoTotal">
        <div class="mt-2.5 border-t-2 border-dashed border-hairline" />
        <div class="mt-3.5 flex items-baseline justify-between">
          <span class="text-[15px] font-extrabold">Итого</span>
          <!-- тотал приходит вместе с чеком: пока грузится — скелетон, не «0» -->
          <span v-if="fiscalLoading && !bill.total" class="zap-skeleton h-5 w-24 animate-pulse rounded-md bg-stone/60" />
          <span v-else class="flex items-baseline gap-1.5">
            <span class="text-[19px] font-extrabold tracking-[-0.01em]">{{ money(bill.total) }}</span>
            <span class="font-mono text-[10px] font-bold text-faint-2">UZS</span>
          </span>
        </div>
      </template>

      <div v-if="!isFiscal && bill.promo" class="mt-3 flex h-9 items-center gap-2 rounded-full bg-shell px-3.5">
        <span class="text-[12.5px] font-bold">{{ bill.promo }}</span>
      </div>
    </div>

    <div class="flex-1" />

    <!-- при фискальном фейле без суммы действия — это чипы в карточке выше -->
    <div v-if="!fiscalNoTotal" class="flex flex-col gap-2.5">
      <button
        type="button"
        class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="fiscalLoading"
        @click="toSplit"
      >
        Разделить
      </button>
      <button
        type="button"
        class="press h-14 rounded-full bg-sand text-[16px] font-bold text-ink disabled:opacity-40"
        :disabled="fiscalLoading"
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
