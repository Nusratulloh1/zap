<script setup lang="ts">
// DEV-ONLY диагностика: с ТЕЛЕФОНА пользователя (узбекский IP) проверяем,
// какие источники данных чека доступны и открыт ли CORS для нашего origin.
// Роут регистрируется только в dev-сборке (см. router.ts).
import { ref } from 'vue'

interface Probe {
  name: string
  detail: string
  status: string
  ok: boolean | null
  ms: number
  snippet: string
}

const checkUrl = ref('https://ofd.soliq.uz/check?t=LG420211638943&r=6330&c=20260812111605&s=500597331143')
const pastedApi = ref('https://new-ofd.soliq.uz/api/payment')
const running = ref(false)
const results = ref<Probe[]>([])

function parseParams(u: string) {
  try {
    const p = new URL(u).searchParams
    return { t: p.get('t') ?? '', r: p.get('r') ?? '', c: p.get('c') ?? '', s: p.get('s') ?? '' }
  } catch {
    return { t: '', r: '', c: '', s: '' }
  }
}

async function timedFetch(name: string, detail: string, input: string, init: RequestInit): Promise<Probe> {
  const t0 = performance.now()
  try {
    const res = await fetch(input, { ...init, signal: AbortSignal.timeout(8000) })
    const text = await res.text().catch(() => '(body unreadable)')
    return {
      name,
      detail,
      status: `HTTP ${res.status}${res.type === 'opaque' ? ' (opaque)' : ''}`,
      ok: res.ok,
      ms: Math.round(performance.now() - t0),
      snippet: text.slice(0, 400),
    }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    // TypeError без статуса — классическая подпись CORS-блокировки в браузере
    return {
      name,
      detail,
      status: /TypeError|Failed to fetch/i.test(msg) ? 'CORS/NETWORK BLOCKED' : msg,
      ok: false,
      ms: Math.round(performance.now() - t0),
      snippet: msg,
    }
  }
}

async function run() {
  running.value = true
  results.value = []
  const p = parseParams(checkUrl.value)
  const push = (r: Probe) => results.value.push(r)

  // a) прямой GET страницы чека (ожидаем CORS-блок — фиксируем факт)
  push(await timedFetch('a) GET страницы чека', checkUrl.value, checkUrl.value, { method: 'GET' }))

  // b) JSON-API, который делает сама страница (POST с параметрами из QR)
  const body = JSON.stringify({
    terminalId: p.t,
    paymentNo: p.r,
    paymentDate: p.c,
    paymentType: 'CHECK',
    fiscalSign: p.s,
  })
  push(
    await timedFetch('b) POST JSON-API (без подписи)', `${pastedApi.value}  body=${body}`, pastedApi.value, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    }),
  )

  // c) тот же вызов в no-cors: если он «проходит», значит сеть есть, а мешает CORS
  push(
    await timedFetch('c) POST no-cors (сеть vs CORS)', 'mode=no-cors — тело недоступно, но видно доступность сети', pastedApi.value, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
  )

  // d) GET-вариант API (некоторые ОФД отдают чек по GET-параметрам)
  const getUrl = `${pastedApi.value}?terminalId=${encodeURIComponent(p.t)}&paymentNo=${encodeURIComponent(p.r)}&paymentDate=${encodeURIComponent(p.c)}&fiscalSign=${encodeURIComponent(p.s)}`
  push(await timedFetch('d) GET JSON-API c параметрами', getUrl, getUrl, { method: 'GET', headers: { Accept: 'application/json' } }))

  running.value = false
}

const copyAll = async () => {
  const text = results.value
    .map((r) => `${r.name}\n  ${r.detail}\n  → ${r.status} (${r.ms}ms)\n  ${r.snippet.replace(/\n/g, ' ').slice(0, 300)}`)
    .join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* noop */
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col gap-4 bg-paper px-5 pb-10 pt-[calc(env(safe-area-inset-top)+20px)]">
    <h1 class="text-[22px] font-extrabold">🔬 Fiscal probe (DEV)</h1>
    <p class="-mt-2 text-[12.5px] font-semibold text-muted">
      Открой на телефоне с узбекским интернетом. Проверяем, доступны ли данные чека с клиента и открыт ли CORS.
    </p>

    <label class="flex flex-col gap-1">
      <span class="font-mono text-[10px] font-bold tracking-[0.12em] text-faint-2">ССЫЛКА ЧЕКА (QR)</span>
      <textarea
        v-model="checkUrl"
        rows="3"
        class="w-full rounded-inner bg-shell px-3 py-2 font-mono text-[11px] outline-none"
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="font-mono text-[10px] font-bold tracking-[0.12em] text-faint-2">API URL (из DevTools, если другой)</span>
      <textarea
        v-model="pastedApi"
        rows="2"
        class="w-full rounded-inner bg-shell px-3 py-2 font-mono text-[11px] outline-none"
      />
    </label>

    <button
      type="button"
      class="press h-12 rounded-full bg-lime text-[15px] font-extrabold text-on-lime disabled:opacity-50"
      :disabled="running"
      @click="run"
    >
      {{ running ? 'Проверяем…' : 'Запустить проверку' }}
    </button>

    <button v-if="results.length" type="button" class="press h-10 rounded-full bg-sand text-[13px] font-bold" @click="copyAll">
      Скопировать результаты
    </button>

    <div v-for="(r, i) in results" :key="i" class="rounded-inner bg-shell p-3">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-[13px] font-extrabold">{{ r.name }}</span>
        <span
          class="shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold"
          :class="r.ok ? 'bg-lime text-on-lime' : 'bg-ink text-paper'"
        >
          {{ r.status }} · {{ r.ms }}ms
        </span>
      </div>
      <p class="mt-1 break-all font-mono text-[9.5px] leading-tight text-faint-2">{{ r.detail }}</p>
      <pre class="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-paper p-2 font-mono text-[9.5px] leading-tight">{{ r.snippet }}</pre>
    </div>
  </div>
</template>
