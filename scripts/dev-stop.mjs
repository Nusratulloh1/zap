// Останов локального стека: docker compose down (если Docker) + освобождение портов.
import { execSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')

try {
  execSync('docker compose -f docker-compose.dev.yml down', { cwd: path.join(ROOT, 'apps', 'backend'), stdio: 'inherit' })
} catch {
  /* docker недоступен — embedded PG умирает вместе с dev:all */
}

for (const port of [5173, 3202, 5433]) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
      const pids = [...new Set(out.split(/\r?\n/).filter((l) => l.includes('LISTENING')).map((l) => l.trim().split(/\s+/).pop()))]
      for (const pid of pids) if (pid && pid !== '0') execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
    }
  } catch {
    /* порт свободен */
  }
}
console.log('локальный стек остановлен')
