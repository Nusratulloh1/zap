<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TAB_TRIO } from '@/app/router'
import { toast } from '@/lib/toast'
import ToastHost from '@/components/ToastHost.vue'
import InstallBanner from '@/components/InstallBanner.vue'
import InstallSheet from '@/components/InstallSheet.vue'
import { requestBanner } from '@/lib/installPrompt'
import { bus } from '@/lib/bus'
import { useUserStore } from '@/entities/stores/user'
import { initKeyboardAvoidance } from '@/lib/keyboard'
import { applyThemeColor } from '@/lib/theme'
import { resumeSimulations } from '@/api/events'
import { isRealApi } from '@/api'
import RealAuthSheets from '@/components/RealAuthSheets.vue'
import NameSheet from '@/components/NameSheet.vue'
import TabBar from '@/components/TabBar.vue'
import ActiveSplitPill from '@/components/ActiveSplitPill.vue'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const transitionName = ref('route-fade')

// dev-контроль: смена роута обязана дёрнуть transition-хуки
let transitionFired = false
function onTransitionEnter() {
  transitionFired = true
}

// --- фикс прыжка скролла при переходах ---
// Уходящую страницу замораживаем: fixed на текущих экранных координатах
// (top = rect.top уже включает -scrollY), затем мгновенно сбрасываем скролл —
// видимой остаётся только запинненная страница, входящая монтируется в
// документ, уже стоящий на нуле. Transform-анимация ухода живёт в классах
// и не конфликтует с инлайн-позиционированием.
function onBeforeLeave(el: Element) {
  const y = window.scrollY
  if (y <= 0) return
  const rect = el.getBoundingClientRect()
  const s = (el as HTMLElement).style
  s.position = 'fixed'
  s.top = rect.top + 'px'
  s.left = rect.left + 'px'
  s.width = rect.width + 'px'
  window.scrollTo({ top: 0, behavior: 'auto' })
}

function onAfterLeave(el: Element) {
  const s = (el as HTMLElement).style
  s.position = ''
  s.top = ''
  s.left = ''
  s.width = ''
}

// сигнал для scrollBehavior: enter-переход завершён, можно восстанавливать позицию
function onAfterEnter() {
  document.dispatchEvent(new CustomEvent('zap:route-enter-done'))
}

router.afterEach((to, from) => {
  applyThemeColor(to.path)
  if (from.matched.length === 0) {
    transitionName.value = 'route-fade'
    return
  }
  // трио пилл-нава (главная / пад суммы / история) — сиблинги: кроссфейд, не слайд
  if (TAB_TRIO.includes(to.path) && TAB_TRIO.includes(from.path)) {
    transitionName.value = 'route-fade'
    return
  }
  const toDepth = to.meta.depth ?? 0
  const fromDepth = from.meta.depth ?? 0
  // такеоверы (сканер, закрытие, кэшбэк): въезд снизу / уход вниз
  if (to.meta.takeover && toDepth >= fromDepth) transitionName.value = 'route-up'
  else if (from.meta.takeover && toDepth < fromDepth) transitionName.value = 'route-down'
  else if (toDepth === fromDepth) transitionName.value = 'route-fade'
  else transitionName.value = toDepth > fromDepth ? 'route-forward' : 'route-back'

  if (import.meta.env.DEV) {
    transitionFired = false
    setTimeout(() => {
      if (!transitionFired) {
        console.warn('[motion] route change completed WITHOUT a transition hook — check page root/transition classes:', to.fullPath)
      }
    }, 600)
  }
})

const showTabBar = computed(() => Boolean(route.meta.tab) && user.isAuthed)
const isLanding = computed(() => Boolean(route.meta.landing))

// глобальные тосты о событиях сплита
bus.on('split:event', ({ kind, message }) => {
  if (kind === 'closed') return
  if (kind === 'cashback') toast.success(message)
  else toast(message)
})

onMounted(() => {
  initKeyboardAvoidance()
  if (user.isAuthed) resumeSimulations()
  // баннер установки PWA: после онбординга, со 2-го визита или после первого сплита
  requestBanner(route.path, user.isAuthed)
})

watch(
  () => route.path,
  (path) => requestBanner(path, user.isAuthed),
)

watch(
  () => user.isAuthed,
  (authed) => {
    if (authed) resumeSimulations()
    // сессия гидрируется асинхронно — баннер установки ждёт авторизации
    requestBanner(route.path, authed)
  },
)
</script>

<template>
  <!-- лендинг — полноэкранный сайт, поэтому «карточка» max-w-app снимается -->
  <div
    class="app-root mx-auto min-h-dvh w-full bg-cream shadow-2xl shadow-black/5"
    :class="isLanding ? 'max-w-none shadow-none' : 'max-w-app'"
  >
    <!-- у лендинга своя фиксированная шапка со стеклом: клиппинг-контекст
         предка ломает её backdrop-filter, поэтому там обрезку не включаем -->
    <div class="relative min-h-dvh" :class="{ 'overflow-x-clip': !isLanding }">
      <RouterView v-slot="{ Component }">
        <Transition
          :name="transitionName"
          @enter="onTransitionEnter"
          @before-leave="onBeforeLeave"
          @after-leave="onAfterLeave"
          @after-enter="onAfterEnter"
        >
          <!-- главная живёт в keep-alive: возврат с пада не перезагружает её -->
          <KeepAlive :include="['HomePage']">
            <component :is="Component" :key="route.path" />
          </KeepAlive>
        </Transition>
      </RouterView>

    </div>

    <!-- Фиксированные оверлеи ВНЕ overflow-x-clip: в WebKit клиппинг-контекст
         у предка ломает backdrop-filter — стеклянный пилл-нав становился
         матовым/сплошным на iOS. -->
    <ActiveSplitPill />
    <TabBar v-if="showTabBar" />

    <ToastHost />
    <!-- на лендинг-хосте ставить нечего: приложение живёт на use.zapapp.uz -->
    <InstallBanner v-if="!isLanding" />
    <InstallSheet v-if="!isLanding" />
    <RealAuthSheets v-if="isRealApi" />
    <NameSheet />
  </div>
</template>
