<script setup lang="ts">
// Публичный лендинг ZAP!
//
// Вёрстка на собственных классах (.lp-*), а не на утилитах Tailwind: страница
// живёт вне обычной оболочки приложения, и так её оформление не зависит от
// того, какие утилиты попали в сборку.
//
// Каркас страницы — восемь шагов «как это работает» в ЗАКРЕПЛЁННОЙ секции:
// телефон стоит на месте, экран внутри и текст рядом сменяются по прокрутке.
// Все остальные эффекты (зачёркивание, счётчики, лента мерчантов, бегущая
// строка) тоже привязаны к скроллу — см. onMounted ниже.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { submitPartnerLead } from '@/api'
import { toast } from '@/lib/toast'
import { appHref } from '@/lib/site'
import { phone as formatPhone } from '@/lib/format'
import { startSmoothScroll, stopSmoothScroll, scrollToTarget, refreshMotion } from '@/lib/landingMotion'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import venueBellissimo from '@/assets/brand/venues/bellissimo.webp'
import venueEvos from '@/assets/brand/venues/evos.webp'
import venueSafia from '@/assets/brand/venues/safia.webp'
import venueBon from '@/assets/brand/venues/bon.webp'
import venueFeedup from '@/assets/brand/venues/feedup.webp'
import logoBellissimo from '@/assets/brand/partners/bellissimo-logo.png'
import logoEvos from '@/assets/brand/partners/evos.svg'
import logoSafia from '@/assets/brand/partners/safia-sq.png'
import logoFeedup from '@/assets/brand/partners/feedup-logo.png'

defineOptions({ name: 'LandingPage' })

gsap.registerPlugin(ScrollTrigger)

const router = useRouter()
const { t, locale } = useI18n()

// Снимки приложения лежат комплектом на каждый язык: в макете телефона должен
// быть интерфейс на языке посетителя. Комплекты снимает scripts/landing-shots.mjs.
// Второй аргумент — запасной кадр: пока комплект не переснят, шаг показывает
// ближайший существующий экран вместо «битой» картинки.
const SHOTS = import.meta.glob('../assets/landing/*/*.webp', { eager: true, import: 'default' }) as Record<string, string>
function shot(name: string, fallback = ''): string {
  const pick = (l: string, n: string) =>
    Object.entries(SHOTS).find(([path]) => path.endsWith(`/${l}/app-${n}.webp`))?.[1]
  return (
    pick(locale.value, name) ??
    pick('uz', name) ??
    (fallback ? (pick(locale.value, fallback) ?? pick('uz', fallback)) : undefined) ??
    ''
  )
}

const start = () => {
  const href = appHref('/onboarding')
  if (href.startsWith('http')) location.href = href
  else router.push(href)
}

// --- содержимое ---

const steps = computed(() => [
  { label: t('landing.step1Label'), title: t('landing.step1Title'), text: t('landing.step1Text'), src: shot('scan', 'receipt') },
  { label: t('landing.step2Label'), title: t('landing.step2Title'), text: t('landing.step2Text'), src: shot('receipt') },
  { label: t('landing.step3Label'), title: t('landing.step3Title'), text: t('landing.step3Text'), src: shot('members') },
  { label: t('landing.step4Label'), title: t('landing.step4Title'), text: t('landing.step4Text'), src: shot('debts') },
  { label: t('landing.step5Label'), title: t('landing.step5Title'), text: t('landing.step5Text'), src: shot('share', 'done') },
  { label: t('landing.step6Label'), title: t('landing.step6Title'), text: t('landing.step6Text'), src: shot('participant', 'amount') },
  { label: t('landing.step7Label'), title: t('landing.step7Title'), text: t('landing.step7Text'), src: shot('live', 'members') },
  { label: t('landing.step8Label'), title: t('landing.step8Title'), text: t('landing.step8Text'), src: shot('award', 'cashback') },
])

const problems = computed(() => [t('landing.problem1'), t('landing.problem2'), t('landing.problem3')])

const reasons = computed(() => [
  { title: t('landing.reason1Title'), text: t('landing.reason1Text'), icon: 'phone' },
  { title: t('landing.reason2Title'), text: t('landing.reason2Text'), icon: 'clock' },
  { title: t('landing.reason3Title'), text: t('landing.reason3Text'), icon: 'card' },
  { title: t('landing.reason4Title'), text: t('landing.reason4Text'), icon: 'people' },
])

const merchants = computed(() => [
  { name: 'Bellissimo Pizza', venue: venueBellissimo, logo: logoBellissimo, sub: t('landing.card1Sub'), badge: t('landing.card1Badge') },
  { name: 'Evos', venue: venueEvos, logo: logoEvos, sub: t('landing.card2Sub'), badge: t('landing.card2Badge') },
  { name: 'Safia', venue: venueSafia, logo: logoSafia, sub: t('landing.card3Sub'), badge: t('landing.card3Badge') },
  { name: 'Bon!', venue: venueBon, logo: '', sub: t('landing.card4Sub'), badge: t('landing.card4Badge') },
  { name: 'Feedup', venue: venueFeedup, logo: logoFeedup, sub: t('landing.card5Sub'), badge: t('landing.card5Badge') },
])

const faq = computed(() => [
  { q: t('landing.q1'), a: t('landing.a1') },
  { q: t('landing.q2'), a: t('landing.a2') },
  { q: t('landing.q3'), a: t('landing.a3') },
  { q: t('landing.q4'), a: t('landing.a4') },
  { q: t('landing.q5'), a: t('landing.a5') },
  { q: t('landing.q6'), a: t('landing.a6') },
])

const openFaq = ref<number | null>(null)
const toggleFaq = (i: number) => {
  openFaq.value = openFaq.value === i ? null : i
  // высота ответа меняет геометрию страницы — иначе триггеры ниже съезжают
  requestAnimationFrame(() => refreshMotion())
}

