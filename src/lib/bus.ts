// Tiny typed event bus used by the mock event simulator and stores.
import type { Split } from '@zap/shared/types'

export interface BusEvents {
  'db:changed': { domains: string[] }
  'split:event': { split: Split; message: string; kind: 'opened' | 'paid' | 'closed' | 'cashback' }
  // реальный API: глобальные запросы подтверждений (PIN / номер гостя / SMS-код)
  'pin:request': { resolve: () => void; reject: () => void }
  'guest-phone:request': { resolve: (phone: string) => void; reject: () => void }
  'guest-otp:request': { resolve: (code: string) => void; reject: () => void }
  // фискальный чек: позиции догрузились / парсинг упал
  'fiscal:update': { jobId: string; status: 'ready' | 'failed' }
  // публичная страница участника: событие в комнате сплита (для live-прогресса)
  'public-split:touch': { kind: 'opened' | 'paid' | 'closed'; cashback?: number }
}

type Handler<T> = (payload: T) => void

const handlers = new Map<keyof BusEvents, Set<Handler<never>>>()

export const bus = {
  on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>) {
    if (!handlers.has(event)) handlers.set(event, new Set())
    handlers.get(event)!.add(fn as Handler<never>)
    return () => bus.off(event, fn)
  },
  off<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>) {
    handlers.get(event)?.delete(fn as Handler<never>)
  },
  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]) {
    handlers.get(event)?.forEach((fn) => (fn as Handler<BusEvents[K]>)(payload))
  },
}
