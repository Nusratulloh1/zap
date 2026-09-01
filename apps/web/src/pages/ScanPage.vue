<script setup lang="ts">
// Дизайн 3d + реальная камера: getUserMedia → BarcodeDetector / jsQR.
// Без камеры (или в headless) — фолбэк-карточка с «Демо-чек».
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap, reducedMotion } from '@/lib/motion'
import { useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import jsQR from 'jsqr'
import { useContactsStore } from '@/entities/stores/contacts'
import { useDraftStore } from '@/entities/stores/draft'
import { fetchFeaturedBill } from '@/api'
import * as api from '@/api'
import { isRealApi } from '@/api'
import mysoliqLogo from '@/assets/brand/partners/mysoliq.svg'
import rahmatLogo from '@/assets/brand/partners/rahmat.svg'
import { sourceForUrl } from '@/lib/fiscalSources'
import { isStandalone, platform } from '@/lib/installPrompt'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

// dev-демо фискального QR: локальный фикстур-сервер (scripts/fiscal-fixture.mjs)
const showFiscalDemo = import.meta.env.DEV && isRealApi
const FISCAL_DEMO_PAYLOAD =
  localStorage.getItem('zap:fiscal-demo-payload') ??
  'http://localhost:3299/check?t=EP000000000001&r=481&s=120000000&fs=DEMO000000000001&d=202608261942'
const contacts = useContactsStore()
const draft = useDraftStore()

const video = ref<HTMLVideoElement | null>(null)
const cameraState = ref<'starting' | 'live' | 'denied'>('starting')

// iOS не запоминает доступ к камере навсегда (ограничение WebKit): в
// установленной PWA он спрашивается ОДИН раз за запуск приложения. Поясняем
// это пользователю вместо «просто не работает».
const isIos = computed(() => platform() === 'ios-safari' || platform() === 'ios-other')
const permissionHelp = computed(() => {
  if (isIos.value) {
    return isStandalone()
      ? t('scan.iosHintStandalone')
      : t('scan.iosHintSafari')
  }
  return t('scan.browserHint')
})
// режим: скан QR ⇄ фото (Gemini OCR). Камера общая — переключение не пере-запрашивает доступ.
const mode = ref<'scan' | 'photo'>('scan')
const ocrBusy = ref(false)
const frozen = ref(false)
/** рамка вокруг распознанного QR в экранных координатах */
const quad = ref<{ x: number; y: number; w: number; h: number } | null>(null)

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
  if (note) toast.success(t('scan.qrDetectedDemo'))
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
      toast.success(t('scan.qrDetected'))
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
    // неизвестный QR-URL (вероятно чек Rahmat/другого ОФД) → фото → Gemini,
    // а не тупик. Не-URL → ручной ввод суммы.
    if (/^https?:\/\//i.test(payload.trim())) {
      draft.scannedPayload = payload // DEBUG: показать отсканированную ссылку
      const src = sourceForUrl(payload)
      // Gemini читает ФОТО, а не ссылку: у Rahmat API ещё не вскрыт, поэтому
      // такой чек снимаем камерой и распознаём с изображения.
      toast(src ? t('scan.receiptPhotograph', { source: src.label }) : t('scan.receiptUnknown'))
      resumeForPhoto()
    } else {
      toast(t('scan.qrUnknown'))
      router.replace('/split/amount')
    }
  } else {
    void openDemoBill(true) // мок-демо: любой QR ведёт на демо-чек
  }
}

/** Вернуть камеру в живой режим и переключиться на фото (после неизвестного QR). */
function resumeForPhoto() {
  stopped = false
  frozen.value = false
  quad.value = null
  mode.value = 'photo'
  if (video.value) {
    gsap.set(video.value, { scale: 1 })
    void video.value.play().catch(() => undefined)
  }
  if (cameraState.value === 'live') detectTimer = window.setInterval(detectLoop, 100)
}

