<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'
import { avatarOf } from '@/lib/avatars'

const props = defineProps<{
  name: string
  color: string
  /** id контакта — если для него есть фото из дизайна, рендерим его */
  contactId?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  ring?: boolean
  class?: string
}>()

const photo = computed(() => (props.contactId ? avatarOf(props.contactId) : undefined))

const sizes = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-[13px]',
  md: 'h-11 w-11 text-[15px]',
  lg: 'h-14 w-14 text-[18px]',
  xl: 'h-20 w-20 text-[26px]',
}

const initial = computed(() => props.name.trim()[0]?.toUpperCase() ?? '?')
const isDark = computed(() => props.color === '#111110')
</script>

<template>
  <img
    v-if="photo"
    :src="photo"
    :alt="props.name"
    :class="cn('shrink-0 rounded-full object-cover', sizes[props.size ?? 'md'], props.ring && 'ring-2 ring-paper', props.class)"
  />
  <div
    v-else
    :class="
      cn(
        'flex shrink-0 items-center justify-center rounded-full font-sans font-extrabold',
        sizes[props.size ?? 'md'],
        props.ring && 'ring-2 ring-paper',
        props.class,
      )
    "
    :style="{ backgroundColor: color + (isDark ? '' : '26'), color: isDark ? '#DDFF33' : color }"
  >
    <span v-if="!isDark" class="opacity-90">{{ initial }}</span>
    <span v-else>{{ initial }}</span>
  </div>
</template>
