<script setup lang="ts">
// Дизайн 3d + реальная камера: getUserMedia → BarcodeDetector / jsQR.
// Без камеры (или в headless) — фолбэк-карточка с «Демо-чек».
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap, reducedMotion } from '@/lib/motion'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import jsQR from 'jsqr'
import { useContactsStore } from '@/entities/stores/contacts'
import { useDraftStore } from '@/entities/stores/draft'
import { fetchFeaturedBill } from '@/api'
import * as api from '@/api'
import { isRealApi } from '@/api'

const router = useRouter()

// dev-демо фискального QR: локальный фикстур-сервер (scripts/fiscal-fixture.mjs)
const showFiscalDemo = import.meta.env.DEV && isRealApi
const FISCAL_DEMO_PAYLOAD =
  localStorage.getItem('zap:fiscal-demo-payload') ??
  'http://localhost:3299/check?t=EP000000000001&r=481&s=120000000&fs=DEMO000000000001&d=202608261942'
const contacts = useContactsStore()
const draft = useDraftStore()

const video = ref<HTMLVideoElement | null>(null)
const cameraState = ref<'starting' | 'live' | 'denied'>('starting')
const frozen = ref(false)
const hintVisible = ref(false)
/** рамка вокруг распознанного QR в экранных координатах */
const quad = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const hintChip = ref<HTMLElement | null>(null)
let hintTimer = 0

let stream: MediaStream | null = null
let stopped = false
let detectTimer = 0
const canvas = document.createElement('canvas')

