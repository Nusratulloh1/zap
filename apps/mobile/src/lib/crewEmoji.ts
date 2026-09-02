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
const KEY_COLOR = (groupId: string) => `zap:crew-color:${groupId}`;

/** Палитра для компаний и заведений — насыщенные, но не спорящие с лаймом. */
export const CREW_COLORS = [
  '#FF7A45', '#FFB020', '#DDFF33', '#4ED17F',
  '#3EC5D9', '#5B8CFF', '#A46BFF', '#FF5C8A',
] as const;

/** Цвет по категории заведения — чтобы значок не был серым по умолчанию. */
const COLOR_BY_GLYPH: Record<string, string> = {
  '🍕': '#FF7A45', '🍔': '#FF9A3C', '🌯': '#F0A02A', '🍜': '#E8743B',
  '🍣': '#FF5C8A', '🥗': '#4ED17F', '☕': '#B07A4A', '🍰': '#FF8FB1',
  '🍩': '#E0709A', '🧋': '#C08A5E', '🍻': '#FFB020', '🍹': '#FF6F91',
  '🎬': '#A46BFF', '🎮': '#7C6BFF', '🎉': '#FF5C8A', '🏋️': '#4A9CE0',
  '⚽': '#4ED17F', '🎧': '#5B8CFF', '🚕': '#FFC13C', '✈️': '#3EC5D9',
  '🏔️': '#6FA8DC', '🛒': '#4ED17F', '🎁': '#FF7AA8', '⚡': '#DDFF33',
  '💊': '#4ED17F', '🧾': '#8A887E',
};

export function colorForGlyph(glyph: string): string {
  return COLOR_BY_GLYPH[glyph] ?? '#5B8CFF';
}

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

export function setCrewColor(groupId: string, color: string) {
  storage.set(KEY_COLOR(groupId), color);
  listeners.forEach((l) => l());
}

export function useCrewColor(db: Db | undefined, groupId: string): string {
  const stored = useSyncExternalStore(
    subscribe,
    () => storage.getString(KEY_COLOR(groupId)),
    () => storage.getString(KEY_COLOR(groupId)),
  );
  const glyph = useCrewEmoji(db, groupId);
  return stored ?? colorForGlyph(glyph);
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
