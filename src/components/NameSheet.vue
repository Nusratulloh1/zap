<script setup lang="ts">
// Незакрываемый шит после первого входа: юзернейм (@handle, ОСНОВНОЙ, обязателен —
// по нему ищут пользователя везде) + полное имя. Пока не заполнено — не пускаем.
import { computed, ref, watch } from 'vue'
import { updateProfile, checkHandle } from '@/api'
import { toast } from '@/lib/toast'
import { useUserStore } from '@/entities/stores/user'
import BottomSheet from '@/components/BottomSheet.vue'

const user = useUserStore()
const name = ref('')
const handle = ref('')
const saving = ref(false)

// открыт, пока нет имени ИЛИ юзернейма
const open = computed(
  () => user.isAuthed && Boolean(user.user) && (!user.user!.name.trim() || !user.user!.handle),
)

// нормализация ввода юзернейма на лету
watch(handle, (v) => {
  const cleaned = v.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
  if (cleaned !== v) handle.value = cleaned
})

type HandleState = 'empty' | 'short' | 'checking' | 'free' | 'taken'
const handleState = ref<HandleState>('empty')
let checkTimer = 0
let checkSeq = 0

watch(handle, (v) => {
  window.clearTimeout(checkTimer)
  if (!v) return (handleState.value = 'empty')
  if (v.length < 3) return (handleState.value = 'short')
  handleState.value = 'checking'
  const seq = ++checkSeq
  checkTimer = window.setTimeout(async () => {
    try {
      const res = await checkHandle(v)
      if (seq !== checkSeq) return // устарел
      handleState.value = res.valid && res.available ? 'free' : 'taken'
    } catch {
      if (seq === checkSeq) handleState.value = 'taken'
    }
  }, 400)
})

const handleHint = computed(() => {
  switch (handleState.value) {
    case 'short': return { text: 'минимум 3 символа', cls: 'text-muted' }
    case 'checking': return { text: 'проверяем…', cls: 'text-muted' }
    case 'free': return { text: '✓ свободен', cls: 'text-on-lime' }
    case 'taken': return { text: 'занят или недопустим', cls: 'text-danger' }
    default: return { text: 'по нему вас найдут друзья', cls: 'text-muted' }
  }
})

const valid = computed(() => name.value.trim().length >= 2 && handleState.value === 'free')

async function save() {
  if (!valid.value || saving.value) return
  saving.value = true
  try {
    await updateProfile(name.value, handle.value)
    await user.hydrate()
    toast.success(`Рады знакомству, ${name.value.trim().split(' ')[0]}!`)
  } catch (e) {
    toast(e instanceof Error && e.message ? e.message : 'Не удалось сохранить — попробуйте ещё раз')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BottomSheet :open="open" locked>
    <div class="pb-4">
      <p class="text-center text-[17px] font-extrabold">Создайте профиль</p>
      <p class="mt-1 text-center text-[13px] font-semibold text-muted">
        Юзернейм — чтобы друзья находили вас в ZAP!
      </p>

      <!-- юзернейм (основное поле) -->
      <label class="mt-5 flex items-center gap-1 border-b-2 pb-2.5" :class="handleState === 'taken' ? 'border-danger' : 'border-lime'">
        <span class="text-[20px] font-extrabold text-faint-2">@</span>
        <input
          v-model="handle"
          type="text"
          autocapitalize="none"
          autocomplete="off"
          spellcheck="false"
          placeholder="username"
          class="w-full bg-transparent text-[20px] font-extrabold text-ink outline-none [caret-color:#DDFF33] placeholder:text-faint"
        />
        <span v-if="handleState === 'free'" class="text-[16px] text-on-lime">✓</span>
      </label>
      <p class="mt-1.5 text-[12px] font-semibold" :class="handleHint.cls">{{ handleHint.text }}</p>

      <!-- полное имя -->
      <label class="mt-4 flex items-center border-b-2 border-sand-2 pb-2.5">
        <input
          v-model="name"
          type="text"
          autocomplete="name"
          placeholder="Имя и фамилия"
          class="w-full bg-transparent text-[18px] font-bold text-ink outline-none [caret-color:#DDFF33] placeholder:text-faint"
          @keydown.enter="save"
        />
      </label>

      <button
        type="button"
        class="press mt-6 h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="!valid || saving"
        @click="save"
      >
        Продолжить
      </button>
    </div>
  </BottomSheet>
</template>
