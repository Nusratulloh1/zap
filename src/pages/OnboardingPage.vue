<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { S } from '@/lib/strings'
import { tap } from '@/lib/haptics'
import StoryProgress, { type StoryProgressPalette } from '@/components/StoryProgress.vue'
import CountUp from '@/components/CountUp.vue'
import wordmark from '@/assets/brand/logo/zap-wordmark-large.png'
import avatar12 from '@/assets/brand/avatars/a12.png'
import avatar33 from '@/assets/brand/avatars/a33.png'
import avatar68 from '@/assets/brand/avatars/a68.png'
import partnerSafia from '@/assets/brand/partners/safia.png'
import partnerTexnomart from '@/assets/brand/partners/texnomart.png'
import partnerIdea from '@/assets/brand/partners/idea.png'

const router = useRouter()

const SLIDES = 3
const DURATION = 5000

const index = ref(0)
const progress = ref(0)
const direction = ref<'fwd' | 'back'>('fwd')

const isDark = computed(() => index.value === 1)

const palettes: StoryProgressPalette[] = [
  { done: '#111110', active: '#111110', track: 'rgba(17,17,16,0.2)' },
  { done: '#DDFF33', active: '#FFFFFF', track: 'rgba(255,255,255,0.25)' },
  { done: '#111110', active: '#111110', track: 'rgba(17,17,16,0.2)' },
]

const palette = computed(() => palettes[index.value]!)

let raf = 0
let elapsed = 0
let lastTs = 0
let paused = false
let pressStart = 0

function loop(ts: number) {
  if (!lastTs) lastTs = ts
  if (!paused) {
    elapsed += ts - lastTs
    progress.value = Math.min(1, elapsed / DURATION)
    if (elapsed >= DURATION) next()
  }
  lastTs = ts
  raf = requestAnimationFrame(loop)
}

function goTo(i: number) {
  const target = Math.max(0, Math.min(SLIDES - 1, i))
  direction.value = target >= index.value ? 'fwd' : 'back'
  index.value = target
  elapsed = 0
  progress.value = 0
}

function next() {
  if (index.value >= SLIDES - 1) {
    elapsed = 0
    progress.value = 1
    paused = true
    return
  }
  goTo(index.value + 1)
}

function onPointerDown() {
  pressStart = performance.now()
  paused = true
}

function onPointerUp(e: PointerEvent) {
  const wasHold = performance.now() - pressStart > 250
  paused = index.value >= SLIDES - 1 && progress.value >= 1
  if (wasHold) return
  tap()
  const x = e.clientX
  const { left, width } = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (x - left < width * 0.35) goTo(index.value - 1)
  else if (index.value < SLIDES - 1) goTo(index.value + 1)
}

function start() {
  tap()
  router.push('/auth/phone')
}

