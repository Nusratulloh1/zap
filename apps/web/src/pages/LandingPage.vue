<script setup lang="ts">
// Публичный лендинг ZAP! Вёрстка намеренно на собственных классах (.lp-*),
// а не на утилитах Tailwind: страница живёт вне обычной оболочки приложения,
// и так её оформление не зависит от того, какие утилиты попали в сборку.
// Экраны в мокапах — из дизайн-исходника (design-reference), с реальными
// данными и правильными начертаниями.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { submitPartnerLead } from '@/api'
import { toast } from '@/lib/toast'
import { appHref } from '@/lib/site'
import { phone as formatPhone } from '@/lib/format'
import {
  startSmoothScroll,
  stopSmoothScroll,
  revealOnScroll,
  revealLines,
  parallax,
  riseIn,
  drift,
  heroOut,
  snapSections,
  pinnedSlides,
  scrollToTarget,
  scrollToY,
  countUpOnScroll,
  refreshMotion,
} from '@/lib/landingMotion'
import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import shotHome from '@/assets/landing/app-home.webp'
import shotAmount from '@/assets/landing/app-amount.webp'
import shotMembers from '@/assets/landing/app-members.webp'
import shotReceipt from '@/assets/landing/app-receipt.webp'
import shotDone from '@/assets/landing/app-done.webp'
import shotCashback from '@/assets/landing/app-cashback.webp'
import shotDebts from '@/assets/landing/app-debts.webp'
import shotHistory from '@/assets/landing/app-history.webp'
import brandMaxway from '@/assets/brand/partners/maxway.svg'
import brandLesAiles from '@/assets/brand/partners/lesailes.svg'
import brandOqtepa from '@/assets/brand/partners/oqtepa.svg'
import brandClick from '@/assets/brand/partners/click.svg'
import brandRahmat from '@/assets/brand/partners/rahmat.svg'

defineOptions({ name: 'LandingPage' })

const router = useRouter()
const { t } = useI18n()
// с лендинг-хоста уводим сразу на платформу — без промежуточного редиректа
const start = () => {
  const href = appHref('/onboarding')
  if (href.startsWith('http')) location.href = href
  else router.push(href)
}
/**
 * Пункты меню «Возможности» и «Кэшбэк» ведут внутрь закреплённой секции:
 * там все слайды лежат в одной точке, поэтому обычный якорь всегда показывал
 * бы первый. Считаем позицию слайда по его номеру.
 */
const goTo = (sel: string) => {
  const idx = features.findIndex((f) => '#' + f.id === sel)
  const sec = pinSec.value
  if (idx >= 0 && sec && window.matchMedia('(min-width: 900px)').matches) {
    const top = sec.getBoundingClientRect().top + window.scrollY
    // 0.175 экрана — середина «стояния» слайда между переходами
    scrollToY(idx === 0 ? top : top + (idx + 0.175) * window.innerHeight)
    return
  }
  scrollToTarget(sel)
}

const root = ref<HTMLElement | null>(null)
const hero = ref<HTMLElement | null>(null)
const heroHead = ref<HTMLElement | null>(null)
const heroPhone = ref<HTMLElement | null>(null)
const pinSec = ref<HTMLElement | null>(null)
const pinInner = ref<HTMLElement | null>(null)
const featRows = ref<HTMLElement[]>([])
const scrolled = ref(false)
const onScroll = () => (scrolled.value = window.scrollY > 24)

const brands = [
  { src: brandMaxway, alt: 'Maxway', h: 20 },
  { src: brandLesAiles, alt: 'Les Ailes', h: 22 },
  { src: brandOqtepa, alt: 'Oqtepa Lavash', h: 36 },
  { src: brandClick, alt: 'Click', h: 24 },
  { src: brandRahmat, alt: 'Rahmat', h: 20 },
]

const partnerPerks = ['landing.perk1', 'landing.perk2', 'landing.perk3', 'landing.perk4']

const debtPoints = ['landing.debtPoint1', 'landing.debtPoint2', 'landing.debtPoint3']

