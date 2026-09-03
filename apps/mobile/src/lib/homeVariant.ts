// Какая главная показывается — A/B между «классикой» и новым прототипом.
//
// Обе главные живут в коде одновременно: выбор хранится локально (MMKV) и
// переключается в профиле. Ни один экран, кроме самой главной, от этого не
// меняется — навигация, вкладки и все переходы общие.
import { useSyncExternalStore } from 'react';
import { storage } from '@/theme/ThemeProvider';

export type HomeVariant = 'classic' | 'pulse';
/** Холст новой главной: тёмный как в прототипе или светлый песочный. */
export type HomeSkin = 'dark' | 'light';

const KEY = 'zap:home-variant';
const KEY_SKIN = 'zap:home-skin';

const subs = new Set<() => void>();

function emit() {
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

export function getHomeVariant(): HomeVariant {
  return storage.getString(KEY) === 'pulse' ? 'pulse' : 'classic';
}

export function setHomeVariant(v: HomeVariant) {
  storage.set(KEY, v);
  emit();
}

export function useHomeVariant(): HomeVariant {
  return useSyncExternalStore(subscribe, getHomeVariant, getHomeVariant);
}

export function getHomeSkin(): HomeSkin {
  return storage.getString(KEY_SKIN) === 'light' ? 'light' : 'dark';
}

export function setHomeSkin(v: HomeSkin) {
  storage.set(KEY_SKIN, v);
  emit();
}

export function useHomeSkin(): HomeSkin {
  return useSyncExternalStore(subscribe, getHomeSkin, getHomeSkin);
}
