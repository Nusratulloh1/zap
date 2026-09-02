<script setup lang="ts">
// Дизайн 4b/4a: тёмный hero-хедер (логотип, скан, аватар, промо, категории, поиск)
// + светлый лист с карточками «Кэшбэк/Должники», «Мои группы», «Ваши сплиты».
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import emblaCarouselVue from 'embla-carousel-vue'
import Autoplay from 'embla-carousel-autoplay'
import { fetchFeaturedBill } from '@/api'
import { useDraftStore } from '@/entities/stores/draft'
import { money, peopleCount } from '@/lib/format'
import { humanDateLc } from '@/lib/datetime'
import { useUserStore } from '@/entities/stores/user'
import { useContactsStore } from '@/entities/stores/contacts'
import { useSplitsStore } from '@/entities/stores/splits'
import { useGroupsStore } from '@/entities/stores/groups'
import { useDebtsStore } from '@/entities/stores/debts'
import { useCashbackStore } from '@/entities/stores/cashback'
import type { Split } from '@zap/shared/types'
import ZapAvatar from '@/components/ZapAvatar.vue'
import VenueIcon from '@/components/VenueIcon.vue'
import GenderSheet from '@/components/GenderSheet.vue'
import { crewColor, crewEmoji } from '@/lib/crewStyle'
import AnimatedList from '@/components/AnimatedList.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import heroImg from '@/assets/brand/promo-hero.png'
import partnerSafia from '@/assets/brand/partners/safia.png'
import partnerTexnomart from '@/assets/brand/partners/texnomart.png'
import partnerIdea from '@/assets/brand/partners/idea.png'
import partnerBellissimo from '@/assets/brand/partners/bellissimo.png'
import brandMaxway from '@/assets/brand/partners/maxway.svg'
import brandLesAiles from '@/assets/brand/partners/lesailes.svg'
import brandOqtepa from '@/assets/brand/partners/oqtepa.svg'
import brandEvos from '@/assets/brand/partners/evos.svg'
import brandSushiTime from '@/assets/brand/partners/sushitime.png'
import brandKorzinka from '@/assets/brand/partners/korzinka.png'
import brandClick from '@/assets/brand/partners/click.svg'
import brandPayme from '@/assets/brand/partners/payme.png'
import UserAvatar from '@/components/UserAvatar.vue'
import { setBarColor, homeSheetColor, HOME_TOP_COLOR } from '@/lib/theme'
// витрины-рельсы отключены: все предложения показываются в верхней карусели.
// Компонент BrandRail.vue остаётся в проекте — если решим вернуть секции.
import { type RailBrand } from '@/components/BrandRail.vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'HomePage' })

const router = useRouter()
const { t } = useI18n()
const user = useUserStore()
const contacts = useContactsStore()
const splits = useSplitsStore()
const groups = useGroupsStore()
const debts = useDebtsStore()
const cashback = useCashbackStore()
const draft = useDraftStore()

const search = ref('')

// фиксированный хедер: прозрачный вверху, стекло при скролле.
// Заодно тулбары Safari перекрашиваем под видимую часть страницы:
// тёмный hero сверху → светлый «лист» ниже.
const scrolled = ref(false)
let onSheet = false
function onScroll() {
  const y = window.scrollY
  scrolled.value = y > 8
  const nowSheet = y > 260 // высота hero-блока
  if (nowSheet !== onSheet) {
    onSheet = nowSheet
    setBarColor(nowSheet ? homeSheetColor() : HOME_TOP_COLOR)
  }
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  setBarColor(HOME_TOP_COLOR)
})

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

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

// тап по левой/правой части карусели — назад/вперёд (как в сторис)
function onPromoTap(e: MouseEvent) {
  const api = promoApi.value
  if (!api) return
  const { left, width } = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (e.clientX - left < width * 0.4) api.scrollPrev()
  else api.scrollNext()
}

// Три РАЗНЫХ типа предложений (как в фильтрах: Кэшбэк · Акции · Скидки),
// у каждого свой чип и цвет — раньше все слайды выглядели одинаково «кэшбэк».
type OfferType = 'cashback' | 'promo' | 'discount'
interface PromoSlide {
  kind: 'hero' | 'partner'
  name: string
  img: string
  bg?: string // фирменная подложка под логотип
  type?: OfferType
  label?: string // короткая суть предложения
  labelIcon?: string
  terms?: string // условие мелким шрифтом
  tags?: string
  rating?: number
  venue?: string // иллюстрация зала заведения (если есть)
}

