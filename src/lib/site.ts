// Два хоста одного приложения:
//   zapapp.uz      — только публичный лендинг
//   use.zapapp.uz  — платформа (всё остальное)
// Сборка одна: куда пускать пользователя, решаем по текущему хосту.
// Локальная разработка и превью — режим 'dev': работают оба раздела.

export const LANDING_ORIGIN = 'https://zapapp.uz'
export const APP_ORIGIN = 'https://use.zapapp.uz'

const LANDING_HOSTS = ['zapapp.uz', 'www.zapapp.uz']
const APP_HOSTS = ['use.zapapp.uz']

export type SiteMode = 'landing' | 'app' | 'dev'

export function siteMode(): SiteMode {
  if (typeof location === 'undefined') return 'dev'
  const host = location.hostname
  if (LANDING_HOSTS.includes(host)) return 'landing'
  if (APP_HOSTS.includes(host)) return 'app'
  return 'dev'
}

/**
 * Ссылка внутрь платформы. На лендинг-хосте это абсолютный адрес
 * use.zapapp.uz, в остальных случаях — обычный путь того же origin.
 */
export function appHref(path: string): string {
  return siteMode() === 'landing' ? APP_ORIGIN + path : path
}