// --- заявка заведения ---
const modal = ref(false)
const sent = ref(false)
const sending = ref(false)
const form = ref({ company: '', contact: '', phone: '', city: '' })
const phoneMasked = computed({
  get: () => (form.value.phone ? formatPhone(form.value.phone) : ''),
  set: (v: string) => {
    // сначала отбрасываем префикс самой маски, иначе при посимвольном вводе
    // его цифры возвращаются в поле и номер разъезжается
    const rest = v.startsWith('+998') ? v.slice(4) : v
    let d = rest.replace(/\D/g, '')
    if (d.length > 9 && d.startsWith('998')) d = d.slice(3)
    form.value.phone = d.slice(0, 9)
  },
})
const formValid = () =>
  form.value.company.trim().length >= 2 && form.value.contact.trim().length >= 2 && form.value.phone.length === 9

function openModal() {
  modal.value = true
  sent.value = false
}

async function sendLead() {
  if (!formValid() || sending.value) return
  sending.value = true
  try {
    await submitPartnerLead({ ...form.value, phone: '+998' + form.value.phone, message: '' })
    sent.value = true
  } catch (e) {
    toast(e instanceof Error && e.message ? e.message : t('landing.modalFail'))
  } finally {
    sending.value = false
  }
}

// --- движение ---

// Заставка первой загрузки: счёт 1 200 000 распадается на три доли и улетает —
// метафора сплита ещё до того, как посетитель что-то прочитал. Живёт 2,6 с и
// снимается сама; страница под ней уже собрана, ScrollTrigger меряет её как
// обычно (заставка на position: fixed и в поток не входит).
const preloading = ref(true)
const preRoot = ref<HTMLElement | null>(null)
const preSum = ref<HTMLElement | null>(null)
const preNum = ref<HTMLElement | null>(null)

const root = ref<HTMLElement | null>(null)
const prog = ref<HTMLElement | null>(null)
const head = ref<HTMLElement | null>(null)
const pinWrap = ref<HTMLElement | null>(null)
const pin = ref<HTMLElement | null>(null)
const marq = ref<HTMLElement | null>(null)
const merchRail = ref<HTMLElement | null>(null)
const chart = ref<SVGPolylineElement | null>(null)
const k1 = ref<HTMLElement | null>(null)
const k2 = ref<HTMLElement | null>(null)
const activeStep = ref(0)

let ctx: gsap.Context | null = null
let onScroll: (() => void) | null = null
let marqueeTick: ((t: number) => void) | null = null

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')

onMounted(() => {
  startSmoothScroll()

  // заставка
  if (preRoot.value) {
    const parts = preRoot.value.querySelectorAll('[data-pre-part]')
    const o = { v: 0 }
    gsap
      .timeline({ onComplete: () => (preloading.value = false) })
      .to(o, {
        v: 100,
        duration: 1.1,
        ease: 'none',
        onUpdate: () => {
          if (preNum.value) preNum.value.textContent = String(Math.round(o.v)).padStart(3, '0')
        },
      })
      .to(preSum.value, { opacity: 0, y: -14, duration: 0.35, ease: 'power2.out' }, 0.9)
      .to(parts, { opacity: 1, y: -24, duration: 0.45, stagger: 0.06, ease: 'power3.out' }, 1.05)
      .to(parts, { x: (i: number) => [-260, 0, 260][i], opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 1.5)
      .to(preRoot.value, { yPercent: -100, duration: 0.7, ease: 'power4.inOut' }, 1.55)
  } else {
    preloading.value = false
  }

  // полоса прогресса + «стеклянная» шапка при прокрутке
  onScroll = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight
    if (prog.value) gsap.set(prog.value, { scaleX: h > 0 ? window.scrollY / h : 0 })
    head.value?.classList.toggle('is-scrolled', window.scrollY > 40)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  ctx = gsap.context(() => {
    // «как это происходит сейчас»: строки въезжают и перечёркиваются
    const rows = gsap.utils.toArray<HTMLElement>('[data-strike]')
    if (rows.length) {
      const lines = gsap.utils.toArray<HTMLElement>('[data-sline]')
      const tl = gsap.timeline({ scrollTrigger: { trigger: rows[0], start: 'top 78%' } })
      rows.forEach((r, i) => {
        tl.fromTo(r, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, i * 0.55)
        tl.to(lines[i]!, { scaleX: 1, duration: 0.5, ease: 'power2.inOut' }, i * 0.55 + 0.45)
      })
      tl.to(rows, { y: -70, opacity: 0, duration: 0.6, ease: 'power2.inOut' }, rows.length * 0.55 + 0.5).fromTo(
        '[data-prob-final]',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
        '-=.25',
      )
    }

    // ЗАКРЕПЛЁННАЯ секция: восемь шагов сменяют друг друга внутри одного экрана.
    // units — сколько «экранов» прокрутки держится шаг: третий и четвёртый
    // объёмнее по тексту, им дано вдвое больше.
    const screens = gsap.utils.toArray<HTMLElement>('[data-screen]')
    const texts = gsap.utils.toArray<HTMLElement>('[data-step-text]')
    if (screens.length && pin.value && pinWrap.value) {
      gsap.set(screens.slice(1), { opacity: 0, xPercent: 40 })
      gsap.set(texts.slice(1), { opacity: 0, y: 40 })
      gsap.set(texts[0]!, { opacity: 1, y: 0 })

      const units = [1, 1, 2, 2, 1, 1, 1, 1]
      const total = units.reduce((a, b) => a + b, 0)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinWrap.value,
          start: 'top top',
          end: '+=' + total * 90 + '%',
          pin: pin.value,
          scrub: 1,
          anticipatePin: 1,
          onUpdate: (st) => {
            let acc = 0
            let idx = 0
            const p = st.progress * total
            for (let i = 0; i < units.length; i++) {
              if (p >= acc) idx = i
              acc += units[i]!
            }
            activeStep.value = idx
          },
        },
      })

      let at = 0
      units.forEach((u, i) => {
        const startAt = at
        if (i > 0) {
          tl.to(screens[i - 1]!, { xPercent: -30, opacity: 0, scale: 0.96, duration: 0.28, ease: 'power2.inOut' }, startAt - 0.28)
            .to(texts[i - 1]!, { y: -40, opacity: 0, duration: 0.25, ease: 'power2.in' }, startAt - 0.28)
            .fromTo(screens[i]!, { xPercent: 40, opacity: 0, scale: 0.98 }, { xPercent: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, startAt - 0.1)
            .fromTo(texts[i]!, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, startAt)
        }
        at += u
      })
      tl.to({}, { duration: 0.2 })
    }

    // карточки причин выезжают из-под маски
    gsap.utils.toArray<HTMLElement>('[data-card]').forEach((c, i) => {
      gsap.from(c, {
        clipPath: 'inset(0 0 100% 0)',
        y: 20,
        duration: 0.8,
        ease: 'power3.out',
        delay: i * 0.08,
        scrollTrigger: { trigger: c, start: 'top 85%' },
      })
    })

    // лента заведений едет навстречу скроллу
    if (merchRail.value) {
      const rail = merchRail.value
      gsap.fromTo(
        rail,
        { x: 0 },
        {
          x: () => -(rail.scrollWidth - window.innerWidth + 40),
          ease: 'none',
          scrollTrigger: { trigger: rail, start: 'top bottom', end: 'bottom top', scrub: 1 },
        },
      )
    }

    // дашборд заведения: график рисуется, счётчики набегают
    if (chart.value) {
      const tl = gsap.timeline({ scrollTrigger: { trigger: chart.value, start: 'top 80%' } })
      tl.to(chart.value, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0)
      const count = (el: HTMLElement | null, to: number) => {
        if (!el) return
        const o = { v: 0 }
        tl.to(o, { v: to, duration: 1.2, ease: 'none', onUpdate: () => (el.textContent = fmt(o.v)) }, 0)
      }
      count(k1.value, 142)
      count(k2.value, 860000)
    }

    // подвал: гигантский ZAP! чуть отстаёт от скролла
    gsap.fromTo('[data-foot]', { yPercent: 14 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '[data-foot]', start: 'top bottom', end: 'bottom bottom', scrub: 1 } })
  }, root.value ?? undefined)

  // бегущая строка: скорость и направление зависят от скролла
  if (marq.value) {
    const el = marq.value
    let x = 0
    let dir = 1
    let speed = 0.6
    ScrollTrigger.create({
      onUpdate: (st) => {
        const v = st.getVelocity()
        if (Math.abs(v) > 40) dir = v > 0 ? 1 : -1
        speed = 0.6 + Math.min(Math.abs(v) / 900, 4)
      },
    })
    marqueeTick = () => {
      const w = (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? 0
      if (!w) return
      x -= dir * speed
      if (x <= -w) x += w
      if (x > 0) x -= w
      el.style.transform = `translateX(${x}px)`
    }
    gsap.ticker.add(marqueeTick)
  }

  // геометрия меняется после догрузки шрифтов и картинок
  if (document.fonts?.ready) void document.fonts.ready.then(() => refreshMotion())
})

