<script setup lang="ts">
import VenueIcon from '@/components/VenueIcon.vue'
// Дизайн 5f: группа — стек аватаров + название, «Новый сплит»/«Позвать»,
// КЭШБЭК ГРУППЫ с логотипами партнёров, УЧАСТНИКИ, СПЛИТЫ ГРУППЫ.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, peopleCount } from '@/lib/format'
import { dateShort, humanDateLc } from '@/lib/datetime'
import { useGroupsStore } from '@/entities/stores/groups'
import { useContactsStore } from '@/entities/stores/contacts'
import { useSplitsStore } from '@/entities/stores/splits'
import { useDebtsStore } from '@/entities/stores/debts'
import { useUserStore } from '@/entities/stores/user'
import { useDraftStore } from '@/entities/stores/draft'
import { fetchFeaturedBill, renameGroup, deleteGroup } from '@/api'
import BottomSheet from '@/components/BottomSheet.vue'
import ZapAvatar from '@/components/ZapAvatar.vue'
import partnerSafia from '@/assets/brand/partners/safia.png'
import partnerTexnomart from '@/assets/brand/partners/texnomart.png'
import partnerIdea from '@/assets/brand/partners/idea.png'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const groups = useGroupsStore()
const contacts = useContactsStore()
const splits = useSplitsStore()
const debts = useDebtsStore()
const user = useUserStore()
const draft = useDraftStore()

const id = computed(() => String(route.params.id))
const group = computed(() => groups.byId(id.value))

onMounted(() => {
  void groups.hydrate()
  void contacts.hydrate()
  void splits.hydrate()
  void debts.hydrate()
  void user.hydrate()
})

const groupSplits = computed(() => splits.splits.filter((s) => s.groupId === id.value))

function nameOf(cid: string): string {
  return cid === 'me' ? (user.user?.name ?? t('members.youShort')) : (contacts.byId(cid)?.name ?? '?')
}

function colorOf(cid: string): string {
  return cid === 'me' ? '#111110' : (contacts.byId(cid)?.color ?? '#8A887E')
}

function debtOf(cid: string): number {
  return debts.openDebts.filter((d) => d.contactId === cid).reduce((s, d) => s + d.amount, 0)
}

function memberSub(cid: string): string {
  const debt = debtOf(cid)
  if (debt > 0) return t('group.owes', { amount: money(debt) })
  const n = groupSplits.value.filter((s) => s.members.some((m) => m.contactId === cid)).length
  return t('group.allClosed', n, { named: { n } })
}



const splitDate = (ts: number) => humanDateLc(ts)

const reminded = ref<Set<string>>(new Set())

async function remind(cid: string) {
  reminded.value = new Set([...reminded.value, cid])
  const debt = debts.openDebts.find((d) => d.contactId === cid)
  try {
    if (debt) await debts.remind(debt.id)
    toast.success(t('debts.remindedToast'))
  } catch (e) {
    toast(e instanceof Error ? e.message : t('debts.alreadyReminded'))
  }
}

async function newSplit() {
  if (!group.value) return
  const bill = contacts.featuredBill ?? (await fetchFeaturedBill())
  draft.startForGroup(bill, group.value.memberIds)
  router.push('/split/bill')
}

async function invite() {
  const url = location.origin + '/g/' + id.value
  if (navigator.share) {
    try {
      await navigator.share({ title: group.value?.name ?? 'ZAP!', text: t('group.shareText'), url })
      return
    } catch {
      /* закрыли шэр */
    }
  } else {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* noop */
    }
    toast.success(t('common.copied'))
  }
}

// «⋯» меню: переименовать / удалить
const menuSheet = ref(false)
const renameSheet = ref(false)
const renameValue = ref('')
const confirmDelete = ref(false)

function openRename() {
  menuSheet.value = false
  renameValue.value = group.value?.name ?? ''
  renameSheet.value = true
}

