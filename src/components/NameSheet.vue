<script setup lang="ts">
// Незакрываемый шит после первого входа: спрашиваем полное имя,
// пока оно не сохранено — приложение дальше не пускает.
import { computed, ref } from 'vue'
import { updateProfile } from '@/api'
import { toast } from '@/lib/toast'
import { useUserStore } from '@/entities/stores/user'
import BottomSheet from '@/components/BottomSheet.vue'

const user = useUserStore()
const name = ref('')
const saving = ref(false)

const open = computed(() => user.isAuthed && Boolean(user.user) && !user.user!.name.trim())
const valid = computed(() => name.value.trim().length >= 2)

async function save() {
  if (!valid.value || saving.value) return
  saving.value = true
  try {
    await updateProfile(name.value)
    await user.hydrate()
    toast.success(`Рады знакомству, ${name.value.trim().split(' ')[0]}!`)
  } catch {
    toast('Не удалось сохранить имя — попробуйте ещё раз')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BottomSheet :open="open" locked>
    <div class="pb-4">
      <p class="text-center text-[17px] font-extrabold">Как вас зовут?</p>
      <p class="mt-1 text-center text-[13px] font-semibold text-muted">
        Имя увидят друзья в сплитах и напоминаниях
      </p>
      <label class="mt-5 flex items-center border-b-2 border-lime pb-3">
        <input
          v-model="name"
          type="text"
          autocomplete="name"
          placeholder="Имя и фамилия"
          class="w-full bg-transparent text-center text-[20px] font-extrabold text-ink outline-none [caret-color:#DDFF33] placeholder:text-faint"
          @keydown.enter="save"
        />
      </label>
      <button
        type="button"
        class="press mt-5 h-13 h-14 w-full rounded-full bg-lime text-[16px] font-extrabold text-on-lime disabled:opacity-40"
        :disabled="!valid || saving"
        @click="save"
      >
        Продолжить
      </button>
    </div>
  </BottomSheet>
</template>
