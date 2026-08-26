<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/lib/toast'
import ToastHost from '@/components/ToastHost.vue'
import { bus } from '@/lib/bus'
import { S } from '@/lib/strings'
import { useUserStore } from '@/entities/stores/user'
import { initKeyboardAvoidance } from '@/lib/keyboard'
import { applyThemeColor } from '@/lib/theme'
import { resumeSimulations } from '@/mocks/events'
import { getDb } from '@/mocks/db'
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

// глобальные тосты о событиях сплита
bus.on('split:event', ({ kind, message }) => {
  if (kind === 'closed') return
  if (kind === 'cashback') toast.success(message)
  else toast(message)
})

// подсказка «на главный экран» со второго визита
onMounted(() => {
  initKeyboardAvoidance()
  if (user.isAuthed) resumeSimulations()
  try {
    if (getDb().settings.visits === 2 && !window.matchMedia('(display-mode: standalone)').matches) {
      setTimeout(() => toast(S.pwa.installHint), 2500)
    }
  } catch {
    /* noop */
  }
})

watch(
  () => user.isAuthed,
  (authed) => {
    if (authed) resumeSimulations()
  },
)
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-app bg-cream shadow-2xl shadow-black/5">
    <div class="relative min-h-dvh overflow-x-clip">
      <RouterView v-slot="{ Component }">
        <Transition
          :name="transitionName"
          @enter="onTransitionEnter"
          @before-leave="onBeforeLeave"
          @after-leave="onAfterLeave"
          @after-enter="onAfterEnter"
        >
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>

      <ActiveSplitPill />
      <TabBar v-if="showTabBar" />
    </div>

    <ToastHost />
  </div>
</template>
