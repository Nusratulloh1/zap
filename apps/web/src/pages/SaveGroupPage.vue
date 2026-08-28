<script setup lang="ts">
// Дизайн 3h: «Сохранить эту компанию?» — стек аватаров, карточка с названием
// и участниками, тумблер группового кэшбэка, CTA.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money } from '@/lib/format'
import { useSplitsStore } from '@/entities/stores/splits'
import { useGroupsStore } from '@/entities/stores/groups'
import { useContactsStore } from '@/entities/stores/contacts'
import { useUserStore } from '@/entities/stores/user'
import { useDebtsStore } from '@/entities/stores/debts'
import ZapAvatar from '@/components/ZapAvatar.vue'
import AnimatedList from '@/components/AnimatedList.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const splits = useSplitsStore()
const groups = useGroupsStore()
const contacts = useContactsStore()
const user = useUserStore()
const debts = useDebtsStore()

const id = computed(() => String(route.params.id))
const split = computed(() => splits.byId(id.value))

import { isRealApi } from '@/api'
import { useI18n } from 'vue-i18n'
const name = ref(isRealApi ? '' : 'Friday Crew')

// реальный режим: предлагаем название из имён участников
function suggestName(names: string[]) {
  const firsts = names.map((n) => n.split(' ')[0]).filter(Boolean).slice(0, 3)
  return firsts.length > 1 ? firsts.join(' + ') : t('saveGroup.andCompany', { name: firsts[0] ?? '' })
}
const accrue = ref(true)
const memberIds = ref<string[]>([])
const saving = ref(false)

onMounted(async () => {
  await Promise.all([splits.hydrate(), groups.hydrate(), contacts.hydrate(), user.hydrate(), debts.hydrate()])
})

watch(
  split,
  (s) => {
    if (!s || memberIds.value.length) return
    memberIds.value = s.members.map((m) => m.contactId)
    const existing = s.groupId ? groups.byId(s.groupId) : undefined
    if (existing) {
      name.value = existing.name
      accrue.value = existing.accrueCashback
    } else if (isRealApi && !name.value) {
      // предлагаем название из имён участников: «Nusrat + Amal»
      name.value = suggestName(memberIds.value.map((cid) => nameOf(cid)))
    }
  },
  { immediate: true },
)

function nameOf(cid: string): string {
  return cid === 'me' ? (user.user?.name ?? t('members.youShort')) : (contacts.byId(cid)?.name ?? '?')
}

function colorOf(cid: string): string {
  return cid === 'me' ? '#111110' : (contacts.byId(cid)?.color ?? '#8A887E')
}

function metaOf(cid: string): string {
  if (cid === 'me') return ''
  const handle = contacts.byId(cid)?.handle ?? ''
  const debt = debts.openDebts.filter((d) => d.contactId === cid).reduce((s, d) => s + d.amount, 0)
  const parts = [handle, debt > 0 ? t('group.owes', { amount: money(debt) }) : ''].filter(Boolean)
  return parts.join(' · ')
}

function remove(cid: string) {
  if (cid === 'me') return
  memberIds.value = memberIds.value.filter((x) => x !== cid)
}

async function save() {
  if (saving.value || !name.value.trim()) return
  saving.value = true
  await groups.save({
    splitId: id.value,
    name: name.value.trim(),
    memberIds: memberIds.value,
    accrueCashback: accrue.value,
  })
  toast.success(t('saveGroup.saved'))
  router.replace(`/split/${id.value}/cashback`)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-dune px-5 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)]">
    <button
      type="button"
      :aria-label="t('common.backAria')"
      class="press flex h-11 w-11 items-center justify-center rounded-full bg-paper text-[17px] font-semibold shadow-[0_2px_8px_rgba(30,28,16,0.06)]"
      @click="router.push(`/split/${id}/closed`)"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <div class="mt-6 flex justify-center">
      <div class="flex">
        <ZapAvatar
          v-for="(cid, i) in memberIds.slice(0, 4)"
          :key="cid"
          :name="nameOf(cid)"
          :color="colorOf(cid)"
          :contact-id="cid"
          class="h-[58px] w-[58px] border-[3px] border-dune"
          :class="i > 0 ? '-ml-4' : ''"
          size="lg"
        />
      </div>
    </div>

    <h1 class="mt-3.5 text-center text-[23px] font-extrabold tracking-[-0.01em]">{{ t('saveGroup.title') }}</h1>
    <p class="mt-[5px] text-center text-[13.5px] font-semibold text-muted">{{ t('saveGroup.subtitle') }}</p>

    <div class="mt-5 rounded-card bg-paper px-[18px] py-1 shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]">
      <label class="flex min-h-[56px] items-center gap-3 border-b border-sand-2">
        <span class="shrink-0 text-[15.5px] font-extrabold">{{ t('saveGroup.nameLabel') }}</span>
        <input
          v-model="name"
          class="w-full bg-transparent text-right text-[16px] font-semibold text-ink outline-none [caret-color:#DDFF33]"
        />
      </label>
      <AnimatedList tag="div">
      <div
        v-for="(cid, i) in memberIds"
        :key="cid"
        class="flex min-h-[60px] items-center gap-3"
        :class="i < memberIds.length - 1 && 'border-b border-sand-2'"
      >
        <ZapAvatar :name="nameOf(cid)" :color="colorOf(cid)" :contact-id="cid" class="h-[38px] w-[38px]" size="sm" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[15px] font-bold">{{ nameOf(cid) }}<template v-if="cid === 'me'">{{ t('live.youSuffix') }}</template></span>
          <span v-if="metaOf(cid)" class="truncate text-[12px] font-semibold text-faint">{{ metaOf(cid) }}</span>
        </span>
        <span v-if="cid === 'me'" class="flex h-7 items-center rounded-full bg-dune-2 px-3 text-[11.5px] font-bold text-muted">{{ t('group.owner') }}</span>
        <button
          v-else
          type="button"
          :aria-label="t('common.removeAria')"
          class="press relative hit-area-y flex h-[30px] w-[30px] items-center justify-center rounded-full bg-dune-2 text-[14px] font-semibold text-muted"
          @click="remove(cid)"
        >
          ×
        </button>
      </div>
      </AnimatedList>
    </div>

    <button
      type="button"
      class="mt-3 flex items-center gap-3 rounded-card bg-paper px-[18px] py-4 text-left shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]"
      @click="accrue = !accrue"
    >
      <span class="flex flex-1 flex-col gap-0.5">
        <span class="text-[15.5px] font-extrabold">{{ t('saveGroup.accrue') }}</span>
        <span class="text-[12.5px] font-semibold text-muted">{{ t('saveGroup.accrueSub') }}</span>
      </span>
      <span class="relative h-8 w-[52px] rounded-full transition-colors duration-200" :class="accrue ? 'bg-lime' : 'bg-stone'">
        <span class="absolute left-1 top-1 h-6 w-6 rounded-full bg-ink transition-transform duration-200 ease-zap" :class="accrue ? 'translate-x-5' : ''" />
      </span>
    </button>

    <div class="flex-1" />

    <div class="flex flex-col gap-2.5">
      <button
        type="button"
        class="press h-14 rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="!name.trim() || saving"
        @click="save"
      >
        {{ t('saveGroup.save') }}
      </button>
      <button
        type="button"
        class="press h-14 rounded-full bg-paper text-[16px] font-bold text-ink shadow-[0_2px_8px_rgba(30,28,16,0.05)]"
        @click="router.replace(`/split/${id}/cashback`)"
      >
        {{ t('saveGroup.notNow') }}
      </button>
    </div>
  </div>
</template>
