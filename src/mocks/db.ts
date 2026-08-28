import type { Db, Session } from '@zap/shared/types'
import { createSeed } from './seed'

const DB_KEY = 'zap:db:v2'
const SESSION_KEY = 'zap:session:v1'

let db: Db | null = null
let session: Session | null = null

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function getDb(): Db {
  if (!db) db = read<Db>(DB_KEY) ?? createSeed()
  return db
}

export function persistDb() {
  if (db) write(DB_KEY, db)
}

export function getSession(): Session {
  if (!session) session = read<Session>(SESSION_KEY) ?? { stage: 'onboarding' }
  return session
}

export function persistSession() {
  if (session) write(SESSION_KEY, session)
}

export function resetAll() {
  db = createSeed()
  session = { stage: 'onboarding' }
  write(DB_KEY, db)
  write(SESSION_KEY, session)
}