const quickTiles = [
  {
    label: 'landing.tileScan',
    path: '<path d="M3 8V5C3 3.9 3.9 3 5 3H8M16 3H19C20.1 3 21 3.9 21 5V8M21 16V19C21 20.1 20.1 21 19 21H16M8 21H5C3.9 21 3 20.1 3 19V16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />',
  },
  {
    label: 'landing.tileSplit',
    path: '<circle cx="8" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7" /><circle cx="16" cy="16" r="3.2" stroke="currentColor" stroke-width="1.7" /><path d="M10.5 10.5 13.5 13.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />',
  },
  {
    label: 'landing.tileCashback',
    path: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7" />',
  },
  {
    label: 'landing.tileDebts',
    path: '<circle cx="9" cy="9" r="3.2" stroke="currentColor" stroke-width="1.7" /><path d="M3.5 19c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6M16 6.4a2.9 2.9 0 0 1 0 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />',
  },
]

// три фичи живут в одной закреплённой секции и сменяют друг друга по скроллу
const features = [
  {
    id: 'how',
    titleKeys: ['landing.scanTitleA', 'landing.scanTitleB'],
    bodyKey: 'landing.scanBody',
    shot: shotReceipt,
    altKey: 'landing.altReceipt',
    tilt: -14,
    flip: false,
  },
  {
    id: 'cashback',
    titleKeys: ['landing.cashbackTitleA', 'landing.cashbackTitleB'],
    bodyKey: 'landing.cashbackBody',
    shot: shotCashback,
    altKey: 'landing.altCashback',
    tilt: 14,
    flip: true,
  },
  {
    id: 'debts',
    titleKeys: ['landing.debtsTitleA', 'landing.debtsTitleB'],
    bodyKey: 'landing.debtsBody',
    shot: shotDebts,
    altKey: 'landing.altDebts',
    tilt: -14,
    flip: false,
  },
]

const stats = [
  { v: 30, sufKey: 'landing.statSecSuffix', key: 'landing.stat1' },
  { v: 2, suf: '×', key: 'landing.stat2' },
  { v: 0, suf: '%', key: 'landing.stat3' },
]

// бегущая строка: короткие тезисы, а не повтор названия — она должна
// что-то сообщать, а не просто ехать
const ticker = ['landing.tick1', 'landing.tick2', 'landing.tick3', 'landing.tick4', 'landing.tick5']

const rail = [
  { src: shotHome, altKey: 'landing.altHome' },
  { src: shotAmount, altKey: 'landing.altAmount' },
  { src: shotMembers, altKey: 'landing.altMembers' },
  { src: shotDone, altKey: 'landing.altDone' },
  { src: shotHistory, altKey: 'landing.altHistory' },
]

// --- заявка заведения ---
// в форме держим только цифры номера, на экране показываем их под маской
const form = ref({ company: '', contact: '', phone: '', city: '', message: '' })
const phoneMasked = computed({
  get: () => (form.value.phone ? formatPhone(form.value.phone) : ''),
  set: (v: string) => {
    // сначала отбрасываем префикс самой маски, иначе при посимвольном вводе
    // его цифры возвращаются в поле и номер разъезжается
    const rest = v.startsWith('+998') ? v.slice(4) : v
    let d = rest.replace(/\D/g, '')
    // номер могли вставить целиком: +998 90 …, 998 90 …
    if (d.length > 9 && d.startsWith('998')) d = d.slice(3)
    form.value.phone = d.slice(0, 9)
  },
})
const sending = ref(false)
const sent = ref(false)
const formValid = () =>
  form.value.company.trim().length >= 2 &&
  form.value.contact.trim().length >= 2 &&
  form.value.phone.length === 9

async function sendLead() {
  if (!formValid() || sending.value) return
  sending.value = true
  try {
    await submitPartnerLead({ ...form.value, phone: '+998' + form.value.phone })
    sent.value = true
    toast.success(t('landing.formOkToast'))
  } catch (e) {
    toast(e instanceof Error && e.message ? e.message : t('landing.formFailToast'))
  } finally {
    sending.value = false
  }
}

const isDesktop = () => window.matchMedia('(min-width: 900px)').matches

/** Счётчики без анимации — просто проставить итоговые значения. */
function fillCounters(el: ParentNode) {
  el.querySelectorAll<HTMLElement>('[data-count]').forEach((c) => {
    c.textContent = Number(c.dataset.count ?? 0).toLocaleString('ru-RU') + (c.dataset.suffix ?? '')
  })
}