// Иллюстрации залов заведений: кладутся в src/assets/brand/venues/<id>.png
// (id бренда без префикса b_). Подхватываются автоматически; если файла нет —
// слайд рисует прежнюю плашку с логотипом.
const venueFiles = import.meta.glob('@/assets/brand/venues/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
const venueByBrand: Record<string, string> = Object.fromEntries(
  Object.entries(venueFiles).map(([path, url]) => [
    'b_' + (path.split('/').pop() ?? '').replace(/\.[a-z]+$/i, ''),
    url,
  ]),
)

// условия предложений живут в локалях (offers.<id>) — здесь только id

// категория (фильтр) → тип предложения
const CATEGORY_TO_OFFER: Partial<Record<CategoryKey, OfferType>> = {
  cashback: 'cashback',
  promo: 'promo',
  discount: 'discount',
}

/** Стиль чипа под тип предложения. */
const OFFER_STYLE: Record<OfferType, { chip: string; icon: string }> = {
  cashback: { chip: 'bg-lime text-on-lime', icon: '💸' },
  // тёмный чип: на белой карточке витрины белый был бы не виден
  discount: { chip: 'bg-ink text-paper', icon: '%' },
  promo: { chip: 'bg-[#B98CE0] text-white', icon: '🎁' },
}

// --- Витрины партнёров (логотипы — реальные бренды UZ, локальные ассеты) ---
interface BrandCard extends RailBrand {
  type: OfferType
}
const brands: BrandCard[] = [
  { id: 'b_evos', name: 'EVOS', tagKeys: ['lavash', 'burgers'], rating: 4.7, logo: brandEvos, bg: '#E7F3EC', badgeKind: 'promo', badgeValue: '1+1', badgeIcon: '🔥', minutes: '20–30', type: 'promo' },
  { id: 'b_oqtepa', name: 'Oqtepa Lavash', tagKeys: ['lavash', 'shawarma'], rating: 4.5, logo: brandOqtepa, bg: '#FFECEC', badgeKind: 'promo', badgeValue: '1+1', badgeIcon: '🔥', minutes: '20–30', type: 'promo' },
  { id: 'b_maxway', name: 'Maxway', tagKeys: ['fastfood', 'burgers'], rating: 4.6, logo: brandMaxway, bg: '#F1EDFA', badgeKind: 'cashback', badgeValue: '10%', badgeIcon: '💸', minutes: '25–35', type: 'cashback' },
  { id: 'b_lesailes', name: 'Les Ailes', tagKeys: ['chicken', 'burgers'], rating: 4.8, logo: brandLesAiles, bg: '#FFE9F0', badgeKind: 'discount', badgeValue: '15%', badgeIcon: '%', minutes: '30–40', type: 'discount' },
  { id: 'b_bellissimo', name: 'Bellissimo Pizza', tagKeys: ['pizza', 'pasta'], rating: 4.7, logo: partnerBellissimo, bg: '#FFF0E8', badgeKind: 'discount', badgeValue: '10%', badgeIcon: '%', minutes: '35–45', type: 'discount' },
  { id: 'b_sushitime', name: 'Sushi Time', tagKeys: ['rolls', 'sushi'], rating: 4.6, logo: brandSushiTime, bg: '#F2F4F7', badgeKind: 'discount', badgeValue: '30%', badgeIcon: '%', minutes: '40–50', type: 'discount' },
  { id: 'b_feedup', name: 'Feed Up', tagKeys: ['doner', 'burgers'], rating: 4.6, logo: '', bg: '#2A2622', badgeKind: 'promo', badgeValue: '2+1', badgeIcon: '🔥', minutes: '20–30', type: 'promo' },
  { id: 'b_bon', name: 'Bon!', tagKeys: ['bakery', 'croissants'], rating: 4.8, logo: '', bg: '#F0E4D8', badgeKind: 'discount', badgeValue: '20%', badgeIcon: '%', minutes: '20–30', type: 'discount' },
  { id: 'b_safia', name: 'Safia café', tagKeys: ['coffee', 'desserts'], rating: 4.9, logo: partnerSafia, bg: '#FFF1E2', badgeKind: 'cashback', badgeValue: '×2', badgeIcon: '💸', minutes: '15–25', type: 'cashback' },
  { id: 'b_korzinka', name: 'Korzinka', tagKeys: ['supermarket'], rating: 4.5, logo: brandKorzinka, bg: '#FFECEC', badgeKind: 'cashback', badgeValue: '5%', badgeIcon: '💸', type: 'cashback' },
  { id: 'b_texnomart', name: 'Texnomart', tagKeys: ['tech', 'electronics'], rating: 4.4, logo: partnerTexnomart, bg: '#FFF7DB', badgeKind: 'discount', badgeValue: '7%', badgeIcon: '%', type: 'discount' },
  { id: 'b_idea', name: 'idea', tagKeys: ['home'], rating: 4.5, logo: partnerIdea, bg: '#FFE6F2', badgeKind: 'promo', badgeValue: '2+1', badgeIcon: '🔥', type: 'promo' },
  // у Click вордмарк БЕЛЫЙ — на светлой плашке он не читается, нужен тёмный фон
  { id: 'b_click', name: 'Click', tagKeys: ['payments', 'transfers'], rating: 4.8, logo: brandClick, bg: '#0B2140', badgeKind: 'cashback', badgeValue: '3%', badgeIcon: '💸', type: 'cashback' },
  { id: 'b_payme', name: 'Payme', tagKeys: ['payments'], rating: 4.7, logo: brandPayme, bg: '#E9FAFB', badgeKind: 'cashback', badgeValue: '3%', badgeIcon: '💸', type: 'cashback' },
]

// ВСЕ предложения партнёров живут в верхней карусели: hero + слайд на бренд
// В карусели показываем ТОЛЬКО заведения с иллюстрацией зала — остальные
// бренды остаются в массиве brands (для витрин/поиска), но в баннеры не идут.
const promoSlides = computed<PromoSlide[]>(() => [
  { kind: 'hero', name: '', img: '' },
  ...brands
    .filter((b) => venueByBrand[b.id])
    .map((b) => ({
      kind: 'partner' as const,
      name: b.name,
      img: b.logo,
      bg: b.bg,
      type: b.type,
      label: t(`badge.${b.badgeKind}`, { v: b.badgeValue }),
      labelIcon: b.badgeIcon,
      terms: t(`offers.${b.id}`),
      tags: b.tagKeys.map((k) => t(`cuisine.${k}`)).join(' · '),
      rating: b.rating,
      venue: venueByBrand[b.id]!,
    })),
])

// --- фильтры-категории: реально фильтруют список сплитов ---
type CategoryKey = 'all' | 'cashback' | 'promo' | 'discount'
const category = ref<CategoryKey>('all')

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

const categories: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'home.filterAll' },
  { key: 'cashback', label: 'home.filterCashback' },
  { key: 'promo', label: 'home.filterPromo' },
  { key: 'discount', label: 'home.filterDiscount' },
]