onBeforeUnmount(() => {
  if (onScroll) window.removeEventListener('scroll', onScroll)
  if (marqueeTick) gsap.ticker.remove(marqueeTick)
  ctx?.revert()
  ScrollTrigger.getAll().forEach((st) => st.kill())
  stopSmoothScroll()
})
</script>

<template>
  <div ref="root" class="lp">
    <!-- ЗАСТАВКА: счёт распадается на доли -->
    <div v-if="preloading" ref="preRoot" class="lp-pre" aria-hidden="true">
      <div class="lp-pre__stack">
        <div ref="preSum" class="lp-pre__sum">1 200 000</div>
        <div class="lp-pre__parts">
          <div data-pre-part class="lp-pre__part">400 000</div>
          <div data-pre-part class="lp-pre__part">400 000</div>
          <div data-pre-part class="lp-pre__part">400 000</div>
        </div>
      </div>
      <div ref="preNum" class="lp-pre__num">000</div>
    </div>

    <div ref="prog" class="lp-prog" />

    <!-- ШАПКА -->
    <header ref="head" class="lp-head">
      <a href="#" class="lp-head__logo" @click.prevent="scrollToTarget('.lp')">
        <img :src="wordmark" alt="ZAP!" />
      </a>
      <nav class="lp-head__nav">
        <a href="#how" @click.prevent="scrollToTarget('#how')">{{ t('landing.navHow') }}</a>
        <a href="#merch" @click.prevent="scrollToTarget('#merch')">{{ t('landing.navMerch') }}</a>
        <a href="#faq" @click.prevent="scrollToTarget('#faq')">{{ t('landing.navFaq') }}</a>
      </nav>
      <div class="lp-head__actions">
        <LanguageSwitcher variant="landing" mode="dropdown" align="right" />
        <button type="button" class="lp-btn lp-btn--sm" @click="start">{{ t('landing.navDownload') }}</button>
      </div>
    </header>

    <!-- ГЕРОЙ -->
    <section class="lp-hero-sec">
      <div class="lp-hero-glow" />
      <div class="lp-hero-line" />
      <div class="lp-hero">
        <div>
          <div class="lp-kicker">{{ t('landing.heroKicker') }}</div>
          <h1 class="lp-h1">
            <span>{{ t('landing.heroLine1') }}</span>
            <span>{{ t('landing.heroLine2') }}</span>
            <span><em>{{ t('landing.heroLine3Accent') }}</em> {{ t('landing.heroLine3Rest') }}</span>
          </h1>
          <p class="lp-lead">{{ t('landing.heroSub') }}</p>
          <div class="lp-cta">
            <button type="button" class="lp-btn" @click="start">{{ t('landing.ctaDownload') }}</button>
            <a href="#how" class="lp-btn lp-btn--ghost" @click.prevent="scrollToTarget('#how')">{{ t('landing.ctaHow') }}</a>
          </div>
          <div class="lp-rails">
            <span>PAYME</span><span>CLICK</span><span>UZCARD</span><span>HUMO</span>
          </div>
        </div>

        <div class="lp-phone lp-phone--hero">
          <div class="lp-phone__screen"><img :src="shot('members')" :alt="t('landing.altPhone')" /></div>
        </div>
      </div>
    </section>

    <!-- КАК ЭТО ПРОИСХОДИТ СЕЙЧАС -->
    <section class="lp-problem">
      <div class="lp-problem__inner">
        <div class="lp-kicker lp-kicker--dark">{{ t('landing.problemKicker') }}</div>
        <div class="lp-strikes">
          <div v-for="p in problems" :key="p" data-strike class="lp-strike">
            {{ p }}<span data-sline class="lp-strike__line" />
          </div>
        </div>
        <div data-prob-final class="lp-problem__final">{{ t('landing.problemFinal') }}</div>
      </div>
    </section>

    <!-- ВОСЕМЬ ШАГОВ · ЗАКРЕПЛЁННАЯ СЕКЦИЯ -->
    <section id="how" ref="pinWrap" class="lp-how">
      <div ref="pin" class="lp-pin">
        <div class="lp-pinrow">
          <div class="lp-dots">
            <span v-for="(s, i) in steps" :key="s.label" :class="{ 'is-on': i === activeStep }" />
          </div>

          <div class="lp-pintext">
            <div v-for="s in steps" :key="s.label" data-step-text class="lp-step">
              <div class="lp-step__label">{{ s.label }}</div>
              <h3 class="lp-step__title">{{ s.title }}</h3>
              <p class="lp-step__text">{{ s.text }}</p>
            </div>
          </div>

          <div class="lp-phone lp-phone--step">
            <div class="lp-phone__screen">
              <img v-for="s in steps" :key="s.label" data-screen :src="s.src" :alt="s.title" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- БЕГУЩАЯ СТРОКА -->
    <section class="lp-marq-sec">
      <div ref="marq" class="lp-marq">
        <span>{{ t('landing.marquee') }}</span>
        <span aria-hidden="true">{{ t('landing.marquee') }}</span>
      </div>
    </section>

    <!-- ЧЕТЫРЕ ПРИЧИНЫ -->
    <section class="lp-reasons">
      <div class="lp-reasons__inner">
        <h2 class="lp-h2 lp-h2--dark">{{ t('landing.reasonsTitle') }}</h2>
        <div class="lp-reasons__grid">
          <div v-for="r in reasons" :key="r.title" data-card class="lp-card">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#3E3C35" stroke-width="1.5" aria-hidden="true">
              <template v-if="r.icon === 'phone'"><rect x="11" y="2" width="12" height="22" rx="3" /><line x1="4" y1="30" x2="30" y2="30" /></template>
              <template v-else-if="r.icon === 'clock'"><circle cx="17" cy="17" r="13" /><polyline points="17,9 17,17 24,20" /></template>
              <template v-else-if="r.icon === 'card'"><rect x="3" y="9" width="28" height="18" rx="3" /><line x1="3" y1="16" x2="31" y2="16" /></template>
              <template v-else><circle cx="12" cy="13" r="6" /><circle cx="24" cy="19" r="6" /></template>
            </svg>
            <h3>{{ r.title }}</h3>
            <p>{{ r.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ЛЕНТА ЗАВЕДЕНИЙ -->
    <section class="lp-strip">
      <div class="lp-strip__head">
        <h2 class="lp-h2">{{ t('landing.stripTitle') }} <em>{{ t('landing.stripTitleAccent') }}</em></h2>
        <p class="lp-strip__sub">{{ t('landing.stripSub') }}</p>
      </div>
      <div ref="merchRail" class="lp-rail">
        <div v-for="m in merchants" :key="m.name" class="lp-mcard">
          <div class="lp-mcard__photo"><img :src="m.venue" :alt="m.name" /></div>
          <div class="lp-mcard__body">
            <div class="lp-mcard__title">
              <img v-if="m.logo" :src="m.logo" alt="" />
              <span>{{ m.name }}</span>
            </div>
            <div class="lp-mcard__sub">{{ m.sub }}</div>
            <div class="lp-mcard__badge">{{ m.badge }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ЗАВЕДЕНИЯМ -->
    <section id="merch" class="lp-merch">
      <div class="lp-merch__inner">
        <div>
          <div class="lp-kicker lp-kicker--dark">{{ t('landing.merchKicker') }}</div>
          <h2 class="lp-h2 lp-h2--dark lp-merch__title">{{ t('landing.merchTitle') }}</h2>
          <div class="lp-terms">
            <div class="lp-term"><span>3%</span><span>{{ t('landing.merchFeeText') }}</span></div>
            <div class="lp-term"><span>{{ t('landing.merchKit') }}</span><span>{{ t('landing.merchKitText') }}</span></div>
            <div class="lp-term"><span>{{ t('landing.merchCab') }}</span><span>{{ t('landing.merchCabText') }}</span></div>
          </div>
          <button type="button" class="lp-btn lp-btn--outline" @click="openModal">{{ t('landing.merchCta') }}</button>
        </div>

        <div class="lp-dash">
          <div class="lp-dash__head"><span>{{ t('landing.dashVisits') }}</span><span>{{ t('landing.dashDays') }}</span></div>
          <div class="lp-dash__nums">
            <div><div ref="k1" class="lp-dash__num">0</div><div class="lp-dash__cap">{{ t('landing.dashK1') }}</div></div>
            <div><div ref="k2" class="lp-dash__num">0</div><div class="lp-dash__cap">{{ t('landing.dashK2') }}</div></div>
          </div>
          <svg viewBox="0 0 420 200" class="lp-dash__chart" :aria-label="t('landing.chartAria')">
            <line x1="0" y1="160" x2="420" y2="160" stroke="#E3E1D8" stroke-width="1" />
            <line x1="0" y1="100" x2="420" y2="100" stroke="#EFEDE7" stroke-width="1" />
            <line x1="0" y1="40" x2="420" y2="40" stroke="#EFEDE7" stroke-width="1" />
            <polyline
              ref="chart"
              points="10,150 70,138 130,120 190,124 250,92 310,66 380,28"
              fill="none"
              stroke="#111110"
              stroke-width="3"
              stroke-linejoin="round"
              stroke-dasharray="620"
              stroke-dashoffset="620"
            />
          </svg>
        </div>
      </div>
    </section>

    <!-- ВОПРОСЫ -->
    <section id="faq" class="lp-faq">
      <div class="lp-faq__inner">
        <h2 class="lp-h2">{{ t('landing.faqTitle') }}</h2>
        <div v-for="(f, i) in faq" :key="f.q" class="lp-acc" :class="{ 'is-last': i === faq.length - 1 }">
          <button type="button" class="lp-acc__btn" :aria-expanded="openFaq === i" @click="toggleFaq(i)">
            <span>{{ f.q }}</span>
            <span class="lp-acc__plus" :class="{ 'is-on': openFaq === i }">+</span>
          </button>
          <div class="lp-acc__body" :class="{ 'is-open': openFaq === i }"><p>{{ f.a }}</p></div>
        </div>
      </div>
    </section>

    <!-- ФИНАЛ -->
    <section class="lp-final">
      <h2 class="lp-final__title">{{ t('landing.finalTitle') }}</h2>
      <div class="lp-final__cta">
        <button type="button" class="lp-btn lp-btn--ink" @click="start">{{ t('landing.ctaIos') }}</button>
        <button type="button" class="lp-btn lp-btn--ink" @click="start">{{ t('landing.ctaAndroid') }}</button>
      </div>
      <div class="lp-final__site">{{ t('landing.site') }}</div>
    </section>

    <!-- ПОДВАЛ -->
    <footer class="lp-foot">
      <div class="lp-foot__inner">
        <div class="lp-foot__links">
          <a href="#how" @click.prevent="scrollToTarget('#how')">{{ t('landing.footProduct') }}</a>
          <a href="#merch" @click.prevent="scrollToTarget('#merch')">{{ t('landing.footMerch') }}</a>
          <a href="#faq" @click.prevent="scrollToTarget('#faq')">{{ t('landing.footContacts') }}</a>
          <a href="#faq" @click.prevent="scrollToTarget('#faq')">{{ t('landing.footPrivacy') }}</a>
          <span>{{ t('landing.footCopy') }}</span>
        </div>
        <div data-foot class="lp-foot__mark">ZAP!</div>
      </div>
    </footer>

    <!-- ЗАЯВКА ПАРТНЁРА -->
    <div v-if="modal" class="lp-modal" role="dialog" aria-modal="true">
      <div class="lp-modal__bg" @click="modal = false" />
      <div class="lp-modal__card">
        <div class="lp-modal__top">
          <div>
            <div class="lp-modal__kicker">{{ t('landing.modalKicker') }}</div>
            <h3>{{ t('landing.modalTitle') }}</h3>
          </div>
          <button type="button" class="lp-modal__x" :aria-label="t('landing.modalClose')" @click="modal = false">×</button>
        </div>

        <div v-if="!sent" class="lp-modal__body">
          <p class="lp-modal__sub">{{ t('landing.modalSub') }}</p>
          <input v-model="form.company" class="lp-input" :placeholder="t('landing.phVenue')" />
          <input v-model="form.contact" class="lp-input" :placeholder="t('landing.phContact')" />
          <input v-model="form.city" class="lp-input" :placeholder="t('landing.phCity')" />
          <input v-model="phoneMasked" type="tel" inputmode="tel" maxlength="17" class="lp-input lp-input--mono" placeholder="+998 90 123 45 67" />
          <button type="button" class="lp-modal__send" :disabled="!formValid() || sending" @click="sendLead">
            {{ sending ? t('landing.modalSending') : t('landing.modalSend') }}
          </button>
        </div>

        <div v-else class="lp-modal__done">
          <h3>{{ t('landing.modalDoneTitle') }}</h3>
          <p>{{ t('landing.modalDoneText') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lp {
  --lime: #ddff33;
  --ink: #111110;
  --deep: #0e0e0c;
  --cream: #f5f3ee;
  --line: #26251f;
  --stone: #3e3c35;
  --muted: #8a887e;
  --faint: #b3b1a8;
  position: relative;
  background: var(--ink);
  color: var(--cream);
  font-family: 'Manrope', Helvetica, Arial, sans-serif;
}
.lp :where(#how, #merch, #faq) {
  scroll-margin-top: 96px;
}

/* ============ ЗАСТАВКА ============ */
.lp-pre {
  position: fixed;
  inset: 0;
  z-index: 9800;
  background: var(--cream);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lp-pre__stack {
  position: relative;
  text-align: center;
}
.lp-pre__sum {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: clamp(28px, 6vw, 64px);
  letter-spacing: 0.06em;
  color: #3e3c35;
}
.lp-pre__parts {
  display: flex;
  gap: clamp(12px, 3vw, 40px);
  justify-content: center;
  margin-top: 18px;
}
.lp-pre__part {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(16px, 2.4vw, 28px);
  letter-spacing: 0.06em;
  color: #3e3c35;
  opacity: 0;
}
.lp-pre__num {
  position: absolute;
  bottom: 28px;
  right: 32px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--muted);
}

/* полоса прогресса чтения */
.lp-prog {
  position: fixed;
  inset: 0 0 auto 0;
  height: 3px;
  background: var(--lime);
  transform: scaleX(0);
  transform-origin: 0 50%;
  z-index: 9000;
}

/* ============ ШАПКА ============ */
.lp-head {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 7000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px clamp(18px, 4vw, 48px);
  border-bottom: 1px solid transparent;
  transition: background-color 0.35s, backdrop-filter 0.35s, padding 0.35s, border-color 0.35s;
}
.lp-head.is-scrolled {
  background: rgba(14, 14, 12, 0.72);
  border-bottom-color: var(--line);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  padding-top: 12px;
  padding-bottom: 12px;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .lp-head.is-scrolled {
    background: rgba(14, 14, 12, 0.95);
  }
}
.lp-head__logo img {
  display: block;
  height: clamp(48px, 4.2vw, 72px);
  width: auto;
  transition: height 0.35s;
}
.lp-head.is-scrolled .lp-head__logo img {
  height: 40px;
}
.lp-head__nav {
  display: none;
  align-items: center;
  gap: 28px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
}
.lp-head__nav a {
  color: var(--faint);
  transition: color 0.2s;
}
.lp-head__nav a:hover {
  color: var(--lime);
}
.lp-head__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
@media (min-width: 901px) {
  .lp-head__nav {
    display: flex;
  }
}

/* ============ КНОПКИ ============ */
.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: var(--lime);
  color: var(--ink);
  font-family: inherit;
  font-weight: 800;
  font-size: 16px;
  padding: 18px 30px;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.16s ease;
}
.lp-btn:active {
  transform: scale(0.97);
}
.lp-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.lp-btn--sm {
  padding: 12px 22px;
  font-size: 14.5px;
}
.lp-btn--ghost {
  background: none;
  border: 1px solid var(--stone);
  color: var(--cream);
  font-weight: 700;
}
.lp-btn--outline {
  margin-top: 44px;
  background: none;
  border: 1px solid var(--stone);
  color: var(--ink);
  font-weight: 700;
  padding: 16px 28px;
}
.lp-btn--ink {
  background: var(--ink);
  color: var(--lime);
}

/* ============ ТИПОГРАФИКА ============ */
.lp-kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.lp-kicker--dark {
  color: var(--muted);
}
.lp-h1 {
  margin: 22px 0 0;
  max-width: 11.5em;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 0.94;
  font-size: clamp(34px, 4.6vw, 78px);
  text-wrap: balance;
}
.lp-h1 span {
  display: block;
}
.lp-h1 em {
  font-style: normal;
  color: var(--lime);
}
.lp-h2 {
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-size: clamp(28px, 4.2vw, 60px);
  line-height: 1.04;
  max-width: 900px;
}
.lp-h2 em {
  font-style: normal;
  color: var(--lime);
}
.lp-h2--dark {
  color: var(--ink);
}
.lp-lead {
  margin: 26px 0 0;
  max-width: 520px;
  font-weight: 500;
  font-size: clamp(16px, 1.3vw, 19px);
  line-height: 1.5;
  color: var(--faint);
}
.lp-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}
.lp-rails {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: 34px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--muted);
}
.lp-rails span {
  opacity: 0.5;
  transition: opacity 0.25s, color 0.25s;
}
.lp-rails span:hover {
  opacity: 1;
  color: var(--lime);
}

/* ============ ГЕРОЙ ============ */
.lp-hero-sec {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: var(--ink);
}
.lp-hero-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(1100px 620px at 72% 42%, rgba(221, 255, 51, 0.1), rgba(221, 255, 51, 0) 62%);
  pointer-events: none;
}
.lp-hero-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(227, 225, 216, 0) 0%, rgba(227, 225, 216, 0.18) 38%, rgba(221, 255, 51, 0.35) 70%, rgba(227, 225, 216, 0) 100%);
}
.lp-hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: center;
  max-width: 1360px;
  margin: 0 auto;
  padding: 120px clamp(18px, 4vw, 48px) 72px;
  min-height: 100vh;
}
@media (min-width: 901px) {
  .lp-hero {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: clamp(24px, 5vw, 72px);
    padding-top: 132px;
  }
}

