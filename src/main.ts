import { createApp } from 'vue'
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

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast.action('Обновление готово', 'Перезагрузить', () => updateSW(true))
  },
})

createApp(App).use(createPinia()).use(router).mount('#app')
initPressFeedback()
