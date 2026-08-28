// Локальный PostgreSQL без Docker: embedded-postgres поднимает настоящий PG
// в .pgdata на порту 5433. Использование: pnpm dev:db (держит процесс).
import EmbeddedPostgres from 'embedded-postgres'

const pg = new EmbeddedPostgres({
  databaseDir: './.pgdata',
  user: 'zap',
  password: 'zap',
  port: 5433,
  persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

const fresh = !(await import('node:fs')).existsSync('./.pgdata/PG_VERSION')
if (fresh) await pg.initialise()
await pg.start()
if (fresh) await pg.createDatabase('zap')
console.log('PostgreSQL запущен: postgresql://zap:zap@localhost:5433/zap (Ctrl+C — остановить)')

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