/* ============ ТЕЛЕФОН ============ */
.lp-phone {
  position: relative;
  aspect-ratio: 410 / 864;
  border-radius: 46px;
  border: 1px solid var(--stone);
  background: var(--deep);
  padding: 10px;
  box-shadow: 0 60px 120px rgba(0, 0, 0, 0.55);
}
.lp-phone__screen {
  position: absolute;
  inset: 10px;
  border-radius: 38px;
  overflow: hidden;
  background: #fff;
}
.lp-phone__screen img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}
.lp-phone--hero {
  justify-self: center;
  height: clamp(460px, 44vw, 640px);
  width: auto;
  margin: 0 auto;
}
@media (min-width: 901px) {
  .lp-phone--hero {
    transform: perspective(1400px) rotateY(-9deg) rotateX(4deg);
  }
}
.lp-phone--step {
  flex: 0 0 auto;
  height: min(720px, 80vh);
  width: auto;
  border-radius: 48px;
  box-shadow: 0 50px 110px rgba(0, 0, 0, 0.5);
}
.lp-phone--step .lp-phone__screen {
  border-radius: 40px;
  background: var(--cream);
}
/* экраны шага лежат стопкой: показывается тот, что сейчас активен */
.lp-phone--step .lp-phone__screen img {
  position: absolute;
  inset: 0;
}