const visibleSlides = computed(() => {
  const want = CATEGORY_TO_OFFER[category.value]
  if (!want) return promoSlides.value // «все» — включая hero
  const matched = promoSlides.value.filter((s) => s.type === want)
  return matched.length ? matched : promoSlides.value
})

// набор слайдов сменился — переинициализируем карусель и сбрасываем позицию
watch(visibleSlides, async () => {
  await nextTick()
  promoApi.value?.reInit()
  promoApi.value?.scrollTo(0)
  promoIndex.value = 0
})

const debtors = computed(() =>
  debts.debtorIds
    .map((id) => contacts.byId(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .slice(0, 3),
)

// «5 кэшбэков» — склонение берём из правила локали
const cashbackWord = computed(() => t('home.cashbackUnit', cashback.entries.length, { named: { n: cashback.entries.length } }))

const splitRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return splits.splits
    .filter((s) => {
      const merchant = contacts.merchantById(s.merchantId)
      if (category.value === 'cashback' && !(s.cashback && s.cashback > 0)) return false
      if (category.value === 'promo' && !merchant?.offer?.multiplier) return false
      if (category.value === 'discount' && !merchant?.offer?.percent) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        (merchant?.name.toLowerCase().includes(q) ?? false) ||
        s.members.some((m) => contacts.byId(m.contactId)?.name.toLowerCase().includes(q))
      )
    })
    .slice(0, 5)
})

const homeDate = (ts: number) => humanDateLc(ts)

