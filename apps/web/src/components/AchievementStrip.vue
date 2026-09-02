<script setup lang="ts">
/*
  Ачивки лентой — как в приложении: медаль с лаймовым градиентом, чернильным
  кантом, бликом и звёздочкой; закрытые — пунктирная ячейка с замком. Открытые
  идут первыми, чтобы коллекция выглядела собранной.
*/
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** все ачивки в фиксированном порядке: [ключ, эмодзи] */
  all: readonly (readonly [string, string])[]
  /** ключи открытых */
  unlocked: readonly string[]
}>()

const { t } = useI18n()

const done = computed(() => props.all.filter(([k]) => props.unlocked.includes(k)).length)
const sorted = computed(() =>
  [...props.all].sort(
    (a, b) => Number(props.unlocked.includes(b[0])) - Number(props.unlocked.includes(a[0])),
  ),
)
</script>

<template>
  <div>
    <div class="mt-[22px] flex items-baseline justify-between">
      <p class="font-mono text-[10px] font-bold tracking-[0.16em] text-faint-2">{{ t('profile.achievements') }}</p>
      <p class="text-[12px] font-extrabold text-muted">
        {{ t('profile.achievementsOf', { done, total: props.all.length }) }}
      </p>
    </div>

    <div class="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div v-for="[key, glyph] in sorted" :key="key" class="w-[68px] shrink-0 text-center">
        <div class="relative mx-auto grid h-[58px] w-[58px] place-items-center">
          <template v-if="props.unlocked.includes(key)">
            <span
              class="absolute inset-0 rounded-full border-[2.5px] border-ink"
              style="background: radial-gradient(circle at 35% 28%, #F2FF8F 0%, #DDFF33 55%, #B9D92B 100%)"
            />
            <span class="absolute left-[18%] top-[14%] h-[15px] w-[15px] rounded-full bg-white/40" />
            <span class="relative text-[24px]">{{ glyph }}</span>
            <span class="absolute -bottom-px -right-px grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-lime">★</span>
          </template>
          <span
            v-else
            class="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-dashed border-sand-2 bg-sand text-[18px] opacity-45"
          >
            🔒
          </span>
        </div>
        <p
          class="mt-1.5 text-[10.5px] font-bold leading-[13px]"
          :class="props.unlocked.includes(key) ? '' : 'text-faint'"
        >
          {{ t(`titles.${key}`) }}
        </p>
      </div>
    </div>
  </div>
</template>
