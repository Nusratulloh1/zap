// Цвет фона экрана — кнопка «🎨» в шапке (макет: Screen 1b «Group — другой
// фон» на #8FD3FF).
//
// Палитра подобрана так, чтобы экран не разваливался: белые карточки, чернила
// и лайм читаются на каждом из этих фонов. Произвольный цвет не даём — на
// случайном фоне лаймовые кнопки исчезают.
import { useSyncExternalStore } from 'react';
import { storage } from '@/theme/ThemeProvider';

const KEY = 'zap:skin';

export const SKINS = [
  '#F1EFE9', // песочный — как в макете по умолчанию
  '#EAE8E1', // тёплый серый
  '#DAD8D1', // глина
  '#8FD3FF', // небо (Screen 1b)
  '#D9FF3A', // лайм
  '#FFD6A5', // персик
  '#E9D5FF', // лаванда
  '#121212', // чернила
] as const;

export type Skin = (typeof SKINS)[number];

const listeners = new Set<() => void>();

function read(): string | undefined {
  return storage.getString(KEY);
}

export function setSkin(color: string) {
  storage.set(KEY, color);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Выбранный фон или null — тогда экран берёт цвет темы. */
export function useSkin(): string | null {
  return useSyncExternalStore(subscribe, read, read) ?? null;
}

/** Тёмный ли фон — на нём текст и иконки становятся светлыми. */
export function isDarkSkin(color: string | null): boolean {
  if (!color) return false;
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // относительная яркость по формуле W3C — порог 0.5 достаточно для наших восьми
  return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255 < 0.5;
}
