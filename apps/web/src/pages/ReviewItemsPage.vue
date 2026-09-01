<script setup lang="ts">
// Проверка позиций фискального/OCR-чека перед сплитом: редактирование названия
// и суммы, степпер количества, удаление, добавление; живой индикатор
// «сумма позиций vs итог чека». Пользователь может продолжить и при расхождении —
// сплит использует ОТРЕДАКТИРОВАННЫЕ позиции.
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { money } from '@/lib/format'
import { useDraftStore } from '@/entities/stores/draft'
import AnimatedList from '@/components/AnimatedList.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import AmountField from '@/components/AmountField.vue'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const draft = useDraftStore()

interface EditItem {
  id: string
  title: string
  qty: number
  amount: number
}

const items = reactive<EditItem[]>(
  (draft.bill?.items ?? []).map((i) => ({ id: i.id, title: i.title, qty: i.qty, amount: i.amount })),
)

if (!draft.bill || draft.source !== 'fiscal') router.replace('/split/scan')

const isOcr = computed(() => draft.fiscal?.ocr === true)
const receiptTotal = computed(() => draft.fiscal?.receiptTotal ?? draft.bill?.total ?? 0)
const itemsSum = computed(() => items.reduce((s, i) => s + i.amount, 0))
const diff = computed(() => itemsSum.value - receiptTotal.value)

function stepQty(item: EditItem, delta: number) {
  const perUnit = item.qty > 0 ? item.amount / item.qty : item.amount
  const next = Math.max(item.qty + delta, item.qty >= 1 ? Math.max(1, item.qty + delta) : 0.5)
  if (delta < 0 && item.qty <= 1) return
  item.amount = Math.round(perUnit * next)
  item.qty = next
}

function remove(id: string) {
  const i = items.findIndex((x) => x.id === id)
  if (i >= 0) items.splice(i, 1)
}

// редактирование позиции (имя + сумма) в шите
const editing = ref<EditItem | null>(null)
const editTitle = ref('')
const editAmount = ref('')

function openEdit(item: EditItem) {
  editing.value = item
  editTitle.value = item.title
  editAmount.value = String(item.amount)
}

function commitEdit() {
  if (editing.value) {
    editing.value.title = editTitle.value.trim() || editing.value.title
    editing.value.amount = Number(editAmount.value || '0') || editing.value.amount
  }
  editing.value = null
}

let addSeq = 0
function addItem() {
  const it: EditItem = { id: `new_${++addSeq}_${Date.now().toString(36)}`, title: '', qty: 1, amount: 0 }
  items.push(it)
  openEdit(it)
}

function proceed() {
  // сплит использует отредактированные позиции; итог = их сумма
  draft.applyFiscalItems(
    {
      merchant: draft.fiscal?.merchant,
      total: itemsSum.value,
      items: items.filter((i) => i.title && i.amount > 0).map((i) => ({ id: i.id, name: i.title, qty: i.qty, amount: i.amount })),
    },
    isOcr.value,
  )
  router.push('/split/members')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-5 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand"
      @click="router.back()"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <h1 class="mt-[22px] text-[25px] font-extrabold tracking-[-0.01em]">{{ t('review.title') }}</h1>
    <div
      v-if="isOcr"
      class="mt-3 flex items-center gap-2.5 rounded-inner bg-lime/25 px-4 py-3 text-[12.5px] font-bold"
    >
      <span>📷</span>
      <span>{{ t('review.fromPhoto') }}</span>
    </div>
    <p v-else class="mt-1.5 text-[13px] font-semibold text-muted">{{ t('review.fromReceipt') }}</p>

    <div class="mt-4 flex-1">
      <AnimatedList tag="div">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex min-h-[56px] items-center gap-2.5 border-b border-sand-2"
        >
          <button type="button" class="min-w-0 flex-1 py-2 text-left" @click="openEdit(item)">
            <span class="block truncate text-[14.5px] font-bold">{{ item.title || t('review.untitled') }}</span>
            <span class="block text-[11.5px] font-semibold text-faint">{{ money(item.amount) }} UZS</span>
          </button>
          <div class="flex shrink-0 items-center gap-1.5">
            <button type="button" class="press flex h-8 w-8 items-center justify-center rounded-full bg-sand text-[15px] font-bold" @click="stepQty(item, -1)">−</button>
            <span class="min-w-[34px] text-center font-mono text-[12.5px] font-bold">{{ item.qty }}</span>
            <button type="button" class="press flex h-8 w-8 items-center justify-center rounded-full bg-sand text-[15px] font-bold" @click="stepQty(item, 1)">+</button>
          </div>
          <button
            type="button"
            :aria-label="t('common.removeAria')"
            class="press relative hit-area-y flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted"
            @click="remove(item.id)"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="m3.5 3.5 7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          </button>
        </div>
      </AnimatedList>
      <button type="button" class="press mt-3 flex h-11 items-center gap-2 text-[13.5px] font-bold text-muted" @click="addItem">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-sand">+</span>
        {{ t('review.addItem') }}
      </button>
    </div>

    <!-- индикатор: сумма позиций vs итог чека -->
    <div class="mt-4 flex items-center justify-between rounded-inner px-4 py-3.5" :class="diff === 0 ? 'bg-lime/25' : 'bg-shell'">
      <span class="text-[13px] font-bold">
        <template v-if="diff === 0">
          <span class="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-lime align-middle">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          {{ t('review.matches') }}
        </template>
        <template v-else>
          <span class="text-muted">{{ t('review.diff', { sign: diff > 0 ? '+' : '−', amount: money(Math.abs(diff)) }) }}</span>
        </template>
      </span>
      <span class="font-mono text-[14px] font-extrabold">{{ money(itemsSum) }}</span>
    </div>

    <button
      type="button"
      class="press mt-3 h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
      :disabled="!items.length || itemsSum <= 0"
      @click="proceed"
    >
      {{ t('review.continueWith', { amount: money(itemsSum) }) }}
    </button>

    <!-- редактирование позиции -->
    <BottomSheet :open="Boolean(editing)" @close="commitEdit">
      <div class="pb-4">
        <p class="text-center text-[15px] font-extrabold">{{ t('review.itemTitle') }}</p>
        <label class="mt-4 flex items-center border-b-2 border-lime pb-2.5">
          <input
            v-model="editTitle"
            type="text"
            :placeholder="t('review.namePlaceholder')"
            class="w-full bg-transparent text-[16px] font-bold outline-none [caret-color:#DDFF33] placeholder:text-faint"
          />
        </label>
        <p class="mt-4 text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('review.amountLabel') }}</p>
        <AmountField v-model="editAmount" class="mt-1" display-class="text-[26px]" placeholder-zero />
        <button type="button" class="press mt-5 h-12 w-full rounded-full bg-ink text-[15px] font-bold text-paper" @click="commitEdit">
          {{ t('common.done') }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
