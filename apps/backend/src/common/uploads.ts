// Пользовательские файлы (пока только Photo Moment, vision §C15).
//
// Каталог задаётся переменной окружения и в проде должен быть примонтированным
// томом: фото — это «момент годичной давности», он обязан пережить редеплой,
// а слой образа при каждом деплое пересоздаётся.
import { join } from 'node:path'

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')

/** Публичный префикс, под которым nginx/Nest отдают файлы. */
export const UPLOAD_ROUTE = '/uploads'

/**
 * Относительный путь в базе → URL для клиента.
 *
 * В базе намеренно лежит путь, а не готовый URL: домен и схема отличаются
 * между dev и прод, а перенос базы не должен ломать ссылки.
 */
export function photoUrlOf(rel: string | null | undefined): string | undefined {
  if (!rel) return undefined
  const base = (process.env.PUBLIC_API_URL ?? '').replace(/\/+$/, '')
  const path = `${UPLOAD_ROUTE}/${rel.split('\\').join('/')}`
  return base ? base + path : path
}