async function detectLoop() {
  if (mode.value !== 'scan' || frozen.value) return // в режиме фото QR не ищем
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

// ---------- фото → Gemini OCR ----------

/** Единый роутер результата OCR: позиции → экран проверки; только сумма →
 *  делим сумму; ничего → честная ошибка (без фейкового 0). */
async function routeOcr(file: File) {
  if (ocrBusy.value) return // in-flight guard: двойной тап не шлёт второй запрос
  ocrBusy.value = true
  try {
    let res: Awaited<ReturnType<typeof api.fiscalOcr>>
    try {
      res = await api.fiscalOcr(file)
    } catch (err) {
      // 429 — один авто-ретрай после короткого бэкоффа, потом дружелюбный тост
      const status = (err as { status?: number })?.status
      if (status !== 429) throw err
      toast(t('scan.tooOftenShort'))
      await new Promise((r) => setTimeout(r, 2500))
      res = await api.fiscalOcr(file)
    }
    const receipt = res.receipt
    if (receipt && (receipt.items?.length || res.itemsRecognized)) {
      draft.applyFiscalItems(receipt as never, true)
      toast.success(t('scan.photoOk'))
      router.push('/split/review')
    } else if (receipt && receipt.total > 0) {
      // тотал есть, позиции нет — идём со суммой (без «Позиций»)
      draft.startFiscal(receipt.total)
      draft.fiscalFailed()
      toast(t('scan.photoNoItems'))
      router.push('/split/members')
    } else {
      toast(t('scan.photoFailed'))
    }
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 429) toast(t('scan.tooOftenShort'))
    else toast(e instanceof Error && e.message ? e.message : t('scan.photoFailedShort'))
  } finally {
    ocrBusy.value = false
  }
}

/** Снимок текущего кадра камеры → JPEG → OCR. */
async function capturePhoto() {
  const el = video.value
  if (!el || !el.videoWidth || ocrBusy.value) return
  const c = document.createElement('canvas')
  c.width = el.videoWidth
  c.height = el.videoHeight
  c.getContext('2d')?.drawImage(el, 0, 0)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.9))
  if (blob) await routeOcr(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }))
}

