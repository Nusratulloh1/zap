<script setup lang="ts">
/*
  Значок заведения — тот же, что в приложении: логотип партнёра на песочной
  плитке, а для всех прочих мест — эмодзи категории на цветной плитке с
  градиентом. Голый эмодзи на сером квадрате выглядел дёшево.
*/
import { computed } from 'vue'
import { cn } from '@/lib/cn'
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo'
import { colorForGlyph, lighten, darken } from '@/lib/crewStyle'

const props = defineProps<{
  /** название заведения или сплита */
  name: string
  /** свой знак (у компании — выбранный пользователем) */
  glyph?: string
  /** свой цвет плитки */
  color?: string
  size?: 'sm' | 'md' | 'lg'
  class?: string
}>()

const sizes = { sm: 'h-9 w-9 text-[17px]', md: 'h-11 w-11 text-[21px]', lg: 'h-14 w-14 text-[26px]' }

const logo = computed(() => (props.glyph ? null : merchantLogo(props.name)))
const glyph = computed(() => props.glyph ?? merchantGlyph(props.name))
const base = computed(() => props.color ?? colorForGlyph(glyph.value))
const gradient = computed(
  () => `linear-gradient(160deg, ${lighten(base.value, 0.3)}, ${darken(base.value, 0.12)})`,
)
</script>

<template>
  <div
    v-if="logo"
    :class="cn('shrink-0 grid place-items-center rounded-[30%] bg-sand ring-1 ring-sand2', sizes[props.size ?? 'md'], props.class)"
  >
    <img :src="logo" :alt="props.name" class="h-[78%] w-[78%] object-contain" />
  </div>
  <div
    v-else
    :style="{ backgroundImage: gradient }"
    :class="cn('shrink-0 grid place-items-center rounded-[30%] shadow-sm', sizes[props.size ?? 'md'], props.class)"
  >
    <span>{{ glyph }}</span>
  </div>
</template>
