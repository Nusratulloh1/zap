<script setup lang="ts">
// Лёгкое CSS-конфетти (<40 узлов) + галочка с прорисовкой штриха
const COLORS = ['#DDFF33', '#111110', '#B98CE0', '#5EC8E5', '#F2B84C']

const pieces = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  dx: (Math.random() - 0.5) * 160,
  rot: 180 + Math.random() * 540,
  dur: 1300 + Math.random() * 900,
  delay: Math.random() * 250,
  size: 5 + Math.random() * 6,
  color: COLORS[i % COLORS.length]!,
  round: Math.random() > 0.5,
}))
</script>

<template>
  <div class="pointer-events-none relative">
    <div class="pointer-events-none absolute inset-x-0 -top-4 mx-auto h-0 w-full">
      <span
        v-for="p in pieces"
        :key="p.id"
        class="confetti-piece absolute block"
        :style="{
          left: p.left + '%',
          width: p.size + 'px',
          height: p.size * (p.round ? 1 : 1.8) + 'px',
          backgroundColor: p.color,
          borderRadius: p.round ? '50%' : '2px',
          '--dx': p.dx + 'px',
          '--rot': p.rot + 'deg',
          '--dur': p.dur + 'ms',
          '--delay': p.delay + 'ms',
        }"
      />
    </div>

    <div class="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-lime shadow-lg shadow-lime/40">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#111110" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path class="check-draw" d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </div>
  </div>
</template>
