<script setup lang="ts">
// Аватар пользователя: инициал на чернильном круге с лаймовой обводкой.
// Показывает первую букву реального имени (после онбординг-шита «Как вас зовут?»).
import { computed } from 'vue'
import { useUserStore } from '@/entities/stores/user'

const props = withDefaults(defineProps<{ size?: number; border?: number }>(), { size: 44, border: 2 })
const user = useUserStore()
const letter = computed(() => (user.user?.name?.trim()[0] ?? 'В').toUpperCase())
</script>

<template>
  <span
    class="flex shrink-0 select-none items-center justify-center rounded-full bg-[#111110] font-extrabold text-lime"
    :style="{
      width: props.size + 'px',
      height: props.size + 'px',
      borderWidth: props.border + 'px',
      borderColor: '#DDFF33',
      fontSize: Math.round(props.size * 0.38) + 'px',
    }"
  >
    {{ letter }}
  </span>
</template>