/* ============ КАК СЕЙЧАС ============ */
.lp-problem {
  position: relative;
  background: var(--cream);
  color: #3e3c35;
  padding: clamp(90px, 14vh, 170px) clamp(18px, 4vw, 48px);
}
.lp-problem__inner {
  max-width: 1100px;
  margin: 0 auto;
}
.lp-strikes {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 48px;
}
.lp-strike {
  position: relative;
  align-self: flex-start;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-size: clamp(28px, 5vw, 64px);
  line-height: 1.05;
}
.lp-strike__line {
  position: absolute;
  left: 0;
  top: 55%;
  height: 5px;
  width: 100%;
  background: var(--lime);
  transform: scaleX(0);
  transform-origin: 0 50%;
}
.lp-problem__final {
  margin-top: 70px;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-size: clamp(30px, 5.6vw, 72px);
  line-height: 1.02;
  color: var(--ink);
  opacity: 0;
}

/* ============ ВОСЕМЬ ШАГОВ ============ */
.lp-how {
  position: relative;
  background: var(--ink);
}
.lp-pin {
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.lp-pinrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 96px clamp(18px, 4vw, 48px) 44px;
}
@media (min-width: 901px) {
  .lp-pinrow {
    flex-direction: row;
    gap: clamp(24px, 6vw, 90px);
  }
}
@media (max-height: 900px) {
  .lp-pinrow {
    padding-top: 74px;
    padding-bottom: 28px;
  }
}
.lp-dots {
  display: flex;
  flex-direction: row;
  gap: 10px;
  order: 0;
}
.lp-dots span {
  display: block;
  width: 34px;
  height: 2px;
  border-radius: 2px;
  background: var(--stone);
  transition: background 0.3s, transform 0.3s;
}
.lp-dots span.is-on {
  background: var(--lime);
  transform: scaleY(2);
}
@media (min-width: 901px) {
  .lp-dots {
    flex-direction: column;
  }
  .lp-dots span {
    width: 2px;
    height: 34px;
  }
  .lp-dots span.is-on {
    transform: scaleX(2);
  }
}
.lp-pintext {
  position: relative;
  flex: 1;
  max-width: 100%;
  order: 2;
  text-align: center;
}
@media (min-width: 901px) {
  .lp-pintext {
    max-width: 460px;
    min-height: 260px;
    order: 0;
    text-align: left;
  }
  /* тексты шагов лежат стопкой в одной точке — их меняет таймлайн */
  .lp-step {
    position: absolute;
    inset: 0;
  }
}
.lp-step__label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--lime);
  margin-bottom: 20px;
}
.lp-step__title {
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-size: clamp(28px, 3.4vw, 48px);
  line-height: 1.05;
}
.lp-step__text {
  margin: 18px 0 0;
  font-size: 18px;
  line-height: 1.5;
  color: var(--faint);
  font-weight: 500;
}

