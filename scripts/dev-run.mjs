// Запуск команды с окружением backend/.env.development (локальная БД :5433).
// Использование: node scripts/dev-run.mjs <cmd...>   (cwd = backend/)
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const BACKEND = path.join(ROOT, 'backend')
const envFile = path.join(BACKEND, '.env.development')
if (!existsSync(envFile)) copyFileSync(path.join(BACKEND, '.env.development.example'), envFile)
const devEnv = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const [cmd, ...args] = process.argv.slice(2)
const r = spawnSync(cmd, args, { cwd: BACKEND, stdio: 'inherit', shell: true, env: { ...process.env, ...devEnv } })
process.exit(r.status ?? 1)