function stopCamera() {
  clearInterval(detectTimer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

async function openDemoBill(note = false) {
  const bill = contacts.featuredBill ?? (await fetchFeaturedBill())
  draft.startFromBill(bill)
  if (note) toast.success('QR распознан · Bellissimo #481')
  router.replace('/split/bill')
}

type Pt = { x: number; y: number }

function coverMap(points: Pt[]): { x: number; y: number; w: number; h: number } | null {
  const el = video.value
  if (!el || !el.videoWidth) return null
  const vw = el.videoWidth
  const vh = el.videoHeight
  const cw = el.clientWidth
  const ch = el.clientHeight
  const scale = Math.max(cw / vw, ch / vh)
  const ox = (cw - vw * scale) / 2
  const oy = (ch - vh * scale) / 2
  const xs = points.map((p) => p.x * scale + ox)
  const ys = points.map((p) => p.y * scale + oy)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function onDecoded(payload: string, corners?: Pt[]) {
  if (stopped) return
  stopped = true
  try {
    navigator.vibrate?.(50)
  } catch {
    /* noop */
  }
  frozen.value = true
  video.value?.pause()
  clearInterval(detectTimer)
  clearTimeout(hintTimer)
  // подсветка найденного QR + лёгкий зум замороженного кадра
  if (corners?.length) quad.value = coverMap(corners)
  if (!reducedMotion() && video.value) {
    gsap.to(video.value, { scale: 1.03, duration: 0.45, ease: 'power2.out' })
  }
  setTimeout(() => void routePayload(payload), 480)
}

/** Классификация отсканированного QR через api.resolveQr (сплит / счёт /
 *  фискальный чек / неизвестное). Никогда не блокирует: фискальный чек сразу
 *  открывает экран счёта с мгновенным тоталом, позиции догружаются асинхронно. */
async function routePayload(payload: string) {
  const m = payload.match(/\/s\/([\w-]+)/i)
  if (m) {
    router.replace(`/s/${m[1]}`)
    return
  }
  try {
    const res = await api.resolveQr(payload)
    if (res.type === 'split') {
      router.replace(`/s/${res.code}`)
      return
    }
    if (res.type === 'bill') {
      draft.startFromBill(res.bill)
      toast.success('QR распознан')
      router.replace('/split/bill')
      return
    }
    if (res.type === 'fiscal') {
      // узбекский QR НЕ несёт суммы (s = фискальный признак, не тотал):
      // идём на экран чека в состоянии загрузки, тотал и позиции догрузятся.
      // Ручной ввод суммы предлагается ТОЛЬКО после неудачи фетча (в BillPage).
      draft.startFiscal(res.instant.totalAmount ?? 0, res.jobId)
      draft.scannedPayload = payload // DEBUG: показать отсканированную ссылку
      router.replace('/split/bill')
      return
    }
  } catch {
    /* сеть упала — ведём как unknown */
  }
  if (isRealApi) {
    toast('QR не распознан — введите сумму вручную')
    router.replace('/split/amount')
  } else {
    void openDemoBill(true) // мок-демо: любой QR ведёт на демо-чек
  }
}

async function detectLoop() {
  const el = video.value
  if (!el || el.readyState < 2) return
  // нативный детектор, если есть
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector
  if (BD) {
    try {
      const codes = (await new BD({ formats: ['qr_code'] }).detect(el)) as {
        rawValue: string
        cornerPoints?: Pt[]
      }[]
      if (codes.length && codes[0]) onDecoded(codes[0].rawValue, codes[0].cornerPoints)
      return
    } catch {
      /* падаем в jsQR */
    }
  }
  const w = (canvas.width = Math.min(el.videoWidth, 640))
  const h = (canvas.height = Math.round((el.videoHeight / el.videoWidth) * w) || 480)
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g || !w || !h) return
  g.drawImage(el, 0, 0, w, h)
  const img = g.getImageData(0, 0, w, h)
  const code = jsQR(img.data, w, h)
  if (code?.data) {
    const l = code.location
    // координаты канваса → координаты видео
    const k = el.videoWidth / w
    const pts = [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner].map((p) => ({
      x: p.x * k,
      y: p.y * k,
    }))
    onDecoded(code.data, pts)
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    cameraState.value = 'denied'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    if (!video.value) return
    video.value.srcObject = stream
    await video.value.play()
    cameraState.value = 'live'
    detectTimer = window.setInterval(detectLoop, 100)
    clearTimeout(hintTimer)
    hintTimer = window.setTimeout(() => {
      if (!stopped) {
        hintVisible.value = true
        requestAnimationFrame(() => {
          if (hintChip.value && !reducedMotion())
            gsap.fromTo(hintChip.value, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' })
        })
      }
    }, 8000)
  } catch {
    cameraState.value = 'denied'
  }
}

async function toggleTorch() {
  const track = stream?.getVideoTracks()[0]
  if (!track) return
  try {
    const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
    const cur = (track.getSettings() as MediaTrackSettings & { torch?: boolean }).torch
    if (caps.torch) await track.applyConstraints({ advanced: [{ torch: !cur } as MediaTrackConstraintSet] })
  } catch {
    /* фонарик недоступен */
  }
}

function onVisibility() {
  if (document.hidden) stopCamera()
  else if (cameraState.value === 'live' && !stopped) void startCamera()
}

onMounted(() => {
  void contacts.hydrate()
  void startCamera()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopped = true
  clearTimeout(hintTimer)
  stopCamera()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="theme-fixed relative flex min-h-dvh flex-col overflow-hidden bg-[#151513] px-5 pb-[46px] pt-[calc(env(safe-area-inset-top)+24px)] text-white">
    <!-- живое видео с камеры -->
    <video
      ref="video"
      playsinline
      muted
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
      :class="cameraState === 'live' ? 'opacity-100' : 'opacity-0'"
    />
    <div v-if="cameraState === 'live'" class="absolute inset-0 bg-black/30" />
    <!-- анимированная рамка вокруг распознанного QR -->
    <div
      v-if="quad"
      class="pointer-events-none absolute z-10 rounded-2xl border-[3px] border-lime shadow-[0_0_24px_rgba(221,255,51,0.5)]"
      :style="{ left: quad.x - 8 + 'px', top: quad.y - 8 + 'px', width: quad.w + 16 + 'px', height: quad.h + 16 + 'px' }"
    />

    <!-- верхние кнопки -->
    <div class="relative z-10 flex items-center justify-between">
      <button
        type="button"
        aria-label="Закрыть"
        class="press flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.14] bg-white/10 text-white"
        @click="router.push('/')"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m4.5 4.5 9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" /></svg>
      </button>
      <button
        type="button"
        aria-label="Фонарик"
        class="press flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.14] bg-white/10"
        @click="toggleTorch"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L5 13H11L9 22L19 10H12.5L13 2Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- рамка + лазер / фолбэк -->
    <div class="relative z-10 flex flex-1 flex-col items-center justify-center gap-[26px]">
      <template v-if="cameraState !== 'denied'">
        <div class="relative h-[232px] w-[232px]" :class="frozen && 'scale-105 transition-transform duration-300'">
          <svg width="232" height="232" viewBox="0 0 232 232" fill="none" class="absolute inset-0">
            <path d="M6 54V22C6 13.2 13.2 6 22 6H54" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
            <path d="M178 6H210C218.8 6 226 13.2 226 22V54" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
            <path d="M226 178V210C226 218.8 218.8 226 210 226H178" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
            <path d="M54 226H22C13.2 226 6 218.8 6 210V178" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
          </svg>
          <div v-if="!frozen" class="laser absolute left-[22px] right-[22px] top-0 h-[3px] rounded-full bg-lime/60" />
        </div>
        <p class="text-center text-[15px] font-semibold text-white">
          Наведи камеру на QR на кассе<br />или на счёте
        </p>
      </template>

      <template v-else>
        <div class="w-full rounded-card bg-white/[0.08] p-6 text-center">
          <p class="text-[17px] font-extrabold text-white">Нет доступа к камере</p>
          <p class="mt-1.5 text-[13.5px] font-semibold text-white/85">
            Разрешите доступ в настройках или продолжите без сканера
          </p>
          <button
            type="button"
            class="press mt-5 h-[54px] w-full rounded-full bg-lime text-[15px] font-extrabold text-ink"
            @click="openDemoBill()"
          >
            Демо-чек
          </button>
          <button
            v-if="showFiscalDemo"
            type="button"
            class="press mt-2 h-10 w-full rounded-full bg-white/10 text-[13px] font-bold text-white"
            @click="onDecoded(FISCAL_DEMO_PAYLOAD)"
          >
            DEV · фискальный чек
          </button>
        </div>
      </template>
    </div>

    <!-- хинт после 8с без результата -->
    <div v-if="hintVisible && !frozen" ref="hintChip" class="relative z-10 mb-2.5 flex items-center gap-2 rounded-full bg-white/10 py-2 pl-4 pr-2 backdrop-blur">
      <span class="min-w-0 flex-1 text-[12.5px] font-semibold text-white">Не находит QR?</span>
      <button type="button" class="press h-9 shrink-0 rounded-full bg-lime px-3.5 text-[12.5px] font-extrabold text-ink" @click="openDemoBill()">
        Демо-чек
      </button>
      <button type="button" class="press h-9 shrink-0 rounded-full bg-white/15 px-3.5 text-[12.5px] font-bold text-white" @click="router.push('/split/amount')">
        Ввести сумму
      </button>
    </div>

    <!-- вручную -->
    <button
      type="button"
      class="press relative z-10 flex h-[54px] items-center justify-center rounded-full border border-white/[0.14] bg-white/10 text-[15px] font-bold text-white"
      @click="router.push('/split/amount')"
    >
      Ввести сумму вручную
    </button>
  </div>
</template>

<style scoped>
@keyframes laser-sweep {
  0%,
  100% {
    transform: translateY(22px);
  }
  50% {
    transform: translateY(207px);
  }
}
.laser {
  animation: laser-sweep 2.2s ease-in-out infinite;
}
</style>
