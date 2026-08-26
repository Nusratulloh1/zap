// Шим симулятора: в мок-режиме — прежний симулятор событий; в реальном —
// подключение Socket.IO (события приходят с бэкенда, симулятор не нужен).
import { isRealApi } from './index'
import { connectRealtime } from './real'
import {
  resumeSimulations as mockResume,
  simulateSplitProgress as mockSimulate,
  cancelSimulation as mockCancel,
} from '@/mocks/events'

export function resumeSimulations() {
  if (isRealApi) {
    connectRealtime()
    return
  }
  mockResume()
}

export function simulateSplitProgress(splitId: string, baseDelay?: number) {
  if (isRealApi) return // события приходят с бэкенда по Socket.IO
  mockSimulate(splitId, baseDelay)
}

export function cancelSimulation(splitId: string) {
  if (isRealApi) return
  mockCancel(splitId)
}
