<script setup lang="ts">
// Дизайн 5j: профиль — фото с лаймовой обводкой, чип «ZAP! с мая 2026»,
// стат-тайлы, КАРТЫ, НАСТРОЙКИ (тумблер, «Мои группы», «Выйти»).
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, phone } from '@/lib/format'
import { useUserStore } from '@/entities/stores/user'
import { useGroupsStore } from '@/entities/stores/groups'
import { useCashbackStore } from '@/entities/stores/cashback'
import BottomSheet from '@/components/BottomSheet.vue'
import InvisibleDigits from '@/components/InvisibleDigits.vue'
import PinDots from '@/components/PinDots.vue'
import { setPrimaryCard, changePin } from '@/mocks/api'
import ThemeToggle from '@/components/ThemeToggle.vue'
import myAvatar from '@/assets/brand/avatars/a12.png'

const router = useRouter()
const user = useUserStore()
const groups = useGroupsStore()
const cashback = useCashbackStore()

onMounted(() => {
  void user.hydrate()
  void groups.hydrate()
  void cashback.hydrate()
})

const notifs = computed({
  get: () => user.settings.debtNotifications,
  set: (v: boolean) => void user.toggleDebtNotifications(v),
})

// добавление карты
const cardSheet = ref(false)
const cardNetwork = ref<'UZCARD' | 'HUMO'>('UZCARD')
const cardDigits = ref('')
const savingCard = ref(false)

const cardMask = computed(() => {
  const d = cardDigits.value.padEnd(16, '•')
  return d.match(/.{1,4}/g)?.join(' ') ?? ''
})

async function saveCard() {
  if (cardDigits.value.length !== 16 || savingCard.value) return
  savingCard.value = true
  await user.addCard(cardNetwork.value, cardDigits.value.slice(-4))
  savingCard.value = false
  cardSheet.value = false
  cardDigits.value = ''
  toast.success('Карта добавлена')
}

// сделать карту основной
async function makePrimary(cardId: string, last4: string) {
  await setPrimaryCard(cardId)
  toast.success('Карта ·· ' + last4 + ' теперь основная')
}

// смена PIN: старый → новый → повтор
const pinSheet = ref(false)
type PinStep = 'old' | 'new' | 'repeat'
const pinStep = ref<PinStep>('old')
const pinOld = ref('')
const pinNew = ref('')
const pinRepeat = ref('')
const pinShake = ref(false)
const pinError = ref('')

function openPinFlow() {
  pinStep.value = 'old'
  pinOld.value = ''
  pinNew.value = ''
  pinRepeat.value = ''
  pinError.value = ''
  pinSheet.value = true
}

const pinTitle = computed(() =>
  pinStep.value === 'old' ? 'Текущий PIN' : pinStep.value === 'new' ? 'Новый PIN' : 'Повторите PIN',
)

const pinModel = computed({
  get: () => (pinStep.value === 'old' ? pinOld.value : pinStep.value === 'new' ? pinNew.value : pinRepeat.value),
  set: (v: string) => {
    if (pinStep.value === 'old') pinOld.value = v
    else if (pinStep.value === 'new') pinNew.value = v
    else pinRepeat.value = v
  },
})

function pinFail(msg: string) {
  pinError.value = msg
  pinShake.value = true
  setTimeout(() => {
    pinShake.value = false
    pinModel.value = ''
  }, 420)
}

watch(pinModel, async (v) => {
  if (v.length !== 4) return
  pinError.value = ''
  if (pinStep.value === 'old') {
    setTimeout(() => (pinStep.value = 'new'), 220)
  } else if (pinStep.value === 'new') {
    setTimeout(() => (pinStep.value = 'repeat'), 220)
  } else {
    if (pinRepeat.value !== pinNew.value) {
      pinFail('PIN не совпадает')
      return
    }
    const ok = await changePin(pinOld.value, pinNew.value)
    if (!ok) {
      pinStep.value = 'old'
      pinOld.value = ''
      pinNew.value = ''
      pinRepeat.value = ''
      pinFail('Старый PIN неверный')
      return
    }
    pinSheet.value = false
    toast.success('PIN обновлён')
  }
})

// группы
const groupsSheet = ref(false)

// выход
const logoutSheet = ref(false)
const loggingOut = ref(false)

async function confirmLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  await user.logout()
  router.replace('/onboarding')
}
</script>

