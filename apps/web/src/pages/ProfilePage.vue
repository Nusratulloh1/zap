<script setup lang="ts">
// Дизайн 5j: профиль — фото с лаймовой обводкой, чип «ZAP! с мая 2026»,
// стат-тайлы, КАРТЫ, НАСТРОЙКИ (тумблер, «Мои группы», «Выйти»).
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import { money, monthYear, phone } from '@/lib/format'
import { useUserStore } from '@/entities/stores/user'
import { useGroupsStore } from '@/entities/stores/groups'
import { useCashbackStore } from '@/entities/stores/cashback'
import BottomSheet from '@/components/BottomSheet.vue'
import InvisibleDigits from '@/components/InvisibleDigits.vue'
import PinDots from '@/components/PinDots.vue'
import { setPrimaryCard, changePin } from '@/api'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { install, isInstalled } from '@/lib/installPrompt'
import UserAvatar from '@/components/UserAvatar.vue'
import LanguageSheet from '@/components/LanguageSheet.vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_NAMES, type Locale } from '@/lib/i18n'

const installed = isInstalled()

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

// добавление карты: форма → мок SMS-подтверждение → мок проверка карты
const cardSheet = ref(false)
type CardStep = 'form' | 'sms' | 'check'
const cardStep = ref<CardStep>('form')
const cardNetwork = ref<'UZCARD' | 'HUMO'>('UZCARD')
const cardDigits = ref('')
const cardExpiry = ref('')
const cardOwner = ref('')
const cardSms = ref('')
const savingCard = ref(false)

const cardMask = computed(() => {
  const d = cardDigits.value.padEnd(16, '•')
  return d.match(/.{1,4}/g)?.join(' ') ?? ''
})

const expiryValid = computed(() => {
  const m = cardExpiry.value.match(/^(\d{2})\/(\d{2})$/)
  if (!m) return false
  const mm = Number(m[1])
  return mm >= 1 && mm <= 12
})
const cardFormValid = computed(
  () => cardDigits.value.length === 16 && expiryValid.value && cardOwner.value.trim().length >= 3,
)

function openCardSheet() {
  cardStep.value = 'form'
  cardDigits.value = ''
  cardExpiry.value = ''
  cardOwner.value = ''
  cardSms.value = ''
  cardSheet.value = true
}

function onExpiryInput(e: Event) {
  const el = e.target as HTMLInputElement
  const d = el.value.replace(/\D/g, '').slice(0, 4)
  cardExpiry.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d
  el.value = cardExpiry.value
}

function cardContinue() {
  if (!cardFormValid.value) return
  cardStep.value = 'sms'
  cardSms.value = ''
}

// мок: любой 6-значный код подтверждает телефон, затем «проверка карты»
watch(cardSms, async (v) => {
  if (v.length !== 6 || savingCard.value) return
  savingCard.value = true
  await new Promise((r) => setTimeout(r, 600))
  cardStep.value = 'check'
  await new Promise((r) => setTimeout(r, 1400))
  await user.addCard(cardNetwork.value, cardDigits.value.slice(-4))
  savingCard.value = false
  cardSheet.value = false
  toast.success(t('profile.cardAddedConfirmed'))
})

// сделать карту основной
async function makePrimary(cardId: string, last4: string) {
  await setPrimaryCard(cardId)
  toast.success(t('profile.cardNowPrimary', { last4 }))
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
  pinStep.value === 'old' ? t('profile.pinOld') : pinStep.value === 'new' ? t('profile.pinNew') : t('profile.pinRepeat'),
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
      pinFail(t('profile.pinMismatch'))
      return
    }
    const ok = await changePin(pinOld.value, pinNew.value)
    if (!ok) {
      pinStep.value = 'old'
      pinOld.value = ''
      pinNew.value = ''
      pinRepeat.value = ''
      pinFail(t('profile.pinOldWrong'))
      return
    }
    pinSheet.value = false
    toast.success(t('profile.pinUpdated'))
  }
})

// группы
const groupsSheet = ref(false)
const languageSheet = ref(false)
const { t, locale } = useI18n()

