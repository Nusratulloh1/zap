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

/** Палитра тёмной темы — те же настроения, но фон остаётся тёмным. */
export const SKINS_DARK = [
  '#121212', // чернила
  '#1A1916', // графит
  '#22211D', // тёплый уголь
  '#0F1A22', // ночное небо
  '#1B2110', // тёмный лайм
  '#231A12', // жжёный персик
  '#1C1526', // тёмная лаванда
  '#0F1A16', // хвоя
] as const;

export const SKINS = SKINS_LIGHT;

export type Skin = (typeof SKINS_LIGHT)[number];

const listeners = new Set<() => void>();

function read(theme: ThemeName): string | undefined {
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