// знак и цвет компании из локального выбора (или по её заведениям)
// пол спрашиваем один раз, ради подбора аватара
const genderSheet = ref(localStorage.getItem('zap:gender') === null)

const crewSrc = computed(() => ({ splits: splits.splits, merchants: contacts.merchants }))
function crewGlyph(groupId: string): string {
  return crewEmoji(crewSrc.value, groupId)
}
function crewTint(groupId: string): string {
  return crewColor(crewSrc.value, groupId)
}

function splitSub(s: Split): string {
  const g = s.groupId ? groups.byId(s.groupId) : undefined
  const date = homeDate(s.createdAt)
  if (g) {
    return t('home.splitSubGroup', {
      group: g.name.toUpperCase(),
      people: peopleCount(s.members.length),
      date,
    })
  }
  const others = s.members
    .filter((m) => m.contactId !== 'me')
    .map((m) => contacts.byId(m.contactId)?.name ?? '?')
  return t('home.splitSubPeople', { names: others.join(', '), date })
}

</script>

<template>
  <div class="flex min-h-dvh flex-col bg-dune pb-32">
    <!-- фиксированный хедер: прозрачный вверху → тёмное стекло при скролле -->
    <header
      class="home-header fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-app px-4 pt-[env(safe-area-inset-top)]"
      :class="scrolled && 'is-scrolled'"
    >
      <div class="flex items-center justify-between px-1 pb-3 pt-3">
        <img :src="wordmark" alt="ZAP!" class="press h-[52px] w-auto cursor-pointer" @click="scrollTop" />
        <div class="flex items-center gap-3">
          <button
            type="button"
            :aria-label="t('home.scanAria')"
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
          <button type="button" :aria-label="t('common.profileAria')" class="press" @click="router.push('/profile')">
            <UserAvatar :size="44" :border="2" />
          </button>
        </div>
      </div>
    </header>

    <!-- тёмный hero (контент начинается ПОД фиксированным хедером) -->
    <div
      class="flex flex-col gap-4 px-4 pb-11 pt-[calc(env(safe-area-inset-top)+84px)]"
      style="
        background-color: #0e0e0c;
        background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1.2px, transparent 1.3px);
        background-size: 16px 16px;
      "
    >
      <!-- промо-карусель: сегменты + слайды с drag/снапом -->
      <!-- карусель показывается ВСЕГДА: кнопки «скрыть» больше нет, а старый
           флаг promoDismissed у части пользователей остался true и навсегда
           прятал баннеры -->
        <div class="mt-1.5 flex gap-1.5">
          <div
            v-for="(_sl, i) in visibleSlides"
            :key="'seg' + i"
            class="h-[3px] flex-1 rounded-full transition-colors duration-300"
            :class="i === promoIndex ? 'bg-lime' : 'bg-white/[0.22]'"
          />
        </div>

        <div class="relative">
          <div ref="promoRef" data-carousel class="overflow-hidden" @click="onPromoTap">
            <div class="flex">
              <div v-for="(sl, i) in visibleSlides" :key="i" class="min-w-0 shrink-0 grow-0 basis-full px-1">
                <template v-if="sl.kind === 'hero'">
                  <div class="mx-6">
                    <img :src="heroImg" alt="" class="h-[148px] w-full rounded-[20px] object-contain" />
                  </div>
                  <div class="mt-4 flex flex-col items-center gap-1.5 px-4">
                    <h1 class="text-center text-[27px] font-extrabold leading-[1.15] tracking-[-0.01em] text-white">
                      {{ t('home.promoHeroTitle') }}
                    </h1>
                    <p class="text-center text-[14.5px] font-semibold text-white/[0.65]">
                      {{ t('home.promoHeroTerms') }}
                    </p>
                  </div>
                </template>
                <template v-else>
                  <!-- Заведение: та же структура, что и у hero — иллюстрация,
                       под ней крупный заголовок предложения и условие. -->
                  <div v-if="sl.venue">
                    <!-- вертикально: крупная иллюстрация, под ней заголовок ОДНОЙ
                         строкой и условие предложения -->
                    <div class="px-2 pt-4">
                      <img :src="sl.venue" :alt="sl.name" class="h-[218px] w-full object-contain" />
                    </div>
                    <div class="mt-3 flex flex-col items-center gap-1 px-3">
                      <h1 class="max-w-full truncate whitespace-nowrap text-center text-[20px] font-extrabold tracking-[-0.01em] text-white">
                        {{ t('home.offerAt', { label: sl.label, name: sl.name }) }}
                      </h1>
                      <p class="max-w-full truncate whitespace-nowrap text-center text-[13px] font-semibold text-white/[0.6]">
                        {{ sl.terms }}
                      </p>
                    </div>
                  </div>

                  <!-- нет иллюстрации → прежняя плашка с логотипом -->
                  <div v-else class="flex h-full flex-col items-center justify-center gap-3.5 py-4">
                    <span
                      class="flex h-[104px] w-[164px] items-center justify-center rounded-[20px] px-4"
                      :style="{ backgroundColor: sl.bg ?? '#F2F0EA' }"
                    >
                      <img :src="sl.img" :alt="sl.name" class="max-h-[52px] w-auto max-w-[128px] object-contain" />
                    </span>
                    <div class="flex flex-col items-center gap-1.5">
                      <h2 class="text-center text-[23px] font-extrabold tracking-[-0.01em] text-white">{{ sl.name }}</h2>
                      <p v-if="sl.tags" class="flex items-center gap-1.5 text-[12px] font-semibold text-white/55">
                        <span class="text-[#B9E24A]">★</span>
                        <span class="font-extrabold text-white/85">{{ sl.rating?.toFixed(1) }}</span>
                        <span>· {{ sl.tags }}</span>
                      </p>
                      <span
                        class="mt-1 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-extrabold"
                        :class="OFFER_STYLE[sl.type ?? 'cashback'].chip"
                      >
                        <span class="text-[12px]">{{ sl.labelIcon ?? OFFER_STYLE[sl.type ?? 'cashback'].icon }}</span>
                        {{ sl.label }}
                      </span>
                      <p v-if="sl.terms" class="max-w-[280px] text-center text-[12px] font-semibold leading-snug text-white/50">
                        {{ sl.terms }}
                      </p>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

      <!-- категории -->
      <div class="flex justify-between px-1.5 pt-1">
        <button
          v-for="c in categories"
          :key="c.key"
          type="button"
          class="press flex flex-col items-center gap-[7px]"
          @click="category = c.key"
        >
          <span
            class="flex h-[52px] w-[52px] items-center justify-center rounded-full transition-colors duration-200"
            :class="category === c.key ? 'bg-white/[0.24] text-lime' : 'bg-white/[0.12] text-white'"
          >
            <span v-if="c.key === 'all'" class="grid grid-cols-[6px_6px] gap-[5px]">
              <span v-for="i in 4" :key="i" class="h-1.5 w-1.5 rounded-[2px] bg-current" />
            </span>
            <svg v-else-if="c.key === 'cashback'" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" stroke="currentColor" stroke-width="1.8" />
              <circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.8" />
              <line x1="5.8" y1="12" x2="5.8" y2="12.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
              <line x1="18.2" y1="12" x2="18.2" y2="12.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
            <svg v-else-if="c.key === 'promo'" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8C3 7.17 3.67 6.5 4.5 6.5H19.5C20.33 6.5 21 7.17 21 8V9.8C19.9 10.2 19.1 11.03 19.1 12C19.1 12.97 19.9 13.8 21 14.2V16C21 16.83 20.33 17.5 19.5 17.5H4.5C3.67 17.5 3 16.83 3 16V14.2C4.1 13.8 4.9 12.97 4.9 12C4.9 11.03 4.1 10.2 3 9.8V8Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
              <line x1="14.5" y1="8.8" x2="14.5" y2="15.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 2.4" />
            </svg>
            <span v-else class="text-[17px] font-extrabold">%</span>
          </span>
          <span class="text-[11.5px] font-semibold transition-colors" :class="category === c.key ? 'text-white' : 'text-white/70'">{{ t(c.label) }}</span>
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
          :placeholder="t('home.searchPlaceholder')"
          class="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-white outline-none placeholder:text-faint-2"
        />
        <button
          type="button"
          class="press flex h-10 items-center rounded-full bg-lime px-[18px] text-[14.5px] font-extrabold text-on-lime"
          @click="router.push('/split/scan')"
        >
          {{ t('home.split') }}
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
          class="press flex h-56 flex-col rounded-card bg-paper p-[18px] text-left shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]"
          @click="router.push('/cashback')"
        >
          <span class="text-[18px] font-extrabold leading-[1.15] tracking-[-0.01em]">{{ t('home.cashbackCard') }}</span>
          <span class="mt-[5px] text-[13px] font-semibold leading-[1.3] text-faint">
            {{ cashback.entries.length ? t('home.cashbackWithCount', { amount: money(cashback.balance), count: cashbackWord }) : t('home.cashbackEmpty') }}
          </span>
          <span v-if="cashback.entries.length" class="mt-auto flex min-h-[60px] items-center">
            <img :src="partnerSafia" alt="Safia" class="h-[29px] w-auto rounded-[9px]" />
            <img :src="partnerTexnomart" alt="texnomart" class="-ml-2.5 h-[29px] w-auto rounded-[9px]" />
            <img :src="partnerIdea" alt="idea" class="-ml-2.5 h-[29px] w-auto rounded-[9px]" />
          </span>
        </button>
        <button
          type="button"
          class="press flex h-56 flex-col rounded-card bg-paper p-[18px] text-left shadow-[0_10px_24px_rgba(30,28,16,0.05),0_2px_6px_rgba(30,28,16,0.04)]"
          @click="router.push('/debts')"
        >
          <span class="text-[18px] font-extrabold leading-[1.15] tracking-[-0.01em]">{{ t('home.debtorsCard') }}</span>
          <span class="mt-[5px] text-[13px] font-semibold leading-[1.3] text-faint">
            {{ debtors.length ? t('home.cashbackWithCount', { amount: money(debts.totalOwedToMe), count: peopleCount(debtors.length) }) : t('home.debtorsEmpty') }}
          </span>
          <span v-if="debtors.length" class="mt-auto flex min-h-[60px] items-end gap-2">
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
          <h2 class="text-[18px] font-extrabold tracking-[-0.01em]">{{ t('home.myGroups') }}</h2>
          <span v-if="groups.groups.length" class="text-[14px] font-bold text-muted">{{ t('home.seeAll') }}</span>
        </div>
        <div v-if="loaded && !groups.groups.length" class="py-5 text-center text-[13px] font-semibold text-muted">
          {{ t('home.groupsEmpty') }}
        </div>
        <div v-else-if="loaded" class="mt-1 flex flex-col">
          <div
            v-for="(g, gi) in groups.groups"
            :key="g.id"
            class="flex min-h-[62px] cursor-pointer items-center gap-3"
            :class="gi < groups.groups.length - 1 && 'border-b border-sand-2'"
            @click="router.push(`/groups/${g.id}`)"
          >
            <!-- знак компании: свой эмодзи и цвет, как в приложении -->
            <VenueIcon :name="g.name" :glyph="crewGlyph(g.id)" :color="crewTint(g.id)" size="md" />
            <div class="flex min-w-0 flex-1 flex-col gap-px">
              <span class="text-[15px] font-bold">{{ g.name }}</span>
              <span class="text-[12px] font-semibold text-faint">{{ t('home.groupSub', { people: peopleCount(g.memberIds.length), amount: money(g.cashback) }) }}</span>
            </div>
            <button
              type="button"
              class="press flex h-[34px] items-center rounded-full bg-lime px-[15px] text-[13px] font-extrabold text-on-lime"
              @click.stop="quickSplit(g.memberIds)"
            >
              {{ t('home.split') }}
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
          <h2 class="text-[18px] font-extrabold tracking-[-0.01em]">{{ t('home.yourSplits') }}</h2>
          <button
            v-if="splitRows.length"
            type="button"
            class="text-[14px] font-bold text-muted"
            @click="router.push('/history')"
          >
            {{ t('home.seeAll') }}
          </button>
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
              <VenueIcon :name="contacts.merchantById(s.merchantId)?.name ?? s.title" size="md" />
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
                  {{ s.status === 'closed' ? t('home.closedBadge') : t('home.activeBadge') }}
                </span>
              </div>
            </div>
          </AnimatedList>
          <p v-if="!splitRows.length" class="py-5 text-center text-[13px] font-semibold text-muted">{{ t('home.splitsEmpty') }}</p>
        </div>
        <div v-else class="space-y-2 py-3">
          <Skeleton v-for="i in 3" :key="i" class="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  </div>

  <GenderSheet :open="genderSheet" @close="genderSheet = false" />
</template>