/** memberSince приходит ISO — месяц называем на языке интерфейса. */
const sinceLabel = computed(() => {
  const ts = Date.parse(user.user?.memberSince ?? '')
  return Number.isNaN(ts) ? (user.user?.memberSince ?? '') : monthYear(ts)
})

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
        :aria-label="t('common.backAria')"
        class="press flex h-11 w-11 items-center justify-center rounded-full bg-sand text-[18px] font-semibold"
        @click="router.push('/')"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <ThemeToggle />
    </div>

    <template v-if="user.user">
      <div class="mt-[22px] flex items-center gap-4">
        <UserAvatar :size="76" :border="3" />
        <div class="flex flex-col gap-[3px]">
          <h1 class="text-[23px] font-extrabold tracking-[-0.01em]">{{ user.user.name }}</h1>
          <p class="text-[13.5px] font-semibold text-muted">{{ user.user.handle }} · {{ phone(user.user.phone) }}</p>
          <span class="flex h-[26px] w-fit items-center rounded-full bg-lime px-[11px] text-[11px] font-extrabold text-on-lime">
            {{ t('profile.since', { date: sinceLabel }) }}
          </span>
        </div>
      </div>

      <div class="mt-[22px] flex gap-2.5">
        <div class="flex flex-1 flex-col gap-[3px] rounded-[20px] bg-shell px-4 py-3.5">
          <span class="text-[20px] font-extrabold">{{ user.user.splitsCount }}</span>
          <span class="text-[11.5px] font-bold text-muted">{{ t('profile.statSplitsUnit') }}</span>
        </div>
        <div class="flex flex-1 flex-col gap-[3px] rounded-[20px] bg-shell px-4 py-3.5">
          <span class="text-[20px] font-extrabold">{{ money(cashback.balance) }}</span>
          <span class="text-[11.5px] font-bold text-muted">{{ t('profile.statCashbackUnit') }}</span>
        </div>
        <div class="flex flex-1 flex-col gap-[3px] rounded-[20px] bg-shell px-4 py-3.5">
          <span class="text-[20px] font-extrabold">{{ groups.groups.length }}</span>
          <span class="text-[11.5px] font-bold text-muted">{{ t('profile.statGroupsUnit') }}</span>
        </div>
      </div>

      <!-- карты -->
      <p class="mt-[26px] font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('profile.cards') }}</p>
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
          <span v-if="card.primary" class="flex h-[26px] items-center rounded-full bg-lime px-[11px] text-[11px] font-extrabold text-on-lime">{{ t('profile.primary') }}</span>
          <span v-else class="text-[12px] font-bold text-faint-2">{{ t('profile.makePrimary') }}</span>
        </button>
        <button type="button" class="flex min-h-[62px] items-center gap-3.5 text-left transition-colors active:bg-sand" @click="openCardSheet">
          <span class="flex h-[30px] w-[42px] items-center justify-center rounded-lg bg-sand text-[16px] font-semibold text-faint-2">+</span>
          <span class="flex-1 text-[15px] font-bold text-faint-2">{{ t('profile.addCardRow') }}</span>
        </button>
      </div>

      <!-- настройки -->
      <p class="mt-[22px] font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('profile.settings') }}</p>
      <div class="mt-1 flex flex-col">
        <button type="button" class="flex min-h-[56px] items-center border-b border-sand-2 transition-colors active:bg-sand" @click="openPinFlow">
          <span class="flex-1 text-left text-[15px] font-bold">{{ t('profile.pinFaceId') }}</span>
          <span class="text-[15px] font-semibold text-mist">›</span>
        </button>
        <div class="flex min-h-[56px] items-center border-b border-sand-2">
          <span class="flex-1 text-[15px] font-bold">{{ t('profile.debtNotifs') }}</span>
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
        <button type="button" class="flex min-h-[56px] items-center border-b border-sand-2 transition-colors active:bg-sand" @click="languageSheet = true">
          <span class="flex-1 text-left text-[15px] font-bold">{{ t('profile.language') }}</span>
          <span class="mr-2 text-[13px] font-bold text-muted">{{ LOCALE_NAMES[locale as Locale] }}</span>
          <span class="text-[15px] font-semibold text-mist">›</span>
        </button>
        <button type="button" class="flex min-h-[56px] items-center border-b border-sand-2 transition-colors active:bg-sand" @click="groupsSheet = true">
          <span class="flex-1 text-left text-[15px] font-bold">{{ t('profile.myGroups') }}</span>
          <span class="mr-2 text-[13px] font-bold text-muted">{{ groups.groups.length }}</span>
          <span class="text-[15px] font-semibold text-mist">›</span>
        </button>
        <button
          v-if="!installed"
          type="button"
          class="flex min-h-[56px] w-full items-center border-b border-sand-2 text-left transition-colors active:bg-sand"
          @click="install()"
        >
          <span class="flex-1 text-[15px] font-bold">{{ t('profile.installApp') }}</span>
          <span class="text-[15px] font-semibold text-mist">›</span>
        </button>
        <button type="button" class="flex min-h-[56px] items-center text-left transition-colors active:bg-sand" @click="logoutSheet = true">
          <span class="flex-1 text-[15px] font-bold text-ember">{{ t('profile.logout') }}</span>
        </button>
      </div>
    </template>

    <!-- новая карта -->
    <BottomSheet :open="cardSheet" @close="cardSheet = false">
      <div class="pb-4">
        <p class="text-center text-[16px] font-extrabold">{{ t('profile.addCardTitle') }}</p>
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
        <template v-if="cardStep === 'form'">
          <p class="mt-5 text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('profile.cardNumberLabel') }}</p>
          <InvisibleDigits v-if="cardSheet" v-model="cardDigits" :length="16" autofocus class="mt-2 py-1">
            <p class="text-center font-mono text-[20px] font-bold tabular-nums tracking-wider">{{ cardMask }}</p>
          </InvisibleDigits>
          <div class="mt-4 flex gap-3">
            <label class="flex-1">
              <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('profile.cardExpiry') }}</p>
              <input
                inputmode="numeric"
                :placeholder="t('profile.cardExpiryPlaceholder')"
                :value="cardExpiry"
                class="mt-1.5 w-full border-b-2 border-sand-2 bg-transparent pb-2 text-center font-mono text-[17px] font-bold outline-none transition-colors [caret-color:#DDFF33] focus:border-lime placeholder:text-faint"
                @input="onExpiryInput"
              />
            </label>
            <label class="flex-[1.6]">
              <p class="text-center font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('profile.cardHolder') }}</p>
              <input
                v-model="cardOwner"
                autocomplete="cc-name"
                placeholder="AZIZ KARIMOV"
                class="mt-1.5 w-full border-b-2 border-sand-2 bg-transparent pb-2 text-center font-mono text-[15px] font-bold uppercase outline-none transition-colors [caret-color:#DDFF33] focus:border-lime placeholder:text-faint"
              />
            </label>
          </div>
          <button
            type="button"
            class="press mt-5 h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
            :disabled="!cardFormValid"
            @click="cardContinue"
          >
            {{ t('common.continue') }}
          </button>
        </template>

        <template v-else-if="cardStep === 'sms'">
          <p class="mt-5 text-center text-[14px] font-semibold text-muted">
            {{ t('profile.codeToNumber', { phone: phone(user.user?.phone ?? '') }) }}
          </p>
          <InvisibleDigits v-if="cardSheet" v-model="cardSms" :length="6" one-time-code autofocus class="mt-4 py-1">
            <div class="flex justify-center gap-2">
              <span
                v-for="i in 6"
                :key="i"
                class="flex h-11 w-9 items-center justify-center rounded-xl bg-sand text-[18px] font-extrabold"
              >
                {{ cardSms[i - 1] ?? '' }}
              </span>
            </div>
          </InvisibleDigits>
          <p class="mt-4 text-center text-[12px] font-semibold text-faint">{{ t('profile.ownerConfirm') }}</p>
        </template>

        <template v-else>
          <div class="flex flex-col items-center py-7">
            <span class="h-9 w-9 animate-spin rounded-full border-[3px] border-sand border-t-lime" />
            <p class="mt-4 text-[15px] font-bold">{{ t('profile.checkingCard') }}</p>
            <p class="mt-1 text-[12.5px] font-semibold text-muted">{{ cardNetwork }} ·· {{ cardDigits.slice(-4) }}</p>
          </div>
        </template>
      </div>
    </BottomSheet>

    <!-- группы -->
    <BottomSheet :open="groupsSheet" @close="groupsSheet = false">
      <div class="pb-4">
        <p class="mb-2 text-center text-[16px] font-extrabold">{{ t('profile.myGroups') }}</p>
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
          {{ pinError || t('auth.pinHint') }}
        </p>
        <InvisibleDigits :key="pinStep" v-model="pinModel" :length="4" password autofocus class="mx-auto mt-5 w-fit">
          <PinDots :length="4" :filled="pinModel.length" :shake="pinShake" :size="26" :gap="14" :bar-width="146" />
        </InvisibleDigits>
      </div>
    </BottomSheet>

    <!-- выход -->
    <BottomSheet :open="logoutSheet" @close="logoutSheet = false">
      <div class="pb-6 pt-2">
        <p class="text-center text-[17px] font-extrabold">{{ t('profile.logoutConfirm') }}</p>
        <p class="mt-1 text-center text-[13px] font-semibold text-muted">{{ t('profile.logoutNote') }}</p>
        <div class="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" class="press h-14 rounded-full bg-sand text-[15px] font-bold" @click="logoutSheet = false">{{ t('common.cancel') }}</button>
          <button type="button" class="press h-14 rounded-full bg-ink text-[15px] font-extrabold text-paper disabled:opacity-40" :disabled="loggingOut" @click="confirmLogout">
            {{ t('profile.logout') }}
          </button>
        </div>
      </div>
    </BottomSheet>
  </div>
    <LanguageSheet :open="languageSheet" @close="languageSheet = false" />
</template>
