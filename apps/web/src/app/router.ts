import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/entities/stores/user'
import { APP_ORIGIN, LANDING_ORIGIN, siteMode } from '@/lib/site'

declare module 'vue-router' {
  interface RouteMeta {
    depth: number
    tab?: boolean
    public?: boolean
    guest?: boolean
    /** полноэкранный такеовер: въезжает снизу, уезжает вниз */
    takeover?: boolean
  }
}

// скроллом управляем сами: пиннинг уходящей страницы + отложенный restore
if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual'

// трио пилл-нава — сиблинги одного уровня: кроссфейд + возврат скролла
export const TAB_TRIO = ['/', '/history', '/split/amount']
const tabScroll = new Map<string, number>()

const router = createRouter({
  history: createWebHistory(),
  // Вперёд: скролл сбрасывается мгновенно в @before-leave (App.vue) — уходящая
  // страница к этому моменту запиннена fixed и визуально не двигается.
  // Назад/вперёд по истории: восстанавливаем сохранённую позицию ПОСЛЕ
  // enter-перехода (событие zap:route-enter-done) и полного рендера высоты,
  // иначе restore обрезается по короткой странице — ещё один источник прыжка.
  scrollBehavior(to, _from, savedPosition) {
    // внутри трио пилл-нава позиция хранится и без history-pop (тап по иконке)
    const target = savedPosition ?? (TAB_TRIO.includes(to.path) && tabScroll.has(to.path) ? { left: 0, top: tabScroll.get(to.path)! } : null)
    if (!target) return false
    return new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        document.removeEventListener('zap:route-enter-done', finish)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve({ ...target, behavior: 'auto' as const })),
        )
      }
      document.addEventListener('zap:route-enter-done', finish, { once: true })
      window.setTimeout(finish, 700) // страховка, если переход не случился
    })
  },
  routes: [
    { path: '/onboarding', component: () => import('@/pages/OnboardingPage.vue'), meta: { depth: 0, guest: true } },
    { path: '/auth/phone', component: () => import('@/pages/AuthPhonePage.vue'), meta: { depth: 1, guest: true } },
    { path: '/auth/code', component: () => import('@/pages/AuthCodePage.vue'), meta: { depth: 2, guest: true } },

    // «/» — приложение для авторизованных; гостей гард уводит на /landing
    { path: '/', name: 'root', component: () => import('@/pages/HomePage.vue'), meta: { depth: 0, tab: true } },
    { path: '/landing', component: () => import('@/pages/LandingPage.vue'), meta: { depth: 0, guest: true, landing: true } },
    { path: '/history', component: () => import('@/pages/HistoryPage.vue'), meta: { depth: 0, tab: true } },
    { path: '/cashback', component: () => import('@/pages/CashbackPage.vue'), meta: { depth: 3 } },
    { path: '/profile', component: () => import('@/pages/ProfilePage.vue'), meta: { depth: 3 } },

    { path: '/debts', component: () => import('@/pages/DebtsPage.vue'), meta: { depth: 1 } },
    { path: '/groups/:id', component: () => import('@/pages/GroupPage.vue'), meta: { depth: 1 } },

    { path: '/split/scan', component: () => import('@/pages/ScanPage.vue'), meta: { depth: 1, takeover: true } },
    { path: '/split/bill', component: () => import('@/pages/BillPage.vue'), meta: { depth: 2 } },
    { path: '/split/amount', component: () => import('@/pages/AmountPage.vue'), meta: { depth: 2, tab: true } },
    { path: '/split/review', component: () => import('@/pages/ReviewItemsPage.vue'), meta: { depth: 3 } },
    { path: '/split/members', component: () => import('@/pages/MembersPage.vue'), meta: { depth: 3 } },
    { path: '/split/:id/share', component: () => import('@/pages/SharePage.vue'), meta: { depth: 4 } },
    { path: '/split/:id/closed', component: () => import('@/pages/SplitClosedPage.vue'), meta: { depth: 5, takeover: true } },
    { path: '/split/:id/save-group', component: () => import('@/pages/SaveGroupPage.vue'), meta: { depth: 6 } },
    { path: '/split/:id/cashback', component: () => import('@/pages/CashbackAwardPage.vue'), meta: { depth: 6, takeover: true } },
    { path: '/split/:id', component: () => import('@/pages/SplitLivePage.vue'), meta: { depth: 4 } },

    { path: '/s/:code', component: () => import('@/pages/ParticipantPage.vue'), meta: { depth: 1, public: true } },

    // DEV-only: диагностика источников данных фискального чека (на телефоне).
    // В прод-сборке ветка вырезается бандлером (import.meta.env.DEV === false).
    ...(import.meta.env.DEV
      ? [{ path: '/dev/fiscal-probe', component: () => import('@/pages/FiscalProbePage.vue'), meta: { depth: 1, public: true } }]
      : []),

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, from) => {
  // запомнить скролл уходящего таба ДО пиннинга/сброса (hooks идут позже)
  if (typeof window !== 'undefined' && from.matched.length && TAB_TRIO.includes(from.path)) {
    tabScroll.set(from.path, window.scrollY)
  }

  // Разделение хостов: zapapp.uz — только лендинг, use.zapapp.uz — платформа.
  // Уводим жёстко (location.replace), чтобы адрес в строке был правильным.
  const mode = siteMode()
  if (mode === 'landing') {
    // канонический адрес лендинга — корень домена, без /landing в строке
    if (to.path === '/landing') return '/'
    if (to.meta.landing) return true
    location.replace(APP_ORIGIN + to.fullPath)
    return false
  }
  if (mode === 'app' && to.meta.landing) {
    location.replace(LANDING_ORIGIN + '/')
    return false
  }

  const user = useUserStore()
  await user.hydrateSession()

  if (to.meta.public) return true

  const stage = user.session.stage
  if (stage === 'authed') {
    if (to.meta.guest) return '/'
    return true
  }

  if (to.meta.guest) return true
  // гость на главной: на платформе — сразу в онбординг, иначе на лендинг
  if (to.path === '/') return mode === 'app' ? '/onboarding' : '/landing'
  // не авторизован — ведём на нужный шаг
  if (stage === 'onboarding') return '/onboarding'
  if (stage === 'phone') return '/auth/phone'
  return '/auth/code'
})

// На лендинг-хосте корень — это сам лендинг: подменяем маршрут '/' целиком,
// чтобы в адресной строке остался чистый zapapp.uz
if (siteMode() === 'landing') {
  // с именем: addRoute заменяет одноимённый маршрут, а не добавляет дубль
  router.addRoute({
    path: '/',
    name: 'root',
    component: () => import('@/pages/LandingPage.vue'),
    meta: { depth: 0, guest: true, landing: true },
  })
}

export default router
