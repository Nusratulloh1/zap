// Локальная фикстура JSON-API ОФД: отдаёт записанные реальные чеки по terminalId.
// Нужна только чтобы ПРОДЕМОНСТРИРОВАТЬ парсер (сервер прода не имеет сети к ОФД).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => readFileSync(path.join(dir, '..', 'backend', 'test', 'fixtures', n), 'utf8')
const byTerminal = {
  LG420211638943: fx('ofd-payment-1.json'),
  VG544170047867: fx('ofd-payment-2.json'),
}

createServer((req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/api/payment')) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let t = ''
      try { t = JSON.parse(body).terminalId } catch {}
      const json = byTerminal[t] ?? byTerminal.LG420211638943
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(json)
    })
    return
  }
  res.writeHead(404); res.end('nope')
}).listen(3399, () => console.log('OFD JSON fixture on :3399 (POST /api/payment)'))
