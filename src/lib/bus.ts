// Tiny typed event bus used by the mock event simulator and stores.
import type { Split } from '@/entities/types'

export interface BusEvents {
  'db:changed': { domains: string[] }
  'split:event': { split: Split; message: string; kind: 'opened' | 'paid' | 'closed' | 'cashback' }
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
