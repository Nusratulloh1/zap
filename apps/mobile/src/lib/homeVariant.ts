// Какая главная показывается — A/B между «классикой» и новым прототипом.
//
// Обе главные живут в коде одновременно: выбор хранится локально (MMKV) и
// переключается в профиле. Ни один экран, кроме самой главной, от этого не
// меняется — навигация, вкладки и все переходы общие.
import { useSyncExternalStore } from 'react';
import { storage } from '@/theme/ThemeProvider';

export type HomeVariant = 'classic' | 'pulse';

const KEY = 'zap:home-variant';
const KEY_LOGO = 'zap:home-logo';

const subs = new Set<() => void>();

function emit() {
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

/*
  По умолчанию — «Pulse»: новая главная показывается всем, кто ещё не делал
  выбор. Классика остаётся на месте и включается в профиле, поэтому откат для
  человека — один тап, а не обновление приложения.
*/
export function getHomeVariant(): HomeVariant {
  return storage.getString(KEY) === 'classic' ? 'classic' : 'pulse';
}

export function setHomeVariant(v: HomeVariant) {
  storage.set(KEY, v);
  emit();
}

export function useHomeVariant(): HomeVariant {
  return useSyncExternalStore(subscribe, getHomeVariant, getHomeVariant);
}

/** Стиль логотипа в шапке новой главной — индекс в наборе прототипа. */
export function getHomeLogo(): number {
  return Number(storage.getString(KEY_LOGO) ?? 0) || 0;
}

export function setHomeLogo(i: number) {
  storage.set(KEY_LOGO, String(i));
  emit();
}

export function useHomeLogo(): number {
  return useSyncExternalStore(subscribe, getHomeLogo, getHomeLogo);
}