onMounted(() => {
  raf = requestAnimationFrame(loop)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div
    class="theme-fixed relative flex min-h-dvh flex-col overflow-hidden transition-colors duration-[320ms] ease-zap"
    :class="isDark ? 'bg-[#0E0E0C]' : 'bg-lime'"
  >
    <!-- точечная сетка тёмного слайда, кроссфейдом -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 transition-opacity duration-[320ms]"
      :style="{
        opacity: isDark ? 1 : 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1.2px, transparent 1.3px)',
        backgroundSize: '16px 16px',
      }"
    />

    <!-- шапка: прогресс + логотип -->
    <div class="relative z-10 px-5 pt-[calc(env(safe-area-inset-top)+20px)]">
      <StoryProgress :count="SLIDES" :index="index" :progress="progress" :palette="palette" />
      <img
        :src="wordmark"
        alt="ZAP!"
        class="mt-[14px] h-14 w-auto"
        :class="isDark && '[filter:drop-shadow(0_0_6px_rgba(255,255,255,0.35))]'"
      />
    </div>

    <!-- слайды -->
    <div
      class="relative z-10 flex flex-1 select-none flex-col px-5"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    >
      <Transition :name="direction === 'fwd' ? 'story-fwd' : 'story-back'" mode="out-in" appear :duration="{ enter: 620, leave: 220 }">
        <!-- 1/3 Сканируй счёт -->
        <div v-if="index === 0" :key="0" class="flex flex-1 flex-col justify-center gap-[18px]">
          <div
            class="st flex h-24 w-24 rotate-[-6deg] items-center justify-center rounded-[28px] bg-ink"
            style="--d: 0"
          >
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none" stroke="#DDFF33" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 15V9a3 3 0 0 1 3-3h6" />
              <path d="M31 6h6a3 3 0 0 1 3 3v6" />
              <path d="M40 31v6a3 3 0 0 1-3 3h-6" />
              <path d="M15 40H9a3 3 0 0 1-3-3v-6" />
              <rect x="15" y="15" width="16" height="16" rx="4" fill="#DDFF33" stroke="none" />
            </svg>
          </div>
          <p class="st font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink/55" style="--d: 1">
            {{ S.onboarding.stage(1) }}
          </p>
          <h1 class="st text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]" style="--d: 2">
            {{ S.onboarding.s1Title }}
          </h1>
          <p class="st max-w-[300px] text-[15px] font-semibold leading-[1.4] text-ink/70" style="--d: 3">
            {{ S.onboarding.s1Text }}
          </p>
        </div>

        <!-- 2/3 Дели поровну (тёмный) -->
        <div v-else-if="index === 1" :key="1" class="flex flex-1 flex-col justify-center gap-[18px] text-paper">
          <div class="st flex items-center" style="--d: 0">
            <img :src="avatar12" alt="" class="h-[62px] w-[62px] rounded-full border-[3px] border-[#0E0E0C] object-cover" />
            <img :src="avatar33" alt="" class="-ml-[18px] h-[62px] w-[62px] rounded-full border-[3px] border-[#0E0E0C] object-cover" />
            <img :src="avatar68" alt="" class="-ml-[18px] h-[62px] w-[62px] rounded-full border-[3px] border-[#0E0E0C] object-cover" />
            <span
              class="-ml-[18px] flex h-[62px] w-[62px] items-center justify-center rounded-full border-[3px] border-[#0E0E0C] bg-lime text-[15px] font-extrabold text-ink"
            >
              +5
            </span>
          </div>
          <p class="st font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-paper/50" style="--d: 1">
            {{ S.onboarding.stage(2) }}
          </p>
          <h1 class="st text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]" style="--d: 2">
            {{ S.onboarding.s2TitleA }}<br />{{ S.onboarding.s2TitleB }}
          </h1>
          <p class="st max-w-[310px] text-[15px] font-semibold leading-[1.4] text-paper/65" style="--d: 3">
            {{ S.onboarding.s2Text }}
          </p>
          <div class="st flex gap-2" style="--d: 4">
            <span
              v-for="(chip, i) in S.onboarding.s2Chips"
              :key="chip"
              class="flex h-[34px] items-center rounded-full px-[14px] text-[12.5px]"
              :class="i === 0 ? 'bg-lime font-extrabold text-ink' : 'bg-paper/[0.12] font-bold text-paper'"
            >
              {{ chip }}
            </span>
          </div>
        </div>

        <!-- 3/3 Кэшбэк ×2 -->
        <div v-else :key="2" class="flex flex-1 flex-col justify-center gap-[18px]">
          <div class="st flex items-center" style="--d: 0">
            <img :src="partnerSafia" alt="Safia" class="h-[38px] w-auto rotate-[-4deg] rounded-[11px]" />
            <img :src="partnerTexnomart" alt="Texnomart" class="-ml-[10px] h-[38px] w-auto rotate-[3deg] rounded-[11px]" />
            <img :src="partnerIdea" alt="idea" class="-ml-[10px] h-[38px] w-auto rotate-[-2deg] rounded-[11px]" />
          </div>
          <p class="st font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink/55" style="--d: 1">
            {{ S.onboarding.stage(3) }}
          </p>
          <h1 class="st text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]" style="--d: 2">
            {{ S.onboarding.s3TitleA }}<br />{{ S.onboarding.s3TitleB }}
          </h1>
          <p class="st max-w-[300px] text-[15px] font-semibold leading-[1.4] text-ink/70" style="--d: 3">
            {{ S.onboarding.s3Text }}
          </p>
          <div class="st flex h-[42px] w-fit items-center gap-2 rounded-full bg-ink px-[18px]" style="--d: 4">
            <span class="text-[14px] font-extrabold text-lime">
              <CountUp :value="60000" prefix="+" :duration="1400" />
            </span>
            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-paper/80">
              {{ S.onboarding.s3Counter }}
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- подвал -->
    <div class="relative z-10 px-5 pb-safe-8 pt-4">
      <Transition name="footer-swap" mode="out-in" appear :duration="{ enter: 520, leave: 180 }">
        <div v-if="index === SLIDES - 1" key="cta" class="space-y-[10px]">
          <button
            type="button"
            class="st press h-14 w-full rounded-full bg-ink text-[16px] font-extrabold text-paper"
            style="--d: 0"
            @click="start"
          >
            {{ S.onboarding.start }}
          </button>
          <button
            type="button"
            class="st press h-14 w-full rounded-full bg-paper/55 text-[16px] font-bold text-ink"
            style="--d: 1"
            @click="start"
          >
            {{ S.onboarding.haveAccount }}
          </button>
        </div>
        <p
          v-else
          key="hint"
          class="text-center text-[12.5px] font-bold transition-colors duration-300"
          :class="isDark ? 'text-paper/45' : 'text-ink/50'"
        >
          {{ S.onboarding.tapHint }}
        </p>
      </Transition>
    </div>
  </div>
</template>
