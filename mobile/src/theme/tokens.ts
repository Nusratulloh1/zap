// Дизайн-токены — один в один с вебом (src/styles/main.css, переменные --c-*).
// Значения в hex: в RN нет CSS-переменных, поэтому темы переключаются
// подменой объекта в ThemeProvider.

export const palette = {
  light: {
    lime: '#DDFF33',
    limeSoft: '#EAFF7A',
    ink: '#111110', // основной текст
    cream: '#EFEDE6', // фон приложения
    paper: '#FFFFFF', // карточки
    sand: '#F5F3EE', // вложенные ряды
    sand2: '#F0EEE8', // бордеры карточек
    stone: '#E3E1D8',
    muted: '#8A887E',
    faint: '#B3B1A8',
    faint2: '#A3A199',
    deep: '#3E3C35',
    shell: '#F7F5F0',
    dune: '#F2F0EA', // фон главной
    dune2: '#F1EFE9',
    pebble: '#ECEAE2',
    pebble2: '#EFEDE7',
    hairline: '#E8E6DE',
    slate: '#5B594F',
    mist: '#C6C4BA',
    danger: '#C2453E',
    ember: '#B4451F',
    onLime: '#111110', // текст на лайме — чернила в ОБЕИХ темах
    overlay: 'rgba(17,17,16,0.40)',
    elevated: '#FFFFFF',
  },
  dark: {
    lime: '#DDFF33',
    limeSoft: '#EAFF7A',
    ink: '#F5F3EE', // тёплый крем-белый
    cream: '#0E0E0C',
    paper: '#1A1916',
    sand: '#22211D',
    sand2: '#2E2D2A',
    stone: '#35342F',
    muted: '#A3A199',
    faint: '#8A877F',
    faint2: '#A3A199',
    deep: '#D6D4CB',
    shell: '#22211D',
    dune: '#0E0E0C',
    dune2: '#22211D',
    pebble: '#2A2925',
    pebble2: '#22211D',
    hairline: '#2E2D2A',
    slate: '#B8B6AD',
    mist: '#75736B',
    danger: '#E0685C',
    ember: '#E58A5F',
    onLime: '#111110',
    overlay: 'rgba(0,0,0,0.6)',
    elevated: '#2A2925',
  },
} as const;

/** Ключи одинаковы у обеих тем, значения — обычные строки:
 *  без этого `as const` сужает типы до конкретных hex и тёмная тема
 *  перестаёт быть присваиваемой к светлой. */
export type Palette = { -readonly [K in keyof (typeof palette)['light']]: string };
export type ThemeName = keyof typeof palette;

/** Брендовые statement-экраны (лайм-фулблид, онбординг, пад суммы):
 *  выглядят одинаково в обеих темах — как .theme-fixed в вебе. */
export const fixedPalette: Palette = palette.light;

export const radius = {
  card: 28,
  inner: 18,
  chip: 999,
  tile: 14,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// PostScript-имена статических начертаний. Указываем семейство целиком, а не
// fontFamily + fontWeight: на Android второй способ не выбирает нужный файл.
export const font = {
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extrabold: 'Manrope-ExtraBold',
  mono: 'JetBrainsMono-Medium',
  monoBold: 'JetBrainsMono-Bold',
} as const;

/** Кривая ease-zap из веба: cubic-bezier(0.22, 1, 0.36, 1). */
export const EASE_ZAP = [0.22, 1, 0.36, 1] as const;

export const duration = {
  fast: 120,
  base: 200,
  slow: 280,
  page: 360,
} as const;