/* ============ БЕГУЩАЯ СТРОКА ============ */
.lp-marq-sec {
  position: relative;
  background: var(--deep);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 34px 0;
  overflow: hidden;
}
.lp-marq {
  display: flex;
  white-space: nowrap;
  will-change: transform;
}
.lp-marq span {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(26px, 4vw, 54px);
  letter-spacing: 0.02em;
  color: transparent;
  -webkit-text-stroke: 1px #5b594f;
  padding-right: 40px;
}

/* ============ ПРИЧИНЫ ============ */
.lp-reasons {
  background: var(--cream);
  color: #3e3c35;
  padding: clamp(90px, 13vh, 160px) clamp(18px, 4vw, 48px);
}
.lp-reasons__inner {
  max-width: 1180px;
  margin: 0 auto;
}
.lp-reasons__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  margin-top: 60px;
}
@media (min-width: 901px) {
  .lp-reasons__grid {
    grid-template-columns: 1fr 1fr;
  }
}
.lp-card {
  background: #fff;
  border: 1px solid #e3e1d8;
  border-radius: 24px;
  padding: 34px;
  transition: transform 0.3s, background 0.3s;
}
.lp-card:hover {
  transform: translateY(-6px);
  background: #f0eee8;
}
.lp-card:hover svg {
  stroke: #8ca300;
}
.lp-card h3 {
  margin: 22px 0 10px;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.lp-card p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: #5b594f;
  font-weight: 500;
}