/** Фолбэк без камеры: выбор/съёмка файла. */
async function onPhotoFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (file) await routeOcr(file)
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
  stopCamera()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="theme-fixed screen-lock relative flex flex-col bg-[#151513] text-white">
    <!-- живое видео с камеры -->
    <video
      ref="video"
      playsinline
      muted
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
      :class="cameraState === 'live' ? 'opacity-100' : 'opacity-0'"
    />
    <div v-if="cameraState === 'live'" class="absolute inset-0 bg-black/25" />
    <!-- подсветка найденного QR -->
    <div
      v-if="quad"
      class="pointer-events-none absolute z-10 rounded-2xl border-[3px] border-lime shadow-[0_0_24px_rgba(221,255,51,0.5)]"
      :style="{ left: quad.x - 8 + 'px', top: quad.y - 8 + 'px', width: quad.w + 16 + 'px', height: quad.h + 16 + 'px' }"
    />

    <!-- ЗОНА 1 — верх: × · переключатель · фонарик (одна строка) + скрим -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-[180px] bg-gradient-to-b from-black/75 via-black/30 to-transparent" />
    <div class="relative z-20 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      <button
        type="button"
        :aria-label="t('scan.closeAria')"
        class="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-black/30 text-white backdrop-blur"
        @click="router.push('/')"
      >
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m4.5 4.5 9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" /></svg>
      </button>

      <!-- сегментированный переключатель режима -->
      <div class="relative mx-auto flex h-10 w-[220px] shrink-0 rounded-full border border-white/[0.14] bg-black/35 p-1 backdrop-blur">
        <div
          class="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-lime"
          :style="{ transform: mode === 'photo' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform 220ms cubic-bezier(0.34,1.35,0.5,1)' }"
        />
        <button
          type="button"
          class="press relative z-10 h-8 flex-1 rounded-full text-[13px] font-bold transition-colors duration-200"
          :class="mode === 'scan' ? 'text-ink' : 'text-white/75'"
          @click="mode = 'scan'"
        >
          {{ t('scan.tabScan') }}
        </button>
        <button
          type="button"
          class="press relative z-10 h-8 flex-1 rounded-full text-[13px] font-bold transition-colors duration-200"
          :class="mode === 'photo' ? 'text-ink' : 'text-white/75'"
          @click="mode = 'photo'"
        >
          {{ t('scan.tabPhoto') }}
        </button>
      </div>

      <button
        type="button"
        :aria-label="t('scan.torchAria')"
        class="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-black/30 backdrop-blur"
        @click="toggleTorch"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L5 13H11L9 22L19 10H12.5L13 2Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- ЗОНА 2 — центр: рамка сканера (в фото-режиме пусто) / карточка без камеры -->
    <div class="relative z-10 flex flex-1 items-center justify-center px-4">
      <div
        v-if="cameraState !== 'denied' && mode === 'scan'"
        class="relative h-[232px] w-[232px]"
        :class="frozen && 'scale-105 transition-transform duration-300'"
      >
        <svg width="232" height="232" viewBox="0 0 232 232" fill="none" class="absolute inset-0">
          <path d="M6 54V22C6 13.2 13.2 6 22 6H54" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
          <path d="M178 6H210C218.8 6 226 13.2 226 22V54" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
          <path d="M226 178V210C226 218.8 218.8 226 210 226H178" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
          <path d="M54 226H22C13.2 226 6 218.8 6 210V178" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
        </svg>
        <div v-if="!frozen" class="laser absolute left-[22px] right-[22px] top-0 h-[3px] rounded-full bg-lime/60" />
      </div>

      <!-- нет камеры: одна аккуратная карточка -->
      <div v-else-if="cameraState === 'denied'" class="w-full rounded-card bg-black/55 p-6 text-center backdrop-blur">
        <p class="text-[17px] font-extrabold text-white">{{ t('scan.noCamera') }}</p>
        <!-- как вернуть доступ: инструкция под платформу пользователя -->
        <p class="mt-2 text-[12.5px] font-semibold leading-snug text-white/70">{{ permissionHelp }}</p>
        <p class="mt-2.5 text-[13.5px] font-semibold leading-snug text-white/85">
          {{ t('scan.orPhotoOrManual') }}
        </p>
        <div class="mt-4 flex items-center justify-center gap-2">
          <span class="flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3">
            <img :src="mysoliqLogo" alt="" class="h-[18px] w-auto" />
            <span class="text-[11.5px] font-bold text-[#364BA8]">MySoliq</span>
          </span>
          <span class="flex h-8 items-center rounded-full bg-white/95 px-3">
            <img :src="rahmatLogo" alt="Rahmat" class="h-[13px] w-auto" />
          </span>
        </div>
        <label class="press mt-5 flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-lime text-[15px] font-extrabold text-ink">
          {{ t('scan.photographReceipt') }}
          <input type="file" accept="image/*" capture="environment" class="hidden" @change="onPhotoFile" />
        </label>
        <button
          type="button"
          class="press mt-2.5 h-[46px] w-full rounded-full border border-white/[0.14] bg-white/10 text-[14px] font-bold text-white"
          @click="router.push('/split/amount')"
        >
          {{ t('scan.manual') }}
        </button>
        <button
          v-if="showFiscalDemo"
          type="button"
          class="press mt-2 h-9 w-full rounded-full text-[12px] font-bold text-white/45"
          @click="onDecoded(FISCAL_DEMO_PAYLOAD)"
        >
          {{ t('scan.devFiscal') }}
        </button>
      </div>
    </div>

    <!-- ЗОНА 3 — низ: подпись · основное действие · вторичная ссылка + скрим -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[230px] bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
    <div
      v-if="cameraState !== 'denied'"
      class="relative z-20 flex flex-col items-center gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+28px)]"
    >
      <p class="scan-caption text-center text-[15px] font-semibold text-white">
        <template v-if="cameraState === 'starting'">{{ t('scan.allowCamera') }}</template>
        <template v-else>{{ mode === 'scan' ? t('scan.aimAtQr') : t('scan.photoTitle') }}</template>
      </p>
      <!-- iOS: доступ спрашивается один раз за запуск приложения — поясняем -->
      <p
        v-if="cameraState === 'starting' && isIos"
        class="scan-caption -mt-2 max-w-[300px] text-center text-[12.5px] font-semibold leading-snug text-white/70"
      >
        {{ t('scan.oncePerLaunch') }}
      </p>

      <!-- поддерживаемые источники: реальные логотипы на светлой плашке
           (обе марки тёмные на прозрачном — на кадре камеры иначе не читаются) -->
      <div v-if="mode === 'scan'" class="flex items-center gap-2">
        <span class="flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 shadow-sm">
          <img :src="mysoliqLogo" alt="" class="h-[18px] w-auto" />
          <span class="text-[11.5px] font-bold text-[#364BA8]">MySoliq</span>
        </span>
        <span class="flex h-8 items-center rounded-full bg-white/95 px-3 shadow-sm">
          <img :src="rahmatLogo" alt="Rahmat" class="h-[13px] w-auto" />
        </span>
      </div>

      <!-- фото: затвор -->
      <button
        v-if="mode === 'photo'"
        type="button"
        :aria-label="t('scan.shutterAria')"
        class="press flex h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-white/85 disabled:opacity-60"
        :disabled="ocrBusy"
        @click="capturePhoto"
      >
        <span v-if="ocrBusy" class="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <span v-else class="h-[52px] w-[52px] rounded-full bg-lime" />
      </button>

      <button
        type="button"
        class="press scan-caption text-[13.5px] font-bold text-white/75"
        @click="router.push('/split/amount')"
      >
        {{ t('scan.manual') }}
      </button>
    </div>
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
/* читаемость подписей поверх любого кадра камеры */
.scan-caption {
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.75);
}
</style>
