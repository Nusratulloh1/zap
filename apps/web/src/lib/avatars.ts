// Фото-аватары из дизайна, по id контакта.
import a11 from '@/assets/brand/avatars/a11.png'
import a12 from '@/assets/brand/avatars/a12.png'
import a15 from '@/assets/brand/avatars/a15.png'
import a33 from '@/assets/brand/avatars/a33.png'
import a47 from '@/assets/brand/avatars/a47.png'
import a68 from '@/assets/brand/avatars/a68.png'

export const avatarByContact: Record<string, string> = {
  me: a12,
  c_ali: a33,
  c_bek: a68,
  c_aziz: a11,
  c_timur: a15,
  c_madina: a47,
}

export function avatarOf(contactId: string): string | undefined {
  return avatarByContact[contactId]
}