function setupMotion() {
  const el = root.value
  if (!el) return
  const all = <T extends Element>(sel: string, from: ParentNode = el) => Array.from(from.querySelectorAll<T>(sel))

  // На мобильном скролл-анимации выключены целиком: страница должна быть
  // простой и лёгкой, а закрепление и параллакс на тач-экране только мешают
  // жестам и съедают батарею. Остаётся обычная прокрутка.
  if (!isDesktop()) {
    fillCounters(el)
    return
  }

  // вступление героя играет сразу, без привязки к прокрутке
  if (hero.value) {
    revealLines(all('.lp-line > i', hero.value), { scroll: false })
    revealOnScroll(all('[data-reveal]', hero.value), { scroll: false, delay: 0.36, stagger: 0.1 })
  }
  if (heroHead.value) heroOut(heroHead.value)
  if (heroPhone.value) {
    riseIn(heroPhone.value.firstElementChild ?? heroPhone.value, { delay: 0.5 })
    parallax(heroPhone.value, 62)
  }

  // заголовки секций выезжают построчно из-под маски
  all('[data-lines]').forEach((h) => revealLines(all('.lp-line > i', h)))

  // текст и карточки внутри секции — общей волной
  all('[data-group]').forEach((g) => revealOnScroll(all('[data-reveal]', g)))

  // закреплённая секция фич: слайды сменяются, пока страница «стоит»
  if (pinSec.value && pinInner.value && featRows.value.length) {
    pinnedSlides(pinSec.value, pinInner.value, featRows.value)
  }

  all('[data-drift]').forEach((r) => drift(r, 110))
  snapSections(all<HTMLElement>('[data-snap]'))
  all<HTMLElement>('[data-count]').forEach((c) =>
    countUpOnScroll(c, Number(c.dataset.count ?? 0), c.dataset.suffix ?? ''),
  )
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  if (!isDesktop()) {
    // мобильная версия: нативная прокрутка, без Lenis и ScrollTrigger
    requestAnimationFrame(setupMotion)
    return
  }
  startSmoothScroll()
  requestAnimationFrame(setupMotion)
  // геометрия мокапов известна только после загрузки картинок
  window.addEventListener('load', refreshMotion)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('load', refreshMotion)
  stopSmoothScroll()
})
</script>

