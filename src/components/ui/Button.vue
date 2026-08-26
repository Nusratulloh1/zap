<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-sans font-bold transition-all duration-150 ease-zap active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary: 'bg-lime text-on-lime',
        dark: 'bg-ink text-paper',
        secondary: 'bg-paper text-ink',
        sand: 'bg-sand-2 text-ink',
        outline: 'bg-transparent text-ink border border-stone',
        ghost: 'bg-transparent text-ink',
        'ghost-light': 'bg-transparent text-paper',
      },
      size: {
        lg: 'h-14 px-7 text-[16px]',
        md: 'h-12 px-6 text-[15px]',
        // визуально мелкие кнопки получают невидимую зону нажатия ~44px
        sm: 'h-9 px-4 text-[13px] relative hit-area',
        xs: 'h-8 px-3.5 text-[12px] relative hit-area',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type Props = {
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}

const props = withDefaults(defineProps<Props>(), { type: 'button' })
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size, block: props.block }))"
  >
    <slot />
  </button>
</template>
