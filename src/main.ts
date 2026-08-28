import { createApp } from 'vue'
import { i18n } from '@/lib/i18n'
import { createPinia } from 'pinia'
import App from '@/app/App.vue'
import router from '@/app/router'
import '@/styles/main.css'
import { registerSW } from 'virtual:pwa-register'
import { initPressFeedback } from '@/lib/motion'
import { initTheme } from '@/lib/theme'
import { toast } from '@/lib/toast'
import { initInstallCapture } from '@/lib/installPrompt'

initTheme()
// стэшим beforeinstallprompt ДО маунта — иначе позднего слушателя Chrome не дождётся
initInstallCapture()

// ---------- обновление приложения ----------
// Три независимых механизма, чтобы установленная PWA никогда не «залипала»
// на старой сборке (её не перезагружают вручную неделями):
//   1) периодический поиск обновления (раз в минуту + при возврате в приложение);
//   2) авто-перезагрузка, когда новый SW взял управление (controllerchange);
//   3) ВИДИМАЯ кнопка «Обновить» в тосте — если авто-путь почему-то не сработал.
let reloading = false
function hardReload() {
  if (reloading) return
  reloading = true
  window.location.reload()
}

if ('serviceWorker' in navigator) {
  // новый SW активировался (skipWaiting+clientsClaim из autoUpdate) → перезагрузка
  navigator.serviceWorker.addEventListener('controllerchange', hardReload)
}

const updateSW = registerSW({
  immediate: true,
  // в autoUpdate этот колбэк вызывается, когда новая версия готова
  onNeedRefresh() {
    toast.action('Доступно обновление', 'Обновить', () => void updateSW(true))
  },
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    const check = () => r.update().catch(() => undefined)
    setInterval(check, 30_000) // пока приложение открыто
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check() // и при возврате в приложение
    })
    r.addEventListener('updatefound', () => {
      const nw = r.installing
      nw?.addEventListener('statechange', () => {
        // новая версия скачана, старый SW ещё управляет страницей
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast.action('Доступно обновление', 'Обновить', () => void updateSW(true))
          // и сами применяем через пару секунд, если пользователь не нажал
          setTimeout(() => void updateSW(true).catch(() => hardReload()), 2500)
        }
      })
    })
  },
})

createApp(App).use(createPinia()).use(i18n).use(router).mount('#app')
initPressFeedback()

// маркер сборки: помогает убедиться, что новая версия действительно доехала
;(window as unknown as { __ZAP_BUILD?: string }).__ZAP_BUILD = __BUILD_ID__