<template>
  <div class="min-h-dvh bg-paper px-6 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
    <div class="flex items-center justify-between">
      <button
        type="button"
        aria-label="Назад"
        class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
        @click="router.push('/')"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <ThemeToggle />
    </div>

    <template v-if="user.user">
      <div class="mt-[22px] flex items-center gap-4">
        <img :src="myAvatar" :alt="user.user.name" class="h-[76px] w-[76px] rounded-full border-[3px] border-lime object-cover" />
        <div class="flex flex-col gap-[3px]">
          <h1 class="text-[23px] font-extrabold tracking-[-0.01em]">{{ user.user.name }}</h1>
          <p class="text-[13.5px] font-semibold text-muted">{{ user.user.handle }} · {{ phone(user.user.phone) }}</p>
          <span class="flex h-[26px] w-fit items-center rounded-full bg-lime px-[11px] text-[11px] font-extrabold text-on-lime">
            ZAP! с {{ user.user.memberSince }}
          </span>
        </div>
      </div>

      <div class="mt-[22px] flex gap-2.5">
        <div class="flex flex-1 flex-col gap-[3px] rounded-[20px] bg-shell px-4 py-3.5">
          <span class="text-[20px] font-extrabold">{{ user.user.splitsCount }}</span>
          <span class="text-[11.5px] font-bold text-muted">сплита</span>
        </div>
        <div class="flex flex-1 flex-col gap-[3px] rounded-[20px] bg-shell px-4 py-3.5">
          <span class="text-[20px] font-extrabold">{{ money(cashback.balance) }}</span>
          <span class="text-[11.5px] font-bold text-muted">кэшбэк</span>
        </div>
        <div class="flex flex-1 flex-col gap-[3px] rounded-[20px] bg-shell px-4 py-3.5">
          <span class="text-[20px] font-extrabold">{{ groups.groups.length }}</span>
          <span class="text-[11.5px] font-bold text-muted">группы</span>
        </div>
      </div>

      <!-- карты -->
      <p class="mt-[26px] font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">КАРТЫ</p>
      <div class="mt-1 flex flex-col">
        <button
          v-for="(card, i) in user.cards"
          :key="card.id"
          type="button"
          class="flex min-h-[62px] w-full items-center gap-3.5 text-left transition-colors active:bg-sand"
          :class="i < user.cards.length && 'border-b border-sand-2'"
          @click="!card.primary && makePrimary(card.id, card.last4)"
        >
          <span
            class="flex h-[30px] w-[42px] items-center justify-center rounded-lg font-mono text-[8px] font-bold"
            :class="card.network === 'UZCARD' ? 'bg-[#111110] text-lime' : 'bg-sand text-muted'"
          >
            {{ card.network === 'UZCARD' ? 'UZC' : 'HUMO' }}
          </span>
          <span class="flex-1 text-[15px] font-bold">{{ card.network }} ·· {{ card.last4 }}</span>
          <span v-if="card.primary" class="flex h-[26px] items-center rounded-full bg-lime px-[11px] text-[11px] font-extrabold text-on-lime">основная</span>
          <span v-else class="text-[12px] font-bold text-faint-2">сделать основной</span>
        </button>
        <button type="button" class="flex min-h-[62px] items-center gap-3.5 text-left transition-colors active:bg-sand" @click="cardSheet = true">
          <span class="flex h-[30px] w-[42px] items-center justify-center rounded-lg bg-sand text-[16px] font-semibold text-faint-2">+</span>
          <span class="flex-1 text-[15px] font-bold text-faint-2">Добавить карту</span>
        </button>
      </div>

      <!-- настройки -->
      <p class="mt-[22px] font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">НАСТРОЙКИ</p>
      <div class="mt-1 flex flex-col">
        <button type="button" class="flex min-h-[56px] items-center border-b border-sand-2 transition-colors active:bg-sand" @click="openPinFlow">
          <span class="flex-1 text-left text-[15px] font-bold">PIN и вход по Face ID</span>
          <span class="text-[15px] font-semibold text-mist">›</span>
        </button>
        <div class="flex min-h-[56px] items-center border-b border-sand-2">
          <span class="flex-1 text-[15px] font-bold">Уведомления о долгах</span>
          <button
            type="button"
            role="switch"
            :aria-checked="notifs"
            class="relative h-7 w-[46px] rounded-full transition-colors duration-200"
            :class="notifs ? 'bg-lime' : 'bg-stone'"
            @click="notifs = !notifs"
          >
            <span class="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-ink transition-transform duration-200 ease-zap" :class="notifs ? 'translate-x-[18px]' : ''" />
          </button>
        </div>
        <button type="button" class="flex min-h-[56px] items-center border-b border-sand-2 transition-colors active:bg-sand" @click="groupsSheet = true">
          <span class="flex-1 text-left text-[15px] font-bold">Мои группы</span>
          <span class="mr-2 text-[13px] font-bold text-muted">{{ groups.groups.length }}</span>
          <span class="text-[15px] font-semibold text-mist">›</span>
        </button>
        <button type="button" class="flex min-h-[56px] items-center text-left transition-colors active:bg-sand" @click="logoutSheet = true">
          <span class="flex-1 text-[15px] font-bold text-ember">Выйти</span>
        </button>
      </div>
    </template>

    <!-- новая карта -->
    <BottomSheet :open="cardSheet" @close="cardSheet = false">
      <div class="pb-4">
        <p class="text-center text-[16px] font-extrabold">Новая карта</p>
        <div class="mt-4 flex justify-center gap-2">
          <button
            v-for="n in (['UZCARD', 'HUMO'] as const)"
            :key="n"
            type="button"
            class="press flex h-9 items-center rounded-full px-5 font-mono text-[12px] font-bold transition-colors"
            :class="cardNetwork === n ? 'bg-ink text-paper' : 'bg-sand text-muted'"
            @click="cardNetwork = n"
          >
            {{ n }}
          </button>
        </div>
        <p class="mt-5 text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">НОМЕР КАРТЫ</p>
        <InvisibleDigits v-if="cardSheet" v-model="cardDigits" :length="16" autofocus class="mt-2 py-1">
          <p class="text-center font-mono text-[20px] font-bold tabular-nums tracking-wider">{{ cardMask }}</p>
        </InvisibleDigits>
        <button
          type="button"
          class="press mt-5 h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
          :disabled="cardDigits.length !== 16 || savingCard"
          @click="saveCard"
        >
          Готово
        </button>
      </div>
    </BottomSheet>

    <!-- группы -->
    <BottomSheet :open="groupsSheet" @close="groupsSheet = false">
      <div class="pb-4">
        <p class="mb-2 text-center text-[16px] font-extrabold">Мои группы</p>
        <button
          v-for="g in groups.groups"
          :key="g.id"
          type="button"
          class="flex w-full items-center justify-between border-b border-sand-2 py-3.5 transition-colors active:bg-sand last:border-0"
          @click="groupsSheet = false; router.push(`/groups/${g.id}`)"
        >
          <span class="text-[15px] font-bold">{{ g.name }}</span>
          <span class="text-[13px] font-bold text-muted">{{ money(g.cashback) }}</span>
        </button>
      </div>
    </BottomSheet>

    <!-- смена PIN -->
    <BottomSheet :open="pinSheet" @close="pinSheet = false">
      <div class="pb-6">
        <p class="text-center text-[16px] font-extrabold">{{ pinTitle }}</p>
        <p class="mt-1 text-center text-[12.5px] font-semibold" :class="pinError ? 'text-danger' : 'text-muted'">
          {{ pinError || '4 цифры для подтверждения оплат' }}
        </p>
        <InvisibleDigits :key="pinStep" v-model="pinModel" :length="4" password autofocus class="mx-auto mt-5 w-fit">
          <PinDots :length="4" :filled="pinModel.length" :shake="pinShake" :size="26" :gap="14" :bar-width="146" />
        </InvisibleDigits>
      </div>
    </BottomSheet>

    <!-- выход -->
    <BottomSheet :open="logoutSheet" @close="logoutSheet = false">
      <div class="pb-6 pt-2">
        <p class="text-center text-[17px] font-extrabold">Выйти?</p>
        <p class="mt-1 text-center text-[13px] font-semibold text-muted">Демо сбросится к началу</p>
        <div class="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" class="press h-14 rounded-full bg-sand text-[15px] font-bold" @click="logoutSheet = false">Отмена</button>
          <button type="button" class="press h-14 rounded-full bg-ink text-[15px] font-extrabold text-paper disabled:opacity-40" :disabled="loggingOut" @click="confirmLogout">
            Выйти
          </button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>
