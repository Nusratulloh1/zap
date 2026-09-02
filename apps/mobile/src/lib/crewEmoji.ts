// Эмодзи компании — «Select emoji for Crew».
//
// Знак выбирает пользователь; пока не выбрал — берём категорию заведения, где
// компания чаще всего сидит (Bellissimo → 🍕, Safia → ☕). Хранится локально в
// MMKV: это украшение, ради него не нужен ни бэкенд, ни миграция.
import { useSyncExternalStore } from 'react';
import { storage } from '@/theme/ThemeProvider';
import { themeForMerchant } from '@/lib/merchantTheme';
import type { Db } from '@zap/shared/types';

const KEY = (groupId: string) => `zap:crew-emoji:${groupId}`;

/** Набор для выбора — заведения и поводы, а не «смайлики вообще». */
export const CREW_EMOJI = [
  '🍕', '🍔', '🌯', '🍜', '🍣', '🥗',
  '☕', '🍰', '🍩', '🧋', '🍻', '🍹',
  '🎬', '🎮', '🎉', '🏋️', '⚽', '🎧',
  '🚕', '✈️', '🏔️', '🛒', '🎁', '⚡',
] as const;

const listeners = new Set<() => void>();

export function setCrewEmoji(groupId: string, emoji: string) {
  storage.set(KEY(groupId), emoji);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Знак по умолчанию: категория заведения, где компания была чаще всего. */
export function defaultCrewEmoji(db: Db | undefined, groupId: string): string {
  const counts = new Map<string, number>();
  for (const s of db?.splits ?? []) {
    if (s.groupId !== groupId) continue;
    const name = db?.merchants.find((m) => m.id === s.merchantId)?.name ?? s.title;
    const glyph = themeForMerchant(name)?.glyph;
    if (glyph) counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? '⚡';
}

export function useCrewEmoji(db: Db | undefined, groupId: string): string {
  const stored = useSyncExternalStore(
    subscribe,
    () => storage.getString(KEY(groupId)),
    () => storage.getString(KEY(groupId)),
  );
  return stored ?? defaultCrewEmoji(db, groupId);
}
