// Дизайн-токены.
//
// ВАЖНО: значения светлой темы взяты из вёрстки редизайна
// (docs/product/redesign/ZAP Screens.dc.html), а не из старого веба. Там своя
// палитра: лайм #D9FF3A, чернила #121212, серый текст #8E8C86, фон #F1EFE9,
// пунктиры и бордеры #DAD8D1. Раньше мы рисовали похожие, но другие цвета —
// поэтому экраны «почти как в макете» вместо «как в макете».
//
// Значения в hex: в RN нет CSS-переменных, темы переключаются подменой объекта.

export const palette = {
  light: {
    lime: '#D9FF3A', // из макета
    limeSoft: '#EAFF7A',
    ink: '#121212', // основной текст (макет)
    cream: '#EAE8E1',
    paper: '#FFFFFF', // карточки
    sand: '#EAE8E1', // вложенные ряды
    sand2: '#DAD8D1', // бордеры и пунктиры карточек
    stone: '#CFCDC6',
    muted: '#8E8C86', // серый текст макета
    faint: '#8E8C86',
    faint2: '#8E8C86',
    deep: '#5A6A16', // тёмно-оливковый акцент на лайме
    shell: '#F1EFE9',
    dune: '#F1EFE9', // фон экранов
    dune2: '#F1EFE9',
    pebble: '#EAE8E1',
    pebble2: '#EAE8E1',
    hairline: '#DAD8D1',
    slate: '#5B594F',
    mist: '#BDBBB5',
    danger: '#C0553A',
    ember: '#C0553A',
    onLime: '#121212', // текст на лайме — чернила в ОБЕИХ темах
    overlay: 'rgba(18,18,18,0.40)',
    elevated: '#FFFFFF',
  },
  dark: {
    lime: '#D9FF3A',
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
    onLime: '#121212',
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

/**
 * Боковой отступ экрана — ОДНО значение на всё приложение.
 *
 * Веб держит внутренние страницы на px-6 (24), а главную на px-4 (16). На
 * десктопной ширине разница незаметна, но на телефоне 24+24 съедают 13%
 * ширины: карточки повисают в середине, а имена («ООО ALIMBAYEV TRAD…»,
 * «AMAL BAS…») обрезаются на ровном месте. Выровнено по главной.
 *
 * Это ВНЕШНИЙ отступ до края экрана. Внутренние поля карточек живут своей
 * жизнью (radius.card + свой padding) и с ним не складываются.
 */
// в макете поля экрана 15 pt (padding:… 15px во всех экранах)
export const SCREEN_PAD_X = 15;

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
