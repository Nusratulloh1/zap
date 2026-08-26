<script setup lang="ts">
// Дизайн 4b/4a: тёмный hero-хедер (логотип, скан, аватар, промо, категории, поиск)
// + светлый лист с карточками «Кэшбэк/Должники», «Мои группы», «Ваши сплиты».
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import emblaCarouselVue from 'embla-carousel-vue'
import Autoplay from 'embla-carousel-autoplay'
import { fetchFeaturedBill } from '@/api'
import { useDraftStore } from '@/entities/stores/draft'
import { money, peopleCount, isSameDay } from '@/lib/format'
import { useUserStore } from '@/entities/stores/user'
import { useContactsStore } from '@/entities/stores/contacts'
import { useSplitsStore } from '@/entities/stores/splits'
import { useGroupsStore } from '@/entities/stores/groups'
import { useDebtsStore } from '@/entities/stores/debts'
import { useCashbackStore } from '@/entities/stores/cashback'
import type { Split } from '@/entities/types'
import ZapAvatar from '@/components/ZapAvatar.vue'
import AnimatedList from '@/components/AnimatedList.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import heroImg from '@/assets/brand/promo-hero.png'
import partnerSafia from '@/assets/brand/partners/safia.png'
import partnerTexnomart from '@/assets/brand/partners/texnomart.png'
import partnerIdea from '@/assets/brand/partners/idea.png'
import myAvatar from '@/assets/brand/avatars/a12.png'

defineOptions({ name: 'HomePage' })

const router = useRouter()
const user = useUserStore()
const contacts = useContactsStore()
const splits = useSplitsStore()
const groups = useGroupsStore()
const debts = useDebtsStore()
const cashback = useCashbackStore()
const draft = useDraftStore()

const search = ref('')

// --- промо-карусель (embla): drag с инерцией, снап, автоплей 5с ---
// zap:test отключает автоплей — иначе скриншот-раны недетерминированы
const testMode = (() => {
  try {
    return Boolean(localStorage.getItem('zap:test'))
  } catch {
    return false
  }
})()
const [promoRef, promoApi] = emblaCarouselVue(
  { align: 'start', loop: true },
  testMode ? [] : [Autoplay({ delay: 5000, stopOnInteraction: true })],
)
const promoIndex = ref(0)
watch(promoApi, (api) => {
  if (!api) return
  api.on('select', () => (promoIndex.value = api.selectedScrollSnap()))
})

const promoSlides = [
  { kind: 'hero', name: '', label: '', img: '' },
  { kind: 'partner', name: 'Safia café', label: '10% группе', img: 'safia' },
  { kind: 'partner', name: 'Texnomart', label: '7% от 3 человек', img: 'texnomart' },
  { kind: 'partner', name: 'idea', label: '5% на всё', img: 'idea' },
]

// --- фильтры-категории: реально фильтруют список сплитов ---
const category = ref('Все')

// --- быстрый сплит из группы: чек + участники группы ---
async function quickSplit(memberIds: string[]) {
  const bill = contacts.featuredBill ?? (await fetchFeaturedBill())
  draft.startForGroup(bill, memberIds)
  router.push('/split/bill')
}

// --- живой поиск по контактам ---
const contactMatches = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return []
  const digits = q.replace(/D/g, '')
  return contacts.contacts.filter(
    (c) => c.name.toLowerCase().includes(q) || (digits.length > 1 && (c.phone ?? '').includes(digits)),
  )
})

const loaded = computed(() => splits.loaded && groups.loaded && contacts.loaded)

onMounted(() => {
  void user.hydrate()
  void contacts.hydrate()
  void splits.hydrate()
  void groups.hydrate()
  void debts.hydrate()
  void cashback.hydrate()
})

const categories = ['Все', 'Кэшбэк', 'Акции', 'Скидки']

const debtors = computed(() =>
  debts.debtorIds
    .map((id) => contacts.byId(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .slice(0, 3),
)

const splitRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return splits.splits
    .filter((s) => {
      const merchant = contacts.merchantById(s.merchantId)
      if (category.value === 'Кэшбэк' && !(s.cashback && s.cashback > 0)) return false
      if (category.value === 'Акции' && !merchant?.offer?.multiplier) return false
      if (category.value === 'Скидки' && !merchant?.offer?.percent) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        (merchant?.name.toLowerCase().includes(q) ?? false) ||
        s.members.some((m) => contacts.byId(m.contactId)?.name.toLowerCase().includes(q))
      )
    })
    .slice(0, 5)
})

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const WEEKDAYS_LC = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

