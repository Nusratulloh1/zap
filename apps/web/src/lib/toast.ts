// Собственный тост-менеджер: максимум 2 видимых, очередь дальше,
// дубли в пределах 2с коалесцируются (×N), автодисмисс 2.5с.
import { reactive } from 'vue'

export interface ToastItem {
  id: number
  text: string
  kind: 'default' | 'success'
  count: number
  createdAt: number
  /* тост с действием (например, «Перезагрузить» для обновления SW): не автодисмиссится */
  action?: { label: string; fn: () => void }
}

const MAX_VISIBLE = 2
const LIFETIME = 2500
const DEDUP_WINDOW = 2000

export const toastState = reactive({
  items: [] as ToastItem[],
})

const queue: ToastItem[] = []
const timers = new Map<number, number>()
let nextId = 1

function scheduleDismiss(item: ToastItem) {
  if (item.action) return
  clearTimeout(timers.get(item.id))
  timers.set(
    item.id,
    window.setTimeout(() => dismiss(item.id), LIFETIME),
  )
}

export function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  const i = toastState.items.findIndex((t) => t.id === id)
  if (i >= 0) toastState.items.splice(i, 1)
  // показать следующий из очереди
  const next = queue.shift()
  if (next) {
    next.createdAt = Date.now()
    toastState.items.unshift(next)
    scheduleDismiss(next)
  }
}

function push(text: string, kind: ToastItem['kind'], action?: ToastItem['action']) {
  // дубль? — коалесцируем в существующий (включая очередь)
  const dup =
    toastState.items.find((t) => t.text === text && Date.now() - t.createdAt < DEDUP_WINDOW) ??
    queue.find((t) => t.text === text)
  if (dup) {
    dup.count += 1
    dup.createdAt = Date.now()
    if (toastState.items.includes(dup)) scheduleDismiss(dup)
    return
  }
  const item: ToastItem = { id: nextId++, text, kind, count: 1, createdAt: Date.now(), action }
  if (toastState.items.length >= MAX_VISIBLE) {
    queue.push(item)
    return
  }
  // новый сверху — существующие уезжают вниз (FLIP в ToastHost)
  toastState.items.unshift(item)
  scheduleDismiss(item)
}

type ToastFn = ((text: string) => void) & {
  success: (text: string) => void
  action: (text: string, label: string, fn: () => void) => void
}

export const toast: ToastFn = Object.assign((text: string) => push(text, 'default'), {
  success: (text: string) => push(text, 'success'),
  action: (text: string, label: string, fn: () => void) => push(text, 'default', { label, fn }),
})