async function applyRename() {
  if (!renameValue.value.trim()) return
  await renameGroup(id.value, renameValue.value.trim())
  renameSheet.value = false
  toast.success(t('group.renamed'))
}

async function applyDelete() {
  await deleteGroup(id.value)
  confirmDelete.value = false
  toast.success(t('group.deleted'))
  router.replace('/')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-paper px-6 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
    <div class="flex items-center justify-between">
      <button
        type="button"
        :aria-label="t('common.backAria')"
        class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
        @click="router.push('/')"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <button type="button" :aria-label="t('group.menuAria')" class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[17px] font-bold text-slate" @click="menuSheet = true">
        ⋯
      </button>
    </div>

    <template v-if="group">
      <div class="mt-[22px] flex items-center gap-3.5">
        <div class="flex">
          <ZapAvatar
            v-for="(cid, i) in group.memberIds.slice(0, 3)"
            :key="cid"
            :name="nameOf(cid)"
            :color="colorOf(cid)"
            :contact-id="cid"
            class="h-[46px] w-[46px] border-[2.5px] border-paper"
            :class="i > 0 ? '-ml-3.5' : ''"
            size="md"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <h1 class="text-[22px] font-extrabold tracking-[-0.01em]">{{ group.name }}</h1>
          <p class="text-[12.5px] font-semibold text-faint">{{ t('group.sinceWith', { people: peopleCount(group.memberIds.length), date: dateShort(group.createdAt) }) }}</p>
        </div>
      </div>

      <div class="mt-5 flex gap-2.5">
        <button type="button" class="press h-[50px] flex-1 rounded-full bg-lime text-[15px] font-extrabold text-on-lime" @click="newSplit">
          {{ t('group.newSplit') }}
        </button>
        <button type="button" class="press h-[50px] flex-1 rounded-full bg-sand text-[15px] font-bold text-ink" @click="invite">
          {{ t('group.invite') }}
        </button>
      </div>

      <!-- кэшбэк группы -->
      <div class="mt-6 border-t border-sand-2 pt-5">
        <p class="font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('group.cashback') }}</p>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="text-[36px] font-extrabold leading-none tracking-[-0.02em]">{{ money(group.cashback) }}</span>
          <span class="font-mono text-[10.5px] font-bold text-faint-2">UZS</span>
        </div>
        <div class="mt-3 flex items-center">
          <img :src="partnerSafia" alt="Safia" class="h-7 w-auto rounded-[9px]" />
          <img :src="partnerTexnomart" alt="texnomart" class="-ml-2.5 h-7 w-auto rounded-[9px]" />
          <img :src="partnerIdea" alt="idea" class="-ml-2.5 h-7 w-auto rounded-[9px]" />
          <span class="ml-3 text-[12.5px] font-semibold text-muted">{{ t('group.merchantsCount', group.merchantsCount, { named: { n: group.merchantsCount } }) }}</span>
        </div>
      </div>

      <!-- участники -->
      <div class="mt-[22px] border-t border-sand-2 pt-[18px]">
        <p class="font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('group.members') }}</p>
        <div class="mt-2 flex flex-col">
          <div v-for="cid in group.memberIds" :key="cid" class="flex min-h-[58px] items-center gap-3">
            <ZapAvatar :name="nameOf(cid)" :color="colorOf(cid)" :contact-id="cid" class="h-10 w-10" size="sm" />
            <div class="flex min-w-0 flex-1 flex-col gap-px">
              <span class="text-[15px] font-bold">{{ nameOf(cid) }}<template v-if="cid === 'me'">{{ t('group.youSuffix') }}</template></span>
              <span class="text-[12px] font-semibold text-faint">{{ cid === 'me' ? t('group.allClosed', groupSplits.length, { named: { n: groupSplits.length } }) : memberSub(cid) }}</span>
            </div>
            <span v-if="cid === group.ownerId" class="flex h-7 items-center rounded-full bg-sand px-3 text-[11.5px] font-bold text-muted">{{ t('group.owner') }}</span>
            <button
              v-else-if="debtOf(cid) > 0"
              type="button"
              class="remind-chip press flex h-[30px] items-center rounded-full bg-ink px-3 text-[12px] font-bold text-lime disabled:opacity-50"
              :disabled="reminded.has(cid)"
              @click="remind(cid)"
            >
              {{ reminded.has(cid) ? t('group.reminded') : t('group.remind') }}
            </button>
          </div>
        </div>
      </div>

      <!-- сплиты группы -->
      <div class="mt-[18px] border-t border-sand-2 pt-[18px]">
        <div class="flex items-baseline justify-between">
          <p class="font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('group.splits') }}</p>
          <button type="button" class="text-[13px] font-bold text-muted" @click="router.push('/history')">{{ t('home.seeAll') }}</button>
        </div>
        <div class="mt-1.5 flex flex-col">
          <div
            v-for="s in groupSplits"
            :key="s.id"
            class="flex min-h-[58px] cursor-pointer items-center gap-3"
            @click="router.push(`/split/${s.id}`)"
          >
            <VenueIcon :name="contacts.merchantById(s.merchantId)?.name ?? s.title" size="md" />
            <div class="flex min-w-0 flex-1 flex-col gap-px">
              <span class="truncate text-[15px] font-bold">
                {{ contacts.merchantById(s.merchantId)?.name ?? s.title }}<template v-if="s.bill"> · #{{ s.bill.orderNo }}</template>
              </span>
              <span class="text-[12px] font-semibold text-faint">
                {{ splitDate(s.createdAt) }}<template v-if="s.cashback">{{ t('group.splitCashback', { amount: money(s.cashback) }) }}</template>
              </span>
            </div>
            <span class="text-[15px] font-extrabold">{{ money(s.total) }}</span>
          </div>
          <p v-if="!groupSplits.length" class="py-5 text-center text-[13px] font-semibold text-muted">{{ t('history.empty') }}</p>
        </div>
      </div>
    </template>
    <!-- меню группы -->
    <BottomSheet :open="menuSheet" @close="menuSheet = false">
      <div class="pb-4">
        <button type="button" class="flex min-h-[52px] w-full items-center border-b border-sand-2 text-[15px] font-bold transition-colors active:bg-sand" @click="openRename">
          {{ t('group.renameTitle') }}
        </button>
        <button
          type="button"
          class="flex min-h-[52px] w-full items-center text-[15px] font-bold text-ember transition-colors active:bg-sand"
          @click="menuSheet = false; confirmDelete = true"
        >
          {{ t('group.delete') }}
        </button>
      </div>
    </BottomSheet>

    <!-- переименование -->
    <BottomSheet :open="renameSheet" @close="renameSheet = false">
      <div class="pb-4">
        <p class="text-center text-[15px] font-extrabold">{{ t('group.renameSheetTitle') }}</p>
        <input
          v-model="renameValue"
          class="mt-4 w-full border-b-2 border-lime bg-transparent pb-2 text-[18px] font-bold outline-none [caret-color:#DDFF33]"
        />
        <button type="button" class="press mt-5 h-12 w-full rounded-full bg-ink text-[15px] font-bold text-paper" @click="applyRename">
          {{ t('group.save') }}
        </button>
      </div>
    </BottomSheet>

    <!-- подтверждение удаления -->
    <BottomSheet :open="confirmDelete" @close="confirmDelete = false">
      <div class="pb-6 pt-2">
        <p class="text-center text-[17px] font-extrabold">{{ t('group.deleteConfirm') }}</p>
        <p class="mt-1 text-center text-[13px] font-semibold text-muted">{{ t('group.deleteNote') }}</p>
        <div class="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" class="press h-14 rounded-full bg-sand text-[15px] font-bold" @click="confirmDelete = false">{{ t('common.cancel') }}</button>
          <button type="button" class="press h-14 rounded-full bg-[#B4451F] text-[15px] font-extrabold text-white" @click="applyDelete">{{ t('group.deleteAction') }}</button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>
