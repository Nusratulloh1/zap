// Знак и цвет компании — как в приложении (lib/crewEmoji.ts).
//
// Пользователь выбирает эмодзи и цвет при создании компании; пока не выбрал —
// берём категорию заведения, где компания чаще всего сидит. Хранится локально:
// это украшение, ради него не нужен ни бэкенд, ни миграция.
import { themeForMerchant } from '@/lib/merchantTheme'
import type { Merchant, Split } from '@zap/shared/types'

/** Минимум, нужный для знака по умолчанию: сплиты компании и справочник мест. */
export interface CrewSource {
  splits: Split[]
  merchants: Merchant[]
}

const KEY = (groupId: string) => `zap:crew-emoji:${groupId}`
const KEY_COLOR = (groupId: string) => `zap:crew-color:${groupId}`

export const CREW_COLORS = [
  '#FF7A45', '#FFB020', '#DDFF33', '#4ED17F',
  '#3EC5D9', '#5B8CFF', '#A46BFF', '#FF5C8A',
] as const

export const CREW_EMOJI = [
  '🍕', '🍔', '🌯', '🍜', '🍣', '🥗',
  '☕', '🍰', '🍩', '🧋', '🍻', '🍹',
  '🎬', '🎮', '🎉', '🏋️', '⚽', '🎧',
  '🚕', '✈️', '🏔️', '🛒', '🎁', '⚡',
] as const

const COLOR_BY_GLYPH: Record<string, string> = {
  '🍕': '#FF7A45', '🍔': '#FF9A3C', '🌯': '#F0A02A', '🍜': '#E8743B',
  '🍣': '#FF5C8A', '🥗': '#4ED17F', '☕': '#B07A4A', '🍰': '#FF8FB1',
  '🍩': '#E0709A', '🧋': '#C08A5E', '🍻': '#FFB020', '🍹': '#FF6F91',
  '🎬': '#A46BFF', '🎮': '#7C6BFF', '🎉': '#FF5C8A', '🏋️': '#4A9CE0',
  '⚽': '#4ED17F', '🎧': '#5B8CFF', '🚕': '#FFC13C', '✈️': '#3EC5D9',
  '🏔️': '#6FA8DC', '🛒': '#4ED17F', '🎁': '#FF7AA8', '⚡': '#DDFF33',
  '💊': '#4ED17F', '🍽️': '#E8743B', '🍗': '#E0913A', '🍟': '#FFB020',
  '🍲': '#D2894B', '🥟': '#C9A227', '🍦': '#8FD3F4',
}

export function colorForGlyph(glyph: string): string {
  return COLOR_BY_GLYPH[glyph] ?? '#5B8CFF'
}

export function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const m = (v: number) => Math.round(v + (255 - v) * k)
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`
}

export function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const m = (v: number) => Math.round(v * (1 - k))
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`
}

/** Знак по умолчанию: категория заведения, где компания была чаще всего. */
export function defaultCrewEmoji(src: CrewSource, groupId: string): string {
  const counts = new Map<string, number>()
  for (const s of src.splits) {
    if (s.groupId !== groupId) continue
    const name = src.merchants.find((m) => m.id === s.merchantId)?.name ?? s.title
    const glyph = themeForMerchant(name)?.glyph
    if (glyph) counts.set(glyph, (counts.get(glyph) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '⚡'
}

export function crewEmoji(src: CrewSource, groupId: string): string {
  return localStorage.getItem(KEY(groupId)) ?? defaultCrewEmoji(src, groupId)
}

export function crewColor(src: CrewSource, groupId: string): string {
  return localStorage.getItem(KEY_COLOR(groupId)) ?? colorForGlyph(crewEmoji(src, groupId))
}

export function setCrewEmoji(groupId: string, emoji: string) {
  localStorage.setItem(KEY(groupId), emoji)
}

export function setCrewColor(groupId: string, color: string) {
  localStorage.setItem(KEY_COLOR(groupId), color)
}
