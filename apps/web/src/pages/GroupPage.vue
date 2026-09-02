<script setup lang="ts">
import VenueIcon from '@/components/VenueIcon.vue'
import FunStatCards from '@/components/FunStatCards.vue'
import CrewEmojiSheet from '@/components/CrewEmojiSheet.vue'
import { crewColor, crewEmoji } from '@/lib/crewStyle'
import { funStats } from '@/lib/funStats'
import { snapshot } from '@/api/real'
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

const emojiSheet = ref(false)
// смена знака хранится в localStorage — дергаем перерисовку счётчиком
const bump = ref(0)

/*
  Состав отряда берём из группы И из её сплитов: до фикса на сервере в группу
  попадал только создатель, и «вы + Shoshiy» в списке соседствовало с отрядом
  из одного человека.
*/
const memberIds = computed(() => {
  const ids = [...new Set(group.value?.memberIds ?? [])]
  for (const s of splits.splits) {
    if (s.groupId !== group.value?.id) continue
    for (const m of s.members) if (!ids.includes(m.contactId)) ids.push(m.contactId)
  }
  if (!ids.includes('me')) ids.unshift('me')
  return ids.sort((a, b) => Number(b === 'me') - Number(a === 'me'))
})

const crewGlyph = computed(() =>
  bump.value >= 0 && group.value ? crewEmoji({ splits: splits.splits, merchants: contacts.merchants }, group.value.id) : '⚡',
)
const crewTint = computed(() =>
  bump.value >= 0 && group.value ? crewColor({ splits: splits.splits, merchants: contacts.merchants }, group.value.id) : '#5B8CFF',
)

/** Мерчанты, где компания реально была — по её сплитам. */
const groupMerchants = computed(() => {
  const ids = [...new Set(groupSplits.value.map((s) => s.merchantId).filter(Boolean))] as string[]
  return ids.map((id) => contacts.merchantById(id)).filter((m): m is NonNullable<typeof m> => !!m)
})

const fun = computed(() => (group.value ? funStats(snapshot(), group.value.id) : []))

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
        <!-- знак компании: тап меняет эмодзи и цвет -->
        <button type="button" class="press" @click="emojiSheet = true">
          <VenueIcon :name="group.name" :glyph="crewGlyph" :color="crewTint" size="lg" />
        </button>
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

      <!-- ачивки компании: сетка 2×2, всё помещается в экран -->
      <FunStatCards :fun="fun" :name-of="nameOf" class="mt-4" />

      <!--
        Кэшбэк компании — лаймовая карточка: раньше это была строка цифр на
        белом и читалась как техническая сводка. Логотипы — реальные заведения
        компании, а не статичная тройка из дизайна.
      -->
      <div class="mt-5 rounded-[24px] bg-lime p-[18px] text-on-lime">
        <p class="font-mono text-[9.5px] font-bold tracking-[0.15em] opacity-60">{{ t('group.cashback') }}</p>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="text-[40px] font-extrabold leading-none tracking-[-0.035em]">{{ money(group.cashback) }}</span>
          <span class="text-[12px] font-bold opacity-50">UZS</span>
        </div>
        <div class="mt-3 flex items-center gap-2.5">
          <VenueIcon v-for="m in groupMerchants.slice(0, 3)" :key="m.id" :name="m.name" size="sm" />
          <span class="text-[12px] font-bold opacity-60">
            {{ t('group.merchantsCount', groupMerchants.length || group.merchantsCount, { named: { n: groupMerchants.length || group.merchantsCount } }) }}
          </span>
        </div>
      </div>

      <!--
        Отряд — слоты как в лобби игры: рамка вокруг аватара, шеврон с ролью,
        имя и состояние. Пустой пунктирный слот зовёт добавить человека —
        компания из одного больше не выглядит поломкой.
      -->
      <div class="mt-[22px] border-t border-sand-2 pt-[18px]">
        <div class="flex items-baseline justify-between">
          <p class="font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('group.squad') }}</p>
          <span class="text-[12px] font-extrabold text-muted">{{ memberIds.length }}</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2">
          <div
            v-for="cid in memberIds"
            :key="cid"
            class="flex flex-col items-center rounded-[20px] bg-shell px-1.5 py-3.5"
          >
            <div class="rounded-full border-[2.5px] p-[3px]" :class="cid === group.ownerId ? 'border-lime' : 'border-sand-2'">
              <ZapAvatar :name="nameOf(cid)" :color="colorOf(cid)" :contact-id="cid" class="h-12 w-12" size="md" />
            </div>
            <span
              class="-mt-2 flex h-[18px] items-center rounded-full px-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.08em]"
              :class="cid === group.ownerId ? 'bg-lime text-on-lime' : 'bg-sand text-muted'"
            >
              {{ cid === group.ownerId ? t('group.owner') : t('group.member') }}
            </span>
            <span class="mt-[7px] truncate text-[12px] font-extrabold">{{ nameOf(cid).split(' ')[0] }}<template v-if="cid === 'me'">{{ t('group.youSuffix') }}</template></span>
            <span class="mt-0.5 line-clamp-2 text-center text-[9.5px] font-semibold text-faint">
              {{ cid === 'me' ? t('group.allClosed', groupSplits.length, { named: { n: groupSplits.length } }) : memberSub(cid) }}
            </span>
            <button
              v-if="cid !== group.ownerId && debtOf(cid) > 0"
              type="button"
              class="remind-chip press mt-2 flex h-[25px] items-center rounded-full bg-ink px-2 text-[10.5px] font-extrabold text-lime disabled:opacity-50"
              :disabled="reminded.has(cid)"
              @click="remind(cid)"
            >
              {{ reminded.has(cid) ? t('group.reminded') : t('group.remind') }}
            </button>
          </div>

          <button
            type="button"
            class="press flex flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-sand-2 px-1.5 py-3.5"
            @click="invite"
          >
            <span class="grid h-[54px] w-[54px] place-items-center rounded-full border-2 border-dashed border-sand-2 text-[26px] font-extrabold text-faint">+</span>
            <span class="text-[12px] font-extrabold text-muted">{{ t('group.invite') }}</span>
          </button>
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

  <CrewEmojiSheet
    v-if="group"
    :open="emojiSheet"
    :group-id="group.id"
    :glyph="crewGlyph"
    :color="crewTint"
    @close="emojiSheet = false"
    @changed="bump++"
  />
</template>
