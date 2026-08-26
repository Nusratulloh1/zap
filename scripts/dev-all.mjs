// Один вход в локальную разработку: БД (docker compose ИЛИ embedded-postgres,
// если Docker недоступен) → миграции → бэкенд :3202 (watch) → фронт :5173.
// Ctrl+C гасит всё. Прод не затрагивается: отдельная БД, .env.development, dry-run SMS.
import { execSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const BACKEND = path.join(ROOT, 'backend')
const children = []
const COLORS = { db: '\x1b[35m', api: '\x1b[36m', web: '\x1b[33m' }

function prefixed(name, cmd, args, opts = {}) {
  const c = COLORS[name] ?? ''
  const child = spawn(cmd, args, { shell: true, ...opts })
  const pipe = (stream) =>
    stream.on('data', (d) =>
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((l) => console.log(`${c}[${name}]\x1b[0m ${l}`)),
    )
  pipe(child.stdout)
  pipe(child.stderr)
  children.push(child)
  child.on('exit', (code) => {
    if (code !== null && code !== 0 && !shuttingDown) {
      console.error(`${c}[${name}]\x1b[0m процесс упал (код ${code}) — останавливаю всё`)
      shutdown(1)
    }
  })
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const ch of children) {
    try {
      process.platform === 'win32' ? execSync(`taskkill /pid ${ch.pid} /T /F`, { stdio: 'ignore' }) : ch.kill('SIGTERM')
    } catch {
      /* noop */
    }
  }
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

const tryConnect = (port, host) =>
  new Promise((resolve) => {
    const c = net.connect({ port, host })
    c.once('connect', () => (c.destroy(), resolve(true)))
    c.once('error', () => (c.destroy(), resolve(false)))
  })

// node 24: vite может слушать только ::1 — пробуем оба лупбэка
const waitPort = async (port, tries = 90) => {
  for (let i = 0; i < tries; i++) {
    if ((await tryConnect(port, '127.0.0.1')) || (await tryConnect(port, '::1'))) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('порт ' + port + ' не поднялся')
}

const hasDocker = (() => {
  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

// .env.development из примера при первом запуске
const envFile = path.join(BACKEND, '.env.development')
if (!existsSync(envFile)) {
  copyFileSync(path.join(BACKEND, '.env.development.example'), envFile)
  console.log('[dev] создан backend/.env.development из примера')
}
const devEnv = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

process.on('unhandledRejection', (e) => {
  console.error('[dev] ошибка запуска:', e instanceof Error ? e.message : e)
  shutdown(1)
})

// 1) База
if (hasDocker) {
  console.log('[dev] Docker найден → docker compose (Postgres :5433 + Adminer :8081)')
  execSync('docker compose -f docker-compose.dev.yml up -d', { cwd: BACKEND, stdio: 'inherit' })
} else {
  console.log('[dev] Docker недоступен → embedded PostgreSQL (:5433, каталог backend/.pgdata)')
  prefixed('db', 'node', ['scripts/dev-db.mjs'], { cwd: BACKEND })
}
await waitPort(5433)
console.log('[dev] Postgres готов на :5433')

// 2) Миграции (dev)
execSync('npx prisma migrate dev --skip-generate --name dev 2>nul || npx prisma migrate deploy', {
  cwd: BACKEND,
  stdio: 'inherit',
  env: { ...process.env, ...devEnv },
  shell: true,
})

// 3) Бэкенд в watch-режиме
prefixed('api', 'pnpm', ['start:dev'], { cwd: BACKEND, env: { ...process.env, ...devEnv } })
await waitPort(Number(devEnv.PORT ?? 3202), 180)
console.log(`[dev] API готов: http://localhost:${devEnv.PORT ?? 3202} (SMS: dry-run)`)

// 4) Фронт (real-режим на локальный бэкенд)
prefixed('web', 'pnpm', ['dev', '--port', '5173', '--strictPort'], {
  cwd: ROOT,
  env: { ...process.env, VITE_API_URL: `http://localhost:${devEnv.PORT ?? 3202}` },
})
await waitPort(5173, 120)
console.log('\n[dev] ГОТОВО: http://localhost:5173  (API http://localhost:3202, Adminer http://localhost:8081 при Docker)')
console.log('[dev] Демо-данные: pnpm db:seed:demo · Сброс: pnpm db:reset · Студия: pnpm db:studio\n')