/** «сегодня» / «вчера» / «пятница» / «9 авг» — как в дизайне */
function homeDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (isSameDay(d, now)) return 'сегодня'
  if (isSameDay(d, new Date(now.getTime() - 86400000))) return 'вчера'
  if ((now.getTime() - d.getTime()) / 86400000 < 7) return WEEKDAYS_LC[d.getDay()]!
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function splitSub(s: Split): string {
  const g = s.groupId ? groups.byId(s.groupId) : undefined
  if (g) return `${g.name.toUpperCase()} · ${s.members.length} чел · ${homeDate(s.createdAt)}`
  const others = s.members
    .filter((m) => m.contactId !== 'me')
    .map((m) => contacts.byId(m.contactId)?.name ?? '?')
  return `вы + ${others.join(', ')} · ${homeDate(s.createdAt)}`
}

function splitLetter(s: Split): string {
  return contacts.merchantById(s.merchantId)?.letter ?? s.title[0]?.toUpperCase() ?? 'S'
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-dune pb-32">
    <!-- тёмный hero -->
    <div
      class="flex flex-col gap-4 px-4 pb-11 pt-[calc(env(safe-area-inset-top)+24px)]"
      style="
        background-color: #0e0e0c;
        background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1.2px, transparent 1.3px);
        background-size: 16px 16px;
      "
    >
      <div class="flex items-center justify-between px-1">
        <img :src="wordmark" alt="ZAP!" class="h-[52px] w-auto" />
        <div class="flex items-center gap-3">
          <button
            type="button"
            aria-label="Сканировать QR"
            class="press flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.14] bg-white/10"
            @click="router.push('/split/scan')"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 6V3.5C2 2.7 2.7 2 3.5 2H6" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
              <path d="M14 2H16.5C17.3 2 18 2.7 18 3.5V6" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
              <path d="M18 14V16.5C18 17.3 17.3 18 16.5 18H14" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
              <path d="M6 18H3.5C2.7 18 2 17.3 2 16.5V14" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
              <rect x="6.5" y="6.5" width="7" height="7" rx="1.5" fill="#DDFF33" />
            </svg>
          </button>
          <button type="button" aria-label="Профиль" class="press" @click="router.push('/profile')">
            <img :src="myAvatar" alt="Профиль" class="h-11 w-11 rounded-full border-2 border-lime object-cover" />
          </button>
        </div>
      </div>

      <!-- промо-карусель: сегменты + слайды с drag/снапом -->
      <template v-if="!user.settings.promoDismissed">
        <div class="mt-1.5 flex gap-1.5">
          <div
            v-for="(_sl, i) in promoSlides"
            :key="'seg' + i"
            class="h-[3px] flex-1 rounded-full transition-colors duration-300"
            :class="i === promoIndex ? 'bg-lime' : 'bg-white/[0.22]'"
          />
        </div>

        <div class="relative">
          <button
            type="button"
            aria-label="Скрыть промо"
            class="press absolute -top-1 right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[13px] text-white/70"
            @click="user.dismissPromo()"
          >
            ×
          </button>
          <div ref="promoRef" class="overflow-hidden">
            <div class="flex">
              <div v-for="(sl, i) in promoSlides" :key="i" class="min-w-0 shrink-0 grow-0 basis-full px-1">
                <template v-if="sl.kind === 'hero'">
                  <div class="mx-6">
                    <img :src="heroImg" alt="" class="h-[148px] w-full rounded-[20px] object-contain" />
                  </div>
                  <div class="mt-4 flex flex-col items-center gap-1.5 px-4">
                    <h1 class="text-center text-[27px] font-extrabold leading-[1.15] tracking-[-0.01em] text-white">
                      Приди с 5 друзьями —<br />получи кэшбэк ×2
                    </h1>
                    <p class="text-center text-[14.5px] font-semibold text-white/[0.65]">
                      Сплитьте чек группой до 30 сентября — бонус каждому
                    </p>
                  </div>
                </template>
                <template v-else>
                  <div class="flex h-full flex-col items-center justify-center gap-4 py-6">
                    <img
                      :src="sl.img === 'safia' ? partnerSafia : sl.img === 'texnomart' ? partnerTexnomart : partnerIdea"
                      :alt="sl.name"
                      class="h-[84px] w-auto rounded-[18px]"
                    />
                    <div class="flex flex-col items-center gap-1.5">
                      <h2 class="text-center text-[24px] font-extrabold tracking-[-0.01em] text-white">{{ sl.name }}</h2>
                      <span class="flex h-8 items-center rounded-full bg-lime px-3.5 text-[13px] font-extrabold text-on-lime">
                        Кэшбэк {{ sl.label }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- категории -->
      <div class="flex justify-between px-1.5 pt-1">
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          class="press flex flex-col items-center gap-[7px]"
          @click="category = c"
        >
          <span
            class="flex h-[52px] w-[52px] items-center justify-center rounded-full transition-colors duration-200"
            :class="category === c ? 'bg-white/[0.24]' : 'bg-white/[0.12]'"
          >
            <span v-if="c === 'Все'" class="grid grid-cols-[6px_6px] gap-[5px]">
              <span v-for="i in 4" :key="i" class="h-1.5 w-1.5 rounded-[2px] bg-white" />
            </span>
            <svg v-else-if="c === 'Кэшбэк'" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" stroke="#FFFFFF" stroke-width="1.8" />
              <circle cx="12" cy="12" r="2.8" stroke="#FFFFFF" stroke-width="1.8" />
              <line x1="5.8" y1="12" x2="5.8" y2="12.01" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" />
              <line x1="18.2" y1="12" x2="18.2" y2="12.01" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" />
            </svg>
            <svg v-else-if="c === 'Акции'" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8C3 7.17 3.67 6.5 4.5 6.5H19.5C20.33 6.5 21 7.17 21 8V9.8C19.9 10.2 19.1 11.03 19.1 12C19.1 12.97 19.9 13.8 21 14.2V16C21 16.83 20.33 17.5 19.5 17.5H4.5C3.67 17.5 3 16.83 3 16V14.2C4.1 13.8 4.9 12.97 4.9 12C4.9 11.03 4.1 10.2 3 9.8V8Z"
                stroke="#DDFF33"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
              <line x1="14.5" y1="8.8" x2="14.5" y2="15.2" stroke="#DDFF33" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 2.4" />
            </svg>
            <span v-else class="text-[17px] font-extrabold text-white">%</span>
          </span>
          <span class="text-[11.5px] font-semibold transition-colors" :class="category === c ? 'text-white' : 'text-white/70'">{{ c }}</span>
        </button>
      </div>

      <!-- поиск + Сплит -->
      <label class="flex h-[54px] items-center gap-3 rounded-full border border-white/[0.14] bg-white/10 pl-[18px] pr-2">
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <circle cx="9.5" cy="9.5" r="6.5" stroke="#A3A199" stroke-width="2.2" />
          <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="#A3A199" stroke-width="2.2" stroke-linecap="round" />
        </svg>
        <input
          v-model="search"
          placeholder="Имя или номер"
          class="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-white outline-none placeholder:text-faint-2"
        />
        <button
          type="button"
          class="press flex h-10 items-center rounded-full bg-lime px-[18px] text-[14.5px] font-extrabold text-on-lime"
          @click="router.push('/split/scan')"
        >
          Сплит
        </button>
      </label>
    </div>

    <!-- результаты поиска по контактам -->
    <div v-if="contactMatches.length" class="bg-[#0E0E0C] px-5 pb-4">
      <AnimatedList class="flex gap-3">
      <button
        v-for="c in contactMatches"
        :key="c.id"
        type="button"
        class="press flex flex-col items-center gap-1.5"
        @click="router.push('/split/amount')"
      >
        <ZapAvatar :name="c.name" :color="c.color" :contact-id="c.id" class="h-12 w-12" size="md" />
        <span class="max-w-[64px] truncate text-[11px] font-bold text-white/80">{{ c.name }}</span>
      </button>
      </AnimatedList>
    </div>

    <!-- светлый лист -->
    <div class="-mt-7 flex flex-col gap-3 rounded-t-[32px] bg-dune px-3.5 pb-[110px] pt-[18px]">
      <!-- стат-карты -->
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="press flex h-48 flex-col rounded-card bg-paper p-[18px] text-left shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]"
          @click="router.push('/cashback')"
        >
          <span class="text-[18px] font-extrabold leading-[1.15] tracking-[-0.01em]">Накопленные кэшбеки</span>
          <span class="mt-[5px] text-[13px] font-semibold leading-[1.3] text-faint">3 общих групповых кэшбека</span>
          <span class="mt-auto flex min-h-[60px] items-center">
            <img :src="partnerSafia" alt="Safia" class="h-[29px] w-auto rounded-[9px]" />
            <img :src="partnerTexnomart" alt="texnomart" class="-ml-2.5 h-[29px] w-auto rounded-[9px]" />
            <img :src="partnerIdea" alt="idea" class="-ml-2.5 h-[29px] w-auto rounded-[9px]" />
          </span>
        </button>
        <button
          type="button"
          class="press flex h-48 flex-col rounded-card bg-paper p-[18px] text-left shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]"
          @click="router.push('/debts')"
        >
          <span class="text-[18px] font-extrabold leading-[1.15] tracking-[-0.01em]">Мои должники</span>
          <span class="mt-[5px] text-[13px] font-semibold leading-[1.3] text-faint">{{ debtors.length }} общих должника</span>
          <span class="mt-auto flex min-h-[60px] items-end gap-2">
            <span v-for="d in debtors" :key="d.id" class="flex flex-col items-center gap-1">
              <ZapAvatar :name="d.name" :color="d.color" :contact-id="d.id" class="h-[38px] w-[38px]" size="sm" />
              <span class="text-[10.5px] font-bold">{{ d.name }}</span>
            </span>
          </span>
        </button>
      </div>

      <!-- мои группы -->
      <div class="rounded-card bg-paper px-[18px] pb-1.5 pt-[18px] shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]">
        <div class="flex items-baseline justify-between">
          <h2 class="text-[18px] font-extrabold tracking-[-0.01em]">Мои группы</h2>
          <span class="text-[14px] font-bold text-muted">Все ›</span>
        </div>
        <div v-if="loaded" class="mt-1 flex flex-col">
          <div
            v-for="(g, gi) in groups.groups"
            :key="g.id"
            class="flex min-h-[62px] cursor-pointer items-center gap-3"
            :class="gi < groups.groups.length - 1 && 'border-b border-sand-2'"
            @click="router.push(`/groups/${g.id}`)"
          >
            <div class="flex">
              <ZapAvatar
                v-for="(cid, i) in g.memberIds.slice(0, 3)"
                :key="cid"
                :name="contacts.byId(cid)?.name ?? 'Я'"
                :color="contacts.byId(cid)?.color ?? '#111110'"
                :contact-id="cid"
                class="h-8 w-8 border-2 border-paper"
                :class="i > 0 ? '-ml-2.5' : ''"
                size="xs"
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-px">
              <span class="text-[15px] font-bold">{{ g.name }}</span>
              <span class="text-[12px] font-semibold text-faint">{{ peopleCount(g.memberIds.length) }} · кэшбэк {{ money(g.cashback) }}</span>
            </div>
            <button
              type="button"
              class="press flex h-[34px] items-center rounded-full bg-lime px-[15px] text-[13px] font-extrabold text-on-lime"
              @click.stop="quickSplit(g.memberIds)"
            >
              Сплит
            </button>
          </div>
        </div>
        <div v-else class="space-y-2 py-3">
          <Skeleton v-for="i in 2" :key="i" class="h-12 w-full rounded-2xl" />
        </div>
      </div>

      <!-- ваши сплиты -->
      <div class="rounded-card bg-paper px-[18px] pb-1.5 pt-[18px] shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]">
        <div class="flex items-baseline justify-between">
          <h2 class="text-[18px] font-extrabold tracking-[-0.01em]">Ваши сплиты</h2>
          <button type="button" class="text-[14px] font-bold text-muted" @click="router.push('/history')">Все ›</button>
        </div>
        <div v-if="loaded" class="mt-1.5">
          <AnimatedList appear class="flex flex-col">
            <div
              v-for="(s, i) in splitRows"
              :key="s.id"
              class="flex min-h-[62px] cursor-pointer items-center gap-3"
              :class="i < splitRows.length - 1 && 'border-b border-sand-2'"
              :style="{ '--i': i }"
              @click="router.push(`/split/${s.id}`)"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-[14px] bg-ink text-[15px] font-extrabold text-paper">
                {{ splitLetter(s) }}
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-px">
                <span class="truncate text-[15.5px] font-bold">{{ contacts.merchantById(s.merchantId)?.name ?? s.title }}</span>
                <span class="truncate text-[12.5px] font-semibold text-muted">{{ splitSub(s) }}</span>
              </div>
              <div class="flex flex-col items-end gap-[3px]">
                <span class="text-[16px] font-extrabold">{{ money(s.total) }}</span>
                <span
                  class="rounded-md px-[7px] py-[3px] font-mono text-[9.5px] font-bold tracking-[0.1em]"
                  :class="s.status === 'closed' ? 'bg-pebble-2 text-muted' : 'bg-lime text-on-lime'"
                >
                  {{ s.status === 'closed' ? 'ЗАКРЫТ' : 'АКТИВЕН' }}
                </span>
              </div>
            </div>
          </AnimatedList>
          <p v-if="!splitRows.length" class="py-5 text-center text-[13px] font-semibold text-muted">Ничего не нашлось</p>
        </div>
        <div v-else class="space-y-2 py-3">
          <Skeleton v-for="i in 3" :key="i" class="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
</template>
