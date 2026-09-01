// Локальный фикстур-сервер ОФД (:3299): демо фискального инжеста офлайн.
// GET /check?... → страница чека (фикстура), GET /fail?... → 500 (путь фейла).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const html = readFileSync(path.resolve('apps/backend/test/fixtures/ofd-check-1.html'), 'utf8')

createServer((req, res) => {
  if (req.url?.startsWith('/fail')) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('OFD down (fixture)')
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}).listen(3299, () => {
  console.log('OFD-фикстура: http://localhost:3299/check (и /fail для пути ошибки)')
  console.log('демо-QR: http://localhost:3299/check?t=EP000000000001&r=481&s=120000000&fs=DEMO000000000001&d=202608261942')
})
