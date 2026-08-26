<script setup lang="ts">
// Дизайн 4b/5i: плавающий стеклянный пилл с тремя иконками —
// главная / хаб-кэшбэк / история; активная — в лаймовом круге.
import { useRoute, useRouter } from 'vue-router'
import { tap } from '@/lib/haptics'
import { gsap, reducedMotion } from '@/lib/motion'

const route = useRoute()
const router = useRouter()

const tabs = [
  { path: '/', icon: 'home' },
  { path: '/cashback', icon: 'grid' },
  { path: '/history', icon: 'clock' },
] as const

function go(path: string, e?: Event) {
  tap()
  if (e && !reducedMotion()) {
    const icon = (e.currentTarget as HTMLElement).firstElementChild
    if (icon) gsap.fromTo(icon, { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' })
  }
  router.push(path)
}
</script>

<template>
  <nav class="pointer-events-none fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-30 mx-auto flex w-full max-w-app justify-center">
    <div
      class="zap-tabbar pointer-events-auto flex items-center gap-[26px] rounded-full border border-white/70 bg-white/55 px-3.5 py-2 shadow-[0_12px_30px_rgba(30,28,16,0.14),0_2px_8px_rgba(30,28,16,0.08),inset_1.5px_1.5px_1px_rgba(255,255,255,0.7)] backdrop-blur-[18px] backdrop-saturate-[1.7]"
    >
      <button
        v-for="t in tabs"
        :key="t.path"
        type="button"
        class="press flex h-[46px] w-[46px] items-center justify-center rounded-full"
        :class="route.path === t.path && 'bg-lime'"
        :aria-label="t.path"
        @click="go(t.path, $event)"
      >
        <svg v-if="t.icon === 'home'" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 11.5L12 4.5L20 11.5V19.5H14.5V14.5H9.5V19.5H4V11.5Z" :stroke="route.path === t.path ? '#111110' : '#8A887E'" stroke-width="2.2" stroke-linejoin="round" />
        </svg>
        <div v-else-if="t.icon === 'grid'" class="grid grid-cols-[5px_5px_5px] gap-[5px]">
          <div v-for="i in 6" :key="i" class="h-[5px] w-[5px] rounded-full" :style="{ background: route.path === t.path ? '#111110' : '#8A887E' }" />
        </div>
        <svg v-else width="23" height="23" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" :stroke="route.path === t.path ? '#111110' : '#8A887E'" stroke-width="2.2" />
          <path d="M12 7.5V12L15 14" :stroke="route.path === t.path ? '#111110' : '#8A887E'" stroke-width="2.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </nav>
</template>
