// Дочерний процесс для e2e: настоящий PostgreSQL (embedded) на указанном порту.
// Печатает READY после старта; живёт до SIGTERM/закрытия stdin.
import { rmSync } from 'node:fs'
import EmbeddedPostgres from 'embedded-postgres'

const port = Number(process.argv[2] ?? 5544)
const dir = `./.pgdata-test-${port}`
rmSync(dir, { recursive: true, force: true })

const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'zap', password: 'zap', port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'] })
await pg.initialise()
await pg.start()
await pg.createDatabase('zap_test')
console.log('READY')

const stop = async () => {
  try {
    await pg.stop()
  } finally {
    rmSync(dir, { recursive: true, force: true })
    process.exit(0)
  }
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
process.stdin.on('close', stop)
process.stdin.resume()
