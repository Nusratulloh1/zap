import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // все цвета — через CSS-переменные тем (см. main.css :root / [data-theme='dark'])
        lime: 'rgb(var(--c-lime) / <alpha-value>)',
        'lime-soft': 'rgb(var(--c-lime-soft) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        cream: 'rgb(var(--c-cream) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        sand: 'rgb(var(--c-sand) / <alpha-value>)',
        'sand-2': 'rgb(var(--c-sand-2) / <alpha-value>)',
        stone: 'rgb(var(--c-stone) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        'faint-2': 'rgb(var(--c-faint-2) / <alpha-value>)',
        deep: 'rgb(var(--c-deep) / <alpha-value>)',
        shell: 'rgb(var(--c-shell) / <alpha-value>)',
        dune: 'rgb(var(--c-dune) / <alpha-value>)',
        'dune-2': 'rgb(var(--c-dune-2) / <alpha-value>)',
        pebble: 'rgb(var(--c-pebble) / <alpha-value>)',
        'pebble-2': 'rgb(var(--c-pebble-2) / <alpha-value>)',
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',
        slate: 'rgb(var(--c-slate) / <alpha-value>)',
        mist: 'rgb(var(--c-mist) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        ember: 'rgb(var(--c-ember) / <alpha-value>)',
        'on-lime': 'rgb(var(--c-on-lime) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '28px',
        inner: '18px',
      },
      maxWidth: {
        app: '430px',
      },
      transitionTimingFunction: {
        zap: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'soft-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'soft-pulse': 'soft-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