/* ============ ЛЕНТА ЗАВЕДЕНИЙ ============ */
.lp-strip {
  background: var(--ink);
  padding: clamp(90px, 13vh, 160px) 0;
  overflow: hidden;
}
.lp-strip__head {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 clamp(18px, 4vw, 48px);
}
.lp-strip__sub {
  margin: 22px 0 0;
  max-width: 560px;
  font-size: 17px;
  line-height: 1.5;
  color: var(--muted);
  font-weight: 500;
}
.lp-rail {
  display: flex;
  gap: 18px;
  margin-top: 56px;
  padding: 0 clamp(18px, 4vw, 48px);
  will-change: transform;
}
.lp-mcard {
  flex: 0 0 clamp(240px, 22vw, 300px);
  background: var(--deep);
  border: 1px solid var(--line);
  border-radius: 24px;
  overflow: hidden;
}
.lp-mcard__photo {
  height: 150px;
  background: #141410;
  overflow: hidden;
}
.lp-mcard__photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lp-mcard__body {
  padding: 20px 20px 22px;
}
.lp-mcard__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.02em;
}
.lp-mcard__title img {
  height: 26px;
  width: 26px;
  object-fit: contain;
  border-radius: 6px;
  background: var(--cream);
  padding: 2px;
}
.lp-mcard__sub {
  font-size: 13px;
  color: var(--muted);
  margin-top: 8px;
}
.lp-mcard__badge {
  display: inline-block;
  margin-top: 14px;
  background: var(--lime);
  color: var(--ink);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  padding: 6px 10px;
  border-radius: 999px;
}

