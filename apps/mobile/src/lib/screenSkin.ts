// Цвет фона экрана — кнопка «🎨» в шапке (макет: Screen 1b «Group — другой
// фон» на #8FD3FF).
//
// Палитра подобрана так, чтобы экран не разваливался: белые карточки, чернила
// и лайм читаются на каждом из этих фонов. Произвольный цвет не даём — на
// случайном фоне лаймовые кнопки исчезают.
import { useSyncExternalStore } from 'react';
import { storage, useTheme } from '@/theme/ThemeProvider';
import type { ThemeName } from '@/theme/tokens';

/*
  Фон хранится ОТДЕЛЬНО для светлой и тёмной темы. Общий ключ означал, что
  выбранный на свету лайм оставался фоном и в тёмной теме: текст и карточки к
  тому моменту уже светлые — экран разваливался.
*/
const KEY = (theme: ThemeName) => `zap:skin:${theme}`;

/** Палитра светлой темы. */
export const SKINS_LIGHT = [
  '#F1EFE9', // песочный — как в макете по умолчанию
  '#EAE8E1', // тёплый серый
  '#DAD8D1', // глина
  '#8FD3FF', // небо (Screen 1b)
  '#D9FF3A', // лайм
  '#FFD6A5', // персик
  '#E9D5FF', // лаванда
  '#121212', // чернила
] as const;

/*
  Палитра тёмной темы. Первый набор был из восьми почти чёрных плашек — в
  шите они выглядели одинаковыми квадратами, и выбирать было не из чего.
  Здесь оттенок различим, но фон остаётся тёмным: белый текст и лайм на нём
  читаются.
*/
export const SKINS_DARK = [
  '#121212', // чернила
  '#1C1B18', // графит
  '#152238', // ночное небо
  '#122A1E', // хвоя
  '#2A2410', // тёмный лайм
  '#2A1520', // вино
  '#1E1430', // тёмная лаванда
  '#0E2A2C', // морская глубина
] as const;

export const SKINS = SKINS_LIGHT;

export type Skin = (typeof SKINS_LIGHT)[number];

const listeners = new Set<() => void>();

/*
  До разделения по темам фон лежал под общим ключом. Переносим его в светлую
  тему один раз: иначе у тех, кто уже выбрал себе цвет, экраны молча
  вернулись бы к стандартному.
*/
const LEGACY_KEY = 'zap:skin';

function migrateLegacy(): void {
  const old = storage.getString(LEGACY_KEY);
  if (!old) return;
  if (!storage.getString(KEY('light'))) storage.set(KEY('light'), old);
  storage.delete(LEGACY_KEY);
}

function read(theme: ThemeName): string | undefined {
  migrateLegacy();
  return storage.getString(KEY(theme));
}

export function setSkin(color: string, theme: ThemeName) {
  storage.set(KEY(theme), color);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Выбранный фон текущей темы или null — тогда экран берёт цвет темы. */
export function useSkin(): string | null {
  const { name } = useTheme();
  return useSyncExternalStore(subscribe, () => read(name), () => read(name)) ?? null;
}

/** Палитра для текущей темы. */
export function skinsFor(theme: ThemeName): readonly string[] {
  return theme === 'dark' ? SKINS_DARK : SKINS_LIGHT;
}

/** Тёмный ли фон — на нём текст и иконки становятся светлыми. */
export function isDarkSkin(color: string | null): boolean {
  if (!color) return false;
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // относительная яркость по формуле W3C — порог 0.5 достаточно для наших восьми
  return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255 < 0.5;
}
