<script setup lang="ts">
// Переключатель языка для экранов, где ещё нет профиля: лендинг и онбординг.
// Один компонент на все места — различается триггером и способом раскрытия:
//
//   mode="sheet"    — нижний шит; так во всём приложении (и в мобильном тоже)
//   mode="dropdown" — выпадающий список; только на лендинге, там это шапка
//
// Выбор мгновенный: меняем локаль i18n, кладём в localStorage, шлём на аккаунт
// (если он уже есть) и перезагружаем страницу — экран приходит целиком на
// новом языке. До авторизации выбор доезжает до аккаунта позже: user-стор
// синхронизирует его сразу после входа.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_NAMES, LOCALES, applyLocale, type Locale } from '@/lib/i18n'
import { setLocale } from '@/api'
import { useUserStore } from '@/entities/stores/user'
import { tap } from '@/lib/haptics'
import { reducedMotion } from '@/lib/motion'
import BottomSheet from './BottomSheet.vue'
import FlagIcon from './FlagIcon.vue'
import LanguageOptions from './LanguageOptions.vue'

const props = withDefaults(
  defineProps<{
    /** landing — стеклянная таблетка в шапке; onboarding — под фон слайда */
    variant?: 'landing' | 'onboarding' | 'row'
    /** шит везде, кроме лендинга: на телефоне он удобнее выпадашки */
    mode?: 'sheet' | 'dropdown'
    /** тёмный слайд онбординга: белое стекло вместо чернильной таблетки */
    onDark?: boolean
    /** только для dropdown: каким краем прижат список */
    align?: 'left' | 'right'
  }>(),
  { variant: 'landing', mode: 'sheet', onDark: false, align: 'right' },
)

const emit = defineEmits<{ 'open-change': [boolean] }>()

const { locale, t } = useI18n()
const user = useUserStore()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const active = ref(0)

const current = computed(() => locale.value as Locale)
const shortLabel = computed(() => current.value.toUpperCase())

function toggle(e: Event) {
  // на онбординге тап по экрану листает историю — переключатель не должен листать
  e.stopPropagation()
  tap()
  open.value = !open.value
}

async function pick(next: Locale, e?: Event) {
  e?.stopPropagation()
  tap()
  open.value = false
  if (next === current.value) return

  // Затухание — оно же индикатор перезагрузки: страница гаснет и приходит
  // уже на новом языке, без промежуточного кадра со смесью надписей.
  if (!reducedMotion()) document.documentElement.classList.add('locale-swapping')
  applyLocale(next)
  // ошибка сети не откатывает выбор: он уже в localStorage
  if (user.session.stage === 'authed') await setLocale(next).catch(() => undefined)
  location.reload()
}

// ─── только dropdown: клавиатура и клик мимо ───────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
    root.value?.querySelector<HTMLElement>('button')?.focus()
    return
  }
  if (props.mode !== 'dropdown') return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    active.value = (active.value + step + LOCALES.length) % LOCALES.length
    listRef.value?.querySelectorAll<HTMLElement>('[role="option"]')[active.value]?.focus()
  }
}

function onDocPointer(e: PointerEvent) {
  if (!open.value) return
  if (root.value?.contains(e.target as Node)) return
  open.value = false
}

watch(open, (v) => {
  emit('open-change', v)
  if (v) {
    // Escape закрывает и шит, и выпадашку
    document.addEventListener('keydown', onKeydown, true)
    if (props.mode !== 'dropdown') return
    active.value = LOCALES.indexOf(current.value)
    void nextTick(() => listRef.value?.querySelector<HTMLElement>('[data-active="true"]')?.focus())
    document.addEventListener('pointerdown', onDocPointer, true)
  } else {
    document.removeEventListener('pointerdown', onDocPointer, true)
    document.removeEventListener('keydown', onKeydown, true)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKeydown, true)
})

const triggerClass = computed(() => {
  if (props.variant === 'onboarding')
    return props.onDark
      ? 'bg-white/[0.14] text-paper backdrop-blur-md ring-1 ring-white/25'
      : 'bg-ink text-paper'
  if (props.variant === 'row') return 'bg-sand text-ink'
  return 'lang-trigger--landing'
})
</script>

<template>
  <div ref="root" class="relative" @pointerdown.stop @pointerup.stop>
    <button
      type="button"
      class="press flex h-11 min-w-[68px] items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-extrabold transition-colors"
      :class="triggerClass"
      :aria-expanded="open"
      :aria-haspopup="props.mode === 'dropdown' ? 'listbox' : 'dialog'"
      :aria-label="LOCALE_NAMES[current]"
      @click="toggle"
    >
      <FlagIcon :locale="current" :size="19" />
      <span>{{ shortLabel }}</span>
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        aria-hidden="true"
        class="transition-transform duration-200 ease-zap"
        :class="open && 'rotate-180'"
      >
        <path d="M1 1.2 5 4.8 9 1.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- лендинг: выпадающий список прямо из шапки -->
    <Transition v-if="props.mode === 'dropdown'" name="lang-pop">
      <div
        v-if="open"
        ref="listRef"
        role="listbox"
        class="lang-menu absolute top-[calc(100%+8px)] z-50 w-[186px] overflow-hidden rounded-[18px] bg-paper p-1.5 text-ink"
        :class="props.align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'"
      >
        <LanguageOptions size="compact" :active-index="active" @pick="pick" @focus-index="active = $event" />
      </div>
    </Transition>

    <!-- приложение: нижний шит, как и остальные выборы в интерфейсе -->
    <BottomSheet v-else :open="open" @close="open = false">
      <div class="pb-2" role="listbox">
        <p class="mb-3 text-center text-[15px] font-extrabold">{{ t('profile.languageTitle') }}</p>
        <div class="flex flex-col gap-1">
          <LanguageOptions size="roomy" @pick="pick" />
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
/* Меню одинаково лежит и на кремовом, и на тёмном фоне: собственная
   подложка + мягкая тень, а не прозрачность родителя. */
.lang-menu {
  box-shadow:
    0 18px 40px -12px rgb(0 0 0 / 32%),
    0 2px 8px rgb(0 0 0 / 10%);
  border: 1px solid rgb(0 0 0 / 7%);
}

/* Тёмная шапка лендинга: стекло вместо кремовой таблетки.
   БЕЗ :global(.lp) — Vue схлопывал «:global(.lp) .lang-trigger--landing»
   в просто «.lp», и backdrop-filter уезжал на корень лендинга. Там он
   создавал containing block для position:fixed, из-за чего закреплённая
   GSAP-секция улетала за экран и на её месте была чёрная пустота.
   Класс и так вешается только при variant="landing", предок не нужен. */
.lang-trigger--landing {
  background: rgb(255 255 255 / 14%);
  color: #fff;
  border: 1px solid rgb(255 255 255 / 26%);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}
.lang-trigger--landing:hover {
  background: rgb(255 255 255 / 20%);
}

.lang-pop-enter-active,
.lang-pop-leave-active {
  transition:
    opacity 200ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.lang-pop-enter-from,
.lang-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .lang-pop-enter-active,
  .lang-pop-leave-active {
    transition: none;
  }
  .lang-pop-enter-from,
  .lang-pop-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
