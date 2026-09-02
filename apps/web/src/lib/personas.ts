// Аватары-персоны — те же 24 файла, что в приложении.
//
// Персона закрепляется за человеком по id: хеш → индекс. Так один и тот же
// человек выглядит одинаково в вебе и в мобильном, и «безликих букв» больше
// нигде нет.
const modules = import.meta.glob('@/assets/brand/personas/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

/** p01…p24 по порядку имён файлов. */
export const PERSONAS: string[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k]!)

/** Женские персоны — как в мобильном (см. myAvatar.ts). */
const FEMALE = new Set([1, 4, 6, 13, 15, 16, 21, 23]) // индексы p02, p05, p07…

export function personaByIndex(i: number): string {
  return PERSONAS[i % PERSONAS.length]!
}

/** Стабильная персона по id контакта. */
export function personaFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return personaByIndex(h % PERSONAS.length)
}

/** Аватар пользователя: выбранный вручную или по полу, иначе первый. */
const KEY = 'zap:my-avatar'
const KEY_GENDER = 'zap:gender'

export function myPersona(): string {
  const idx = Number(localStorage.getItem(KEY) ?? NaN)
  if (Number.isInteger(idx) && idx >= 0 && idx < PERSONAS.length) return PERSONAS[idx]!
  return localStorage.getItem(KEY_GENDER) === 'female' ? PERSONAS[1]! : PERSONAS[0]!
}

export function setMyPersona(index: number) {
  localStorage.setItem(KEY, String(index))
}

export function isFemale(index: number): boolean {
  return FEMALE.has(index)
}