/* ============ ЗАВЕДЕНИЯМ ============ */
.lp-merch {
  background: var(--cream);
  color: #3e3c35;
  padding: clamp(90px, 13vh, 160px) clamp(18px, 4vw, 48px);
}
.lp-merch__inner {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(30px, 6vw, 80px);
  align-items: center;
}
@media (min-width: 901px) {
  .lp-merch__inner {
    grid-template-columns: 1fr 1fr;
  }
}
.lp-merch__title {
  margin-top: 24px;
  font-size: clamp(28px, 3.9vw, 56px);
}
.lp-terms {
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin-top: 44px;
}
.lp-term {
  display: flex;
  gap: 18px;
  align-items: baseline;
  border-top: 1px solid #e3e1d8;
  padding-top: 18px;
}
.lp-term span:first-child {
  flex: 0 0 130px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.lp-term span:last-child {
  font-size: 16px;
  line-height: 1.5;
  color: #5b594f;
  font-weight: 500;
}
.lp-dash {
  background: #fff;
  border: 1px solid #e3e1d8;
  border-radius: 26px;
  padding: 26px;
}
.lp-dash__head {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--muted);
}
.lp-dash__nums {
  display: flex;
  gap: 26px;
  margin-top: 20px;
}
.lp-dash__num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  color: var(--ink);
}
.lp-dash__cap {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}
.lp-dash__chart {
  width: 100%;
  height: auto;
  margin-top: 22px;
}

/* ============ ВОПРОСЫ ============ */
.lp-faq {
  background: var(--ink);
  padding: clamp(90px, 13vh, 160px) clamp(18px, 4vw, 48px);
}
.lp-faq__inner {
  max-width: 960px;
  margin: 0 auto;
}
.lp-faq .lp-h2 {
  margin-bottom: 56px;
}
.lp-acc {
  border-top: 1px solid var(--line);
}
.lp-acc.is-last {
  border-bottom: 1px solid var(--line);
}
.lp-acc__btn {
  width: 100%;
  background: none;
  border: none;
  padding: 26px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  text-align: left;
  color: var(--cream);
  font-family: inherit;
  font-weight: 700;
  font-size: clamp(17px, 1.6vw, 22px);
  cursor: pointer;
}
.lp-acc__plus {
  flex: 0 0 auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  color: var(--lime);
  display: inline-block;
  transition: transform 0.4s, color 0.4s;
}
.lp-acc__plus.is-on {
  transform: rotate(135deg);
  color: var(--cream);
}
.lp-acc__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.lp-acc__body.is-open {
  grid-template-rows: 1fr;
}
.lp-acc__body > p {
  overflow: hidden;
  margin: 0;
  max-width: 640px;
  font-size: 17px;
  line-height: 1.55;
  color: var(--muted);
  font-weight: 500;
}
.lp-acc__body.is-open > p {
  padding-bottom: 26px;
}

/* ============ ФИНАЛ ============ */
.lp-final {
  background: var(--lime);
  color: var(--ink);
  padding: clamp(100px, 16vh, 190px) clamp(18px, 4vw, 48px);
  text-align: center;
}
.lp-final__title {
  margin: 0 auto;
  max-width: 1000px;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-size: clamp(34px, 6.4vw, 96px);
  line-height: 0.98;
  text-wrap: balance;
}
.lp-final__cta {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 48px;
}
.lp-final__site {
  margin-top: 36px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.16em;
}

/* ============ ПОДВАЛ ============ */
.lp-foot {
  position: relative;
  background: var(--ink);
  padding: 80px clamp(18px, 4vw, 48px) 0;
  overflow: hidden;
}
.lp-foot__inner {
  max-width: 1440px;
  margin: 0 auto;
}
.lp-foot__links {
  border-top: 1px solid var(--line);
  padding-top: 26px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px 40px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.lp-foot__links a {
  color: var(--muted);
  transition: color 0.2s;
}
.lp-foot__links a:hover {
  color: var(--lime);
}
.lp-foot__links span {
  margin-left: auto;
  color: #5b594f;
}
.lp-foot__mark {
  font-weight: 800;
  font-style: italic;
  letter-spacing: -0.05em;
  font-size: clamp(120px, 26vw, 420px);
  line-height: 0.78;
  color: var(--cream);
  margin-top: 40px;
  margin-bottom: -0.14em;
  text-align: center;
}

/* ============ МОДАЛКА ============ */
.lp-modal {
  position: fixed;
  inset: 0;
  z-index: 9200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.lp-modal__bg {
  position: absolute;
  inset: 0;
  background: rgba(14, 14, 12, 0.72);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.lp-modal__card {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: var(--cream);
  color: #3e3c35;
  border-radius: 26px;
  padding: 32px;
}
.lp-modal__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.lp-modal__top h3 {
  margin: 10px 0 0;
  font-weight: 800;
  font-size: 24px;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.lp-modal__kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--muted);
}
.lp-modal__x {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e3e1d8;
  background: #fff;
  color: #3e3c35;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.lp-modal__body {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lp-modal__sub {
  margin: 0 0 4px;
  font-size: 14px;
  line-height: 1.5;
  color: #5b594f;
}
.lp-input {
  width: 100%;
  padding: 15px 16px;
  border: 1px solid #e3e1d8;
  border-radius: 14px;
  background: #fff;
  font-family: inherit;
  font-size: 15px;
  color: var(--ink);
  outline: none;
  transition: border-color 0.2s;
}
.lp-input:focus {
  border-color: var(--lime);
}
.lp-input--mono {
  font-family: 'JetBrains Mono', monospace;
}
.lp-modal__send {
  margin-top: 6px;
  width: 100%;
  padding: 16px 0;
  border: none;
  border-radius: 999px;
  background: var(--ink);
  color: var(--lime);
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
}
.lp-modal__send:disabled {
  opacity: 0.35;
  cursor: default;
}
.lp-modal__done {
  margin-top: 22px;
}
.lp-modal__done h3 {
  margin: 0;
  font-weight: 800;
  font-size: 22px;
  color: var(--ink);
}
.lp-modal__done p {
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.5;
  color: #5b594f;
}
</style>