<template>
  <div ref="root" class="lp">
    <!-- ШАПКА -->
    <header class="lp-nav" :class="{ 'is-scrolled': scrolled }">
      <div class="lp-nav__inner">
        <img :src="wordmark" alt="ZAP!" class="lp-nav__logo" />
        <nav class="lp-nav__links">
          <a href="#how" @click.prevent="goTo('#how')">{{ t('landing.navFeatures') }}</a>
          <a href="#cashback" @click.prevent="goTo('#cashback')">{{ t('landing.navCashback') }}</a>
          <a href="#partners" @click.prevent="goTo('#partners')">{{ t('landing.navPartners') }}</a>
        </nav>
        <button type="button" class="lp-btn lp-btn--sm" @click="start">{{ t('landing.navStart') }}</button>
      </div>
    </header>

    <!-- ГЕРОЙ -->
    <section ref="hero" data-snap class="lp-hero">
      <div class="lp-orb lp-orb--hero" />
      <div ref="heroHead">
        <h1 class="lp-display lp-display--long">
          <span class="lp-line"><i class="lp-grad">{{ t('landing.heroA') }}</i></span>
          <span class="lp-line"><i class="lp-grad lp-grad--fade">{{ t('landing.heroB') }}</i></span>
        </h1>
        <p data-reveal class="lp-lead">
          {{ t('landing.heroLead') }}
        </p>
        <div data-reveal class="lp-cta">
          <button type="button" class="lp-btn" @click="start">{{ t('landing.ctaTry') }}</button>
          <a href="#partners" class="lp-btn lp-btn--ghost" @click.prevent="goTo('#partners')">{{ t('landing.ctaVenue') }}</a>
        </div>
      </div>

      <div ref="heroPhone" class="lp-stage lp-stage--hero">
        <div class="lp-device lp-device--hero">
          <div class="lp-device__screen"><img :src="shotHome" :alt="t('landing.altHomeScreen')" /></div>
        </div>
      </div>
    </section>

    <!-- БРЕНДЫ -->
    <section class="lp-brands">
      <img v-for="b in brands" :key="b.alt" :src="b.src" :alt="b.alt" :style="{ height: b.h + 'px' }" />
    </section>

    <!-- ФИЧИ: секция закрепляется, слайды сменяются по скроллу -->
    <section ref="pinSec" id="how" data-snap class="lp-sec lp-pinsec">
      <div class="lp-orb lp-orb--left" />
      <div ref="pinInner" class="lp-pin">
        <div class="lp-stack">
          <div
            v-for="f in features"
            :key="f.id"
            :id="f.id"
            ref="featRows"
            class="lp-row lp-featrow"
            :class="{ 'lp-row--flip': f.flip }"
          >
            <template v-if="f.flip">
              <div class="lp-stage lp-stage--left">
                <div :data-tilt="f.tilt" class="lp-device">
                  <div class="lp-device__screen"><img :src="f.shot" :alt="t(f.altKey)" /></div>
                </div>
              </div>
            </template>

            <div class="lp-col" :class="{ 'lp-col--end': f.flip }">
              <h2 class="lp-title">
                <span class="lp-line"><i class="lp-grad">{{ t(f.titleKeys[0]) }}</i></span>
                <span class="lp-line"><i class="lp-grad">{{ t(f.titleKeys[1]) }}</i></span>
              </h2>
              <p class="lp-body">{{ t(f.bodyKey) }}</p>

              <div v-if="f.id === 'how'" class="lp-tiles">
                <div v-for="tile in quickTiles" :key="tile.label" class="lp-tile">
                  <svg viewBox="0 0 24 24" fill="none" v-html="tile.path" />
                  <span>{{ t(tile.label) }}</span>
                </div>
              </div>

              <div v-else-if="f.id === 'cashback'" class="lp-bigcard">
                <p class="lp-bigcard__num">
                  <span data-count="60000">0</span> <span class="lp-bigcard__cur">{{ t('landing.currencySom') }}</span>
                </p>
                <div class="lp-bigcard__row">
                  <span class="lp-bigcard__field">{{ t('landing.bigcardField') }}</span>
                  <span class="lp-bigcard__send" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h13m-5-6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>

              <ul v-else class="lp-list">
                <li v-for="k in debtPoints" :key="k"><i>✓</i>{{ t(k) }}</li>
              </ul>
            </div>

            <template v-if="!f.flip">
              <div class="lp-stage lp-stage--right">
                <div :data-tilt="f.tilt" class="lp-device">
                  <div class="lp-device__screen"><img :src="f.shot" :alt="t(f.altKey)" /></div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- ЭКРАНЫ -->
    <section data-snap data-group class="lp-sec lp-sec--tight">
      <h2 data-lines class="lp-mid">
        <span class="lp-line"><i>{{ t('landing.railTitle') }} <em class="lp-grad">{{ t('landing.railAccent') }}</em> {{ t('landing.railRest') }}</i></span>
      </h2>
      <div data-drift class="lp-rail">
        <div v-for="s in rail" :key="s.altKey" class="lp-device lp-device--sm">
          <div class="lp-device__screen"><img :src="s.src" :alt="t(s.altKey)" /></div>
        </div>
      </div>
    </section>

    <!-- ЦИФРЫ -->
    <section data-group class="lp-stats">
      <div v-for="s in stats" :key="s.key" data-reveal class="lp-stat">
        <p class="lp-stat__num"><span :data-count="s.v" :data-suffix="s.sufKey ? t(s.sufKey) : s.suf">0</span></p>
        <span class="lp-stat__cap">{{ t(s.key) }}</span>
      </div>
    </section>

    <!-- ЗАВЕДЕНИЯМ -->
    <section id="partners" data-snap data-group class="lp-sec">
      <div class="lp-orb lp-orb--right" />
      <div class="lp-row lp-row--top">
        <div class="lp-col">
          <span data-reveal class="lp-badge">{{ t('landing.partnersBadge') }}</span>
          <h2 data-lines class="lp-title">
            <span class="lp-line"><i class="lp-grad">{{ t('landing.partnersTitleA') }}</i></span>
            <span class="lp-line"><i class="lp-grad">{{ t('landing.partnersTitleB') }}</i></span>
          </h2>
          <p data-reveal class="lp-body">
            {{ t('landing.partnersBody') }}
          </p>
          <ul class="lp-list">
            <li v-for="k in partnerPerks" :key="k" data-reveal><i>✓</i>{{ t(k) }}</li>
          </ul>
        </div>

        <div data-reveal class="lp-form">
          <template v-if="!sent">
            <h3>{{ t('landing.formTitle') }}</h3>
            <p class="lp-form__sub">{{ t('landing.formSub') }}</p>
            <div class="lp-form__fields">
              <input v-model="form.company" :placeholder="t('landing.formCompany')" class="lp-input" />
              <input v-model="form.contact" :placeholder="t('landing.formContact')" class="lp-input" />
              <input
                v-model="phoneMasked"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                maxlength="17"
                placeholder="+998 90 123 45 67"
                class="lp-input"
              />
              <input v-model="form.city" :placeholder="t('landing.formCity')" class="lp-input" />
              <textarea v-model="form.message" rows="3" :placeholder="t('landing.formMessage')" class="lp-input lp-input--area" />
              <button type="button" class="lp-btn lp-btn--block" :disabled="!formValid() || sending" @click="sendLead">
                {{ sending ? t('landing.formSending') : t('landing.formSubmit') }}
              </button>
              <p class="lp-form__note">{{ t('landing.formNote') }}</p>
            </div>
          </template>
          <div v-else class="lp-form__done">
            <span class="lp-form__check">✓</span>
            <h3>{{ t('landing.formSentTitle') }}</h3>
            <p class="lp-form__sub">{{ t('landing.formSentText') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- БЕГУЩАЯ СТРОКА -->
    <section class="lp-marquee-wrap">
      <div class="lp-marquee">
        <!-- содержимое продублировано: на -50% лента стыкуется без шва -->
        <span v-for="n in 2" :key="n" class="lp-marquee__set" :aria-hidden="n === 2">
          <span v-for="k in ticker" :key="k" class="lp-marquee__item">
            {{ t(k) }}<i aria-hidden="true">✳</i>
          </span>
        </span>
      </div>
    </section>

    <!-- ФИНАЛ -->
    <section data-snap data-group class="lp-final">
      <div class="lp-orb lp-orb--hero" />
      <h2 data-lines class="lp-display">
        <span class="lp-line"><i class="lp-grad">{{ t('landing.finalA') }}</i></span>
        <span class="lp-line"><i class="lp-grad lp-grad--fade">{{ t('landing.finalB') }}</i></span>
      </h2>
      <p data-reveal class="lp-lead">
        {{ t('landing.finalLead') }}
      </p>
      <div data-reveal class="lp-cta">
        <button type="button" class="lp-btn" @click="start">{{ t('landing.finalCta') }}</button>
      </div>
    </section>

    <footer class="lp-foot">
      <img :src="wordmark" alt="ZAP!" />
      <p>{{ t('landing.footer') }}</p>
    </footer>
  </div>
</template>

<style scoped>
.lp {
  --lime: #ddff33;
  --ink: #ffffff;
  --muted: rgba(255, 255, 255, 0.46);
  --line: rgba(255, 255, 255, 0.08);
  --surface: rgba(255, 255, 255, 0.032);
  position: relative;
  min-height: 100dvh;
  background: #000;
  color: var(--ink);
  /* здесь НЕТ overflow-x: clip — он ломает backdrop-filter у фиксированной
     шапки (в WebKit полностью). Горизонтальный вылет закрыт тем, что все
     свечения лежат внутри секций с overflow: hidden */
}
.lp :where(#how, #cashback, #partners) {
  scroll-margin-top: 96px;
}

/* ============ ШАПКА ============ */
.lp-nav {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 50;
  border-bottom: 1px solid transparent;
  transition: background-color 260ms ease, border-color 260ms ease;
}
.lp-nav.is-scrolled {
  background: rgba(10, 10, 10, 0.42);
  border-bottom-color: var(--line);
  -webkit-backdrop-filter: blur(22px) saturate(1.7);
  backdrop-filter: blur(22px) saturate(1.7);
}
/* если размытия нет (старый браузер) — просто плотный фон, без прозрачности */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .lp-nav.is-scrolled {
    background: rgba(0, 0, 0, 0.92);
  }
}
.lp-nav__inner {
  position: relative;
  margin: 0 auto;
  display: flex;
  max-width: 1200px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
}
.lp-nav__logo {
  height: 42px;
  width: auto;
}
@media (min-width: 900px) {
  .lp-nav__logo {
    height: 52px;
  }
}
.lp-nav__links {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: none;
  gap: 34px;
}
.lp-nav__links a {
  font-size: 14.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  transition: color 180ms ease;
}
.lp-nav__links a:hover {
  color: #fff;
}
@media (min-width: 900px) {
  .lp-nav__links {
    display: flex;
  }
}

/* ============ КНОПКИ ============ */
.lp-btn {
  display: inline-flex;
  height: 54px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--lime);
  padding: 0 34px;
  font-size: 15.5px;
  font-weight: 800;
  color: #12140b;
  transition: transform 160ms ease;
}
.lp-btn:active {
  transform: scale(0.97);
}
.lp-btn:disabled {
  opacity: 0.32;
}
.lp-btn--sm {
  height: 42px;
  padding: 0 22px;
  font-size: 14.5px;
}
.lp-btn--block {
  width: 100%;
  margin-top: 4px;
}
.lp-btn--ghost {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.13);
  color: #fff;
  font-weight: 700;
  padding: 0 30px;
}

