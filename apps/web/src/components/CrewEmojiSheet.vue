<script setup lang="ts">
/*
  Знак компании: цвет и эмодзи. Голый смайлик на сером выглядел дёшево, поэтому
  выбор идёт вместе с цветом плитки и сразу показывает результат.
*/
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/BottomSheet.vue'
import VenueIcon from '@/components/VenueIcon.vue'
import { CREW_COLORS, CREW_EMOJI, colorForGlyph, setCrewColor, setCrewEmoji } from '@/lib/crewStyle'

const props = defineProps<{ open: boolean; groupId: string; glyph: string; color: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useI18n()
const glyph = ref(props.glyph)
const color = ref(props.color)

watch(
  () => [props.glyph, props.color],
  () => {
    glyph.value = props.glyph
    color.value = props.color
  },
)

function pickGlyph(e: string) {
  glyph.value = e
  color.value = colorForGlyph(e)
  setCrewEmoji(props.groupId, e)
  setCrewColor(props.groupId, color.value)
  emit('changed')
}

function pickColor(c: string) {
  color.value = c
  setCrewColor(props.groupId, c)
  emit('changed')
}
</script>

<template>
  <BottomSheet :open="props.open" @close="emit('close')">
    <h2 class="text-[19px] font-extrabold tracking-[-0.01em]">{{ t('group.pickEmoji') }}</h2>

    <div class="mt-4 flex justify-center">
      <VenueIcon name="" :glyph="glyph" :color="color" size="lg" class="h-16 w-16 text-[30px]" />
    </div>

    <div class="mt-4 flex justify-center gap-2.5">
      <button
        v-for="c in CREW_COLORS"
        :key="c"
        type="button"
        class="press h-[34px] w-[34px] rounded-full"
        :style="{ background: c }"
        :class="c === color ? 'ring-[3px] ring-ink' : ''"
        @click="pickColor(c)"
      />
    </div>

    <div class="mt-4 flex flex-wrap justify-center gap-2.5 pb-2">
      <button
        v-for="e in CREW_EMOJI"
        :key="e"
        type="button"
        class="press grid h-14 w-14 place-items-center rounded-[18px] text-[26px]"
        :class="e === glyph ? 'bg-lime' : 'bg-sand'"
        @click="pickGlyph(e)"
      >
        {{ e }}
      </button>
    </div>

    <button type="button" class="press mt-2 h-13 w-full rounded-full bg-ink py-3.5 text-[15px] font-extrabold text-lime" @click="emit('close')">
      {{ t('common.done') }}
    </button>
  </BottomSheet>
</template>
