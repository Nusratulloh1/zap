// Симулятор «реального времени»: участники открывают ссылку и платят по таймерам.
import { getDb } from './db'
import { markOpened, payShareSync } from './api'

const timers = new Map<string, number[]>()

function schedule(splitId: string, delay: number, fn: () => void) {
  const id = window.setTimeout(fn, delay)
  const list = timers.get(splitId) ?? []
  list.push(id)
  timers.set(splitId, list)
}

/** Запускает сценарий: участник открывает ссылку через ~6с и платит через ~14с. */
export function simulateSplitProgress(splitId: string, baseDelay = 6000) {
  cancelSimulation(splitId)
  const split = getDb().splits.find((s) => s.id === splitId)
  if (!split || split.status !== 'active') return

  const pending = split.members.filter(
    (m) => !m.isYou && (m.status === 'waiting' || m.status === 'opened'),
  )
  pending.forEach((member, i) => {
    const openAt = baseDelay + i * 5000
    const payAt = openAt + 8000 + i * 2000
    if (member.status === 'waiting') {
      schedule(splitId, openAt, () => markOpened(splitId, member.contactId))
    }
    schedule(splitId, payAt, () => payShareSync(splitId, member.contactId))
  })
}

export function cancelSimulation(splitId: string) {
  timers.get(splitId)?.forEach((id) => clearTimeout(id))
  timers.delete(splitId)
}

/** После перезагрузки продолжаем «жизнь» активных сплитов. */
export function resumeSimulations() {
  for (const split of getDb().splits) {
    if (split.status === 'active' && split.members.some((m) => !m.isYou && m.status !== 'paid' && m.status !== 'debt')) {
      simulateSplitProgress(split.id, 5000)
    }
  }
}
