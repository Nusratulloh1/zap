import type { Db } from '@/entities/types'
import { fetchBootstrap } from '@/api'

let promise: Promise<Db> | null = null

/** Один общий bootstrap-запрос на все сторы (даёт латентность и skeleton-состояния). */
export function ensureBootstrap(): Promise<Db> {
  promise ??= fetchBootstrap()
  return promise
}

export function resetBootstrap() {
  promise = null
}