/* ============ ТИПОГРАФИКА ============ */
.lp-display,
.lp-title {
  display: flex;
  flex-direction: column;
  font-weight: 800;
  letter-spacing: -0.035em;
}
.lp-display {
  font-size: clamp(56px, 11.5vw, 128px);
  line-height: 0.9;
  align-items: center;
  text-align: center;
}
/* длинная фраза: кегль меньше, иначе строка не помещается по ширине */
.lp-display--long {
  font-size: clamp(34px, 6.6vw, 78px);
  line-height: 0.98;
}
.lp-title {
  font-size: clamp(42px, 5.6vw, 72px);
  line-height: 0.94;
  letter-spacing: -0.03em;
}
.lp-mid {
  font-size: clamp(32px, 4.6vw, 60px);
  font-weight: 800;
  letter-spacing: -0.03em;
  text-align: center;
}
/* строка-маска: текст выезжает из-под неё при появлении */
.lp-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.09em;
  margin-bottom: -0.09em;
}
.lp-line > i {
  display: block;
  font-style: normal;
}
/* фирменный градиент вместо розово-фиолетового у референса */
.lp-grad {
  background: linear-gradient(104deg, #ffffff 0%, var(--lime) 42%, #a8cc24 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
em.lp-grad {
  font-style: normal;
}
/* вторая строка героя «уходит» в темноту, как в референсе */
.lp-grad--fade {
  background: linear-gradient(180deg, var(--lime) 0%, #7d9a1c 62%, #22280a 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
.lp-lead {
  margin: 26px auto 0;
  max-width: 520px;
  font-size: 16.5px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--muted);
  text-align: center;
}
.lp-body {
  margin-top: 22px;
  max-width: 420px;
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.62;
  color: var(--muted);
}
.lp-cta {
  margin-top: 34px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

/* ============ ЗАКРЕПЛЁННАЯ СЕКЦИЯ ФИЧ ============ */
/* на мобильном — обычный поток: закрепление там только мешает жестам */
.lp-featrow + .lp-featrow {
  margin-top: 96px;
}
@media (min-width: 900px) {
  /* закреплённая секция НЕ должна быть flex-контейнером: ScrollTrigger
     подменяет внутренний блок распоркой, а flex её сжимает — следующая
     секция начинает наезжать на закреплённую */
  /* специфичность выше, чем у .lp-sec ниже по файлу — иначе секция снова
     станет центрирующим flex-контейнером и закреплённый блок уедет вниз */
  .lp-sec.lp-pinsec {
    display: block;
    min-height: 0;
    padding: 0 24px;
  }
  .lp-pin {
    display: flex;
    min-height: 100vh;
    width: 100%;
    align-items: center;
  }
  /* слайды лежат друг на друге в одной ячейке грида */
  .lp-stack {
    display: grid;
    width: 100%;
  }
  .lp-stack > * {
    grid-area: 1 / 1;
  }
  .lp-featrow + .lp-featrow {
    margin-top: 0;
  }
}

/* ============ СЕКЦИИ ============ */
.lp-hero {
  position: relative;
  padding: 132px 24px 0;
  overflow: hidden;
}
.lp-sec {
  position: relative;
  padding: 118px 24px;
  overflow: hidden;
}
.lp-sec--tight {
  padding-top: 40px;
}
.lp-final {
  position: relative;
  padding: 130px 24px 150px;
  text-align: center;
  overflow: hidden;
}
.lp-row {
  margin: 0 auto;
  display: grid;
  max-width: 1100px;
  align-items: center;
  gap: 56px;
}
.lp-row--top {
  align-items: start;
}
.lp-col {
  min-width: 0;
}
@media (min-width: 900px) {
  /* секция занимает экран целиком — тогда посекционная прокрутка
     останавливается на осмысленных кадрах, как в референсе */
  .lp-hero,
  .lp-sec,
  .lp-final {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    justify-content: center;
  }
  .lp-hero {
    padding-top: 172px;
  }
  .lp-sec {
    padding: 120px 24px;
  }
  .lp-row {
    grid-template-columns: 1fr 1fr;
    gap: 64px;
  }
  .lp-col--end {
    text-align: right;
  }
  .lp-col--end .lp-body,
  .lp-col--end .lp-bigcard {
    margin-left: auto;
  }
  .lp-col--end .lp-title {
    align-items: flex-end;
  }
}
@media (max-width: 899px) {
  .lp-row--flip .lp-stage {
    order: 2;
  }
}

/* ============ СВЕЧЕНИЯ ============ */
.lp-orb {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
  filter: blur(130px);
  background: rgba(221, 255, 51, 0.12);
}
.lp-orb--hero {
  top: 4%;
  left: 50%;
  height: 440px;
  width: 720px;
  transform: translateX(-50%);
}
.lp-orb--left {
  top: 16%;
  left: 4%;
  height: 400px;
  width: 520px;
  background: rgba(221, 255, 51, 0.085);
}
.lp-orb--right {
  top: 16%;
  right: 2%;
  height: 400px;
  width: 520px;
  background: rgba(221, 255, 51, 0.085);
}

/* ============ ТЕЛЕФОН ============ */
.lp-stage {
  position: relative;
  display: flex;
  justify-content: center;
  perspective: 1500px;
}
.lp-stage--hero {
  margin-top: 74px;
}
/* мягкий «свет от пола» под аппаратом */
.lp-stage::after {
  content: '';
  position: absolute;
  bottom: -30px;
  left: 50%;
  height: 220px;
  width: 130%;
  max-width: 620px;
  transform: translateX(-50%);
  border-radius: 9999px;
  background: radial-gradient(closest-side, rgba(221, 255, 51, 0.2), transparent 72%);
  filter: blur(46px);
  pointer-events: none;
  z-index: 0;
}
.lp-device {
  position: relative;
  z-index: 1;
  width: 296px;
  border-radius: 46px;
  padding: 10px;
  background: linear-gradient(155deg, #4a4a4a 0%, #141414 34%, #0b0b0b 62%, #3a3a3a 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 70px 130px -46px rgba(0, 0, 0, 1),
    0 0 90px -44px rgba(221, 255, 51, 0.4);
}
.lp-device__screen {
  position: relative;
  overflow: hidden;
  border-radius: 37px;
  background: #000;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.lp-device__screen img {
  display: block;
  width: 100%;
  /* пропорции экранов известны заранее: страница не «прыгает» при догрузке */
  aspect-ratio: 780 / 1696;
}
.lp-device--hero {
  width: 316px;
}
.lp-device--sm {
  width: 218px;
  border-radius: 36px;
  padding: 8px;
  flex: 0 0 auto;
}
.lp-device--sm .lp-device__screen {
  border-radius: 29px;
}
@media (min-width: 900px) {
  .lp-device--hero {
    width: 352px;
  }
  .lp-stage--right {
    justify-content: flex-end;
  }
  .lp-stage--left {
    justify-content: flex-start;
  }
}

/* ============ ПЛИТКИ ============ */
.lp-tiles {
  margin-top: 38px;
  display: grid;
  max-width: 400px;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.lp-tile {
  display: flex;
  height: 92px;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 0 20px;
}
.lp-tile svg {
  height: 22px;
  width: 22px;
  color: var(--lime);
}
.lp-tile span {
  font-size: 13.5px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.74);
}

/* ============ БОЛЬШАЯ КАРТА ============ */
.lp-bigcard {
  margin-top: 38px;
  max-width: 420px;
  border-radius: 26px;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 26px;
  text-align: left;
}
.lp-bigcard__num {
  font-size: clamp(34px, 4.4vw, 46px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}
.lp-bigcard__cur {
  font-size: 17px;
  font-weight: 700;
  color: var(--muted);
}
.lp-bigcard__row {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.lp-bigcard__field {
  flex: 1;
  min-width: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  padding: 12px 18px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.42);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lp-bigcard__send {
  display: flex;
  height: 42px;
  width: 42px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--lime);
  color: #12140b;
}
.lp-bigcard__send svg {
  height: 19px;
  width: 19px;
}

/* ============ СПИСКИ / БЕЙДЖ ============ */
.lp-list {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lp-list li {
  display: flex;
  gap: 12px;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.68);
  text-align: left;
}
.lp-list i {
  display: flex;
  height: 20px;
  width: 20px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--lime);
  color: #12140b;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  margin-top: 2px;
}
.lp-badge {
  display: inline-flex;
  height: 32px;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(221, 255, 51, 0.26);
  background: rgba(221, 255, 51, 0.08);
  padding: 0 16px;
  margin-bottom: 22px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--lime);
}

/* ============ ЛЕНТА ЭКРАНОВ ============ */
.lp-rail {
  margin: 62px auto 0;
  display: flex;
  max-width: 1180px;
  gap: 26px;
  overflow-x: auto;
  padding: 0 24px 16px;
  scrollbar-width: none;
}
.lp-rail::-webkit-scrollbar {
  display: none;
}
/* на мобильном лента идёт от края до края: отступы секции гасим
   отрицательными полями, иначе слева остаётся пустая полоса */
@media (max-width: 899px) {
  .lp-rail {
    margin-right: -24px;
    margin-left: -24px;
    /* контейнер прокрутки во всю ширину, но по краям ленты — воздух */
    padding-right: 24px;
    padding-left: 24px;
  }
}
@media (min-width: 1200px) {
  .lp-rail {
    justify-content: center;
    overflow: visible;
  }
}

/* ============ ЦИФРЫ ============ */
.lp-stats {
  margin: 0 auto;
  display: grid;
  max-width: 1100px;
  gap: 16px;
  padding: 30px 24px 20px;
}
@media (min-width: 700px) {
  .lp-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
.lp-stat {
  border-radius: 24px;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 32px 24px;
  text-align: center;
}
.lp-stat__num {
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
  color: var(--lime);
  letter-spacing: -0.02em;
}
.lp-stat__cap {
  display: block;
  margin-top: 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--muted);
}

/* ============ БРЕНДЫ ============ */
.lp-brands {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 26px 54px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 34px 24px;
  opacity: 0.5;
}
.lp-brands img {
  width: auto;
  filter: brightness(0) invert(1);
}

/* ============ ФОРМА ============ */
.lp-form {
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.04);
  padding: 30px;
}
.lp-form h3 {
  font-size: 21px;
  font-weight: 800;
}
.lp-form__sub {
  margin-top: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--muted);
}
.lp-form__fields {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lp-input {
  height: 52px;
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.045);
  padding: 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  outline: none;
  transition: border-color 180ms ease;
}
.lp-input--area {
  height: auto;
  padding: 14px 16px;
  line-height: 1.45;
  resize: none;
}
.lp-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
.lp-input:focus {
  border-color: rgba(221, 255, 51, 0.5);
}
.lp-form__note {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.3);
}
.lp-form__done {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52px 0;
  text-align: center;
  gap: 8px;
}
.lp-form__check {
  display: flex;
  height: 64px;
  width: 64px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--lime);
  color: #12140b;
  font-size: 27px;
  margin-bottom: 12px;
}

/* ============ БЕГУЩАЯ СТРОКА ============ */
.lp-marquee-wrap {
  overflow: hidden;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 26px 0;
  /* края уводим в прозрачность, чтобы строка не обрывалась резко */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
}
.lp-marquee {
  display: flex;
  width: max-content;
  animation: lp-scroll 34s linear infinite;
}
.lp-marquee__set {
  display: flex;
}
.lp-marquee__item {
  display: flex;
  align-items: center;
  gap: 30px;
  padding-right: 30px;
  font-size: clamp(20px, 2.2vw, 30px);
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.62);
}
.lp-marquee__item i {
  font-style: normal;
  font-size: 0.62em;
  color: var(--lime);
}
@keyframes lp-scroll {
  to {
    transform: translateX(-50%);
  }
}

/* ============ ПОДВАЛ ============ */
.lp-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid var(--line);
  margin: 0 auto;
  max-width: 1100px;
  padding: 38px 24px;
}
.lp-foot img {
  height: 44px;
  width: auto;
  opacity: 0.6;
}
.lp-foot p {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3);
}
@media (min-width: 640px) {
  .lp-foot {
    flex-direction: row;
  }
}
</style>
