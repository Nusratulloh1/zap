// E2E фискального инжеста против ЛОКАЛЬНОГО фикстур-сервера ОФД:
// resolve → мгновенный total → async-парсинг → items; путь фейла (500);
// OCR без ключа → 503 (в проде ключ задаёт env, вызов мокается юнитами).
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

const PG_PORT = 5547
const OFD_PORT = 3298
const DB_URL = `postgresql://zap:zap@localhost:${PG_PORT}/zap_test`

process.env.DATABASE_URL = DB_URL
process.env.JWT_SECRET = 'test-secret'
process.env.SMS_DRY_RUN = 'true'
process.env.OTP_DEV_HOOK = 'true'
process.env.NODE_ENV = 'test'
process.env.OFD_HOSTS = `localhost:${OFD_PORT}`
process.env.OFD_API_URL = `http://localhost:${OFD_PORT}/api/payment`
delete process.env.ANTHROPIC_API_KEY

let pg: ChildProcess
let ofd: Server
let app: INestApplication
let http: () => ReturnType<typeof request>
let access = ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('Fiscal ingestion e2e (fixture OFD)', () => {
  beforeAll(async () => {
    pg = spawn(process.execPath, ['test/pg-runner.mjs', String(PG_PORT)], { stdio: ['pipe', 'pipe', 'inherit'] })
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('PG start timeout')), 120_000)
      pg.stdout!.on('data', (d: Buffer) => d.toString().includes('READY') && (clearTimeout(t), resolve()))
      pg.on('exit', (c) => reject(new Error('pg exited ' + c)))
    })
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: DB_URL }, stdio: 'inherit' })

    // фикстура-сервер имитирует JSON-API ОФД (POST /api/payment):
    // fiscalSign 'FSFAIL' → 403 (недоступность), иначе — реальный JSON чека.
    const paymentJson = readFileSync(path.join(__dirname, 'fixtures', 'ofd-payment-1.json'), 'utf8')
    ofd = createServer((req, res) => {
      if (req.method === 'POST' && req.url?.startsWith('/api/payment')) {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const sign = (() => { try { return JSON.parse(body).fiscalSign } catch { return '' } })()
          if (sign === 'FSFAIL') { res.writeHead(403); res.end('blocked'); return }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(paymentJson)
        })
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body>ofd spa shell</body></html>')
    }).listen(OFD_PORT)

    const { AppModule } = await import('../src/app.module')
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    http = () => request(app.getHttpServer())

    const otp = await http().post('/auth/otp/request').send({ phone: '998901230001' }).expect(200)
    const ver = await http().post('/auth/otp/verify').send({ phone: '998901230001', code: otp.body.devCode }).expect(200)
    access = ver.body.accessToken
  })

  afterAll(async () => {
    await app?.close()
    ofd?.close()
    pg?.kill('SIGTERM')
    await sleep(2500)
  })

  it('resolve: fiscal без суммы (s=подпись) + jobId; позиции из JSON-API асинхронно', async () => {
    const payload = `http://localhost:${OFD_PORT}/check?t=LG42&r=6330&c=20260812111605&s=500597331143`
    const res = await http().get('/qr/resolve?payload=' + encodeURIComponent(payload)).set('Authorization', `Bearer ${access}`).expect(200)
    expect(res.body.type).toBe('fiscal')
    expect(res.body.instant.totalAmount).toBeUndefined() // суммы в QR нет
    expect(res.body.instant.datetime).toContain('2026-08-12T11:16:05')
    expect(res.body.jobId).toBeTruthy()

    // джоба: ждём ready (данные из JSON-API)
    let status = 'pending'
    let receipt: { total: number; merchant: string; items: { name: string; amount: number }[] } | undefined
    for (let i = 0; i < 20 && status === 'pending'; i++) {
      await sleep(300)
      const st = await http().get('/qr/fiscal/' + res.body.jobId).set('Authorization', `Bearer ${access}`).expect(200)
      status = st.body.status
      receipt = st.body.receipt
    }
    expect(status).toBe('ready')
    expect(receipt!.total).toBe(16_000)
    expect(receipt!.merchant).toContain('MURODOV UMID')
    expect(receipt!.items).toHaveLength(1)
    expect(receipt!.items[0]!.name).toBe('Маргарин')
  })

  it('дедуп: повторный скан того же чека возвращает тот же jobId', async () => {
    const payload = `http://localhost:${OFD_PORT}/check?t=LG42&r=6330&c=20260812111605&s=500597331143`
    const a = await http().get('/qr/resolve?payload=' + encodeURIComponent(payload)).set('Authorization', `Bearer ${access}`).expect(200)
    const b2 = await http().get('/qr/resolve?payload=' + encodeURIComponent(payload)).set('Authorization', `Bearer ${access}`).expect(200)
    expect(a.body.jobId).toBe(b2.body.jobId)
  })

  it('ОФД недоступен (403): job → failed, health.fetch_blocked растёт (не parse_failed)', async () => {
    const payload = `http://localhost:${OFD_PORT}/check?t=EP9&r=9&c=202608261200&s=FSFAIL`
    const res = await http().get('/qr/resolve?payload=' + encodeURIComponent(payload)).set('Authorization', `Bearer ${access}`).expect(200)
    expect(res.body.type).toBe('fiscal')
    let status = 'pending'
    for (let i = 0; i < 30 && status === 'pending'; i++) {
      await sleep(400)
      const st = await http().get('/qr/fiscal/' + res.body.jobId).set('Authorization', `Bearer ${access}`).expect(200)
      status = st.body.status
    }
    expect(status).toBe('failed')

    const health = await http().get('/health').expect(200)
    expect(health.body.fiscal.parse_ok).toBeGreaterThanOrEqual(1)
    expect(health.body.fiscal.fetch_blocked).toBeGreaterThanOrEqual(1)
  })

  it('не-вайтлист хост не фискальный и не фетчится (SSRF-guard)', async () => {
    const res = await http()
      .get('/qr/resolve?payload=' + encodeURIComponent('https://evil.example.com/check?s=1&fs=X'))
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
    expect(res.body.type).toBe('unknown')
  })

  it('client-result: клиентский фетч принят, сервер перепроверил суммы, чек ready', async () => {
    const res = await http()
      .post('/qr/fiscal/client-result')
      .set('Authorization', `Bearer ${access}`)
      .send({
        sourceUrl: `http://localhost:${OFD_PORT}/check?t=LG777&r=6330&c=20260812111605&s=500597331143`,
        merchantName: 'MURODOV UMID',
        merchantInn: '30809900222317',
        datetime: '2026-08-12T11:16:05',
        totalAmount: 16_000,
        items: [{ name: 'Маргарин', qtyMilli: 1000, unitPrice: 16_000, lineTotal: 16_000 }],
      })
      .expect(200)
    expect(res.body.status).toBe('ready')
    expect(res.body.receipt.total).toBe(16_000)
    expect(res.body.receipt.items[0].name).toBe('Маргарин')
    expect(res.body.receipt.source).toBe('client_fetch')
  })

  it('client-result: клиентской математике не доверяем — расхождение сумм → 400', async () => {
    await http()
      .post('/qr/fiscal/client-result')
      .set('Authorization', `Bearer ${access}`)
      .send({
        sourceUrl: `http://localhost:${OFD_PORT}/check?t=LGBAD&r=1&c=20260812111605&s=1`,
        totalAmount: 16_000,
        items: [{ name: 'X', qtyMilli: 1000, unitPrice: 99_000, lineTotal: 99_000 }], // 99k != 16k
      })
      .expect(400)
  })

  it('OCR без ANTHROPIC_API_KEY → 503 (флоу не блокируется, UI показывает тост)', async () => {
    await http()
      .post('/qr/fiscal/ocr')
      .set('Authorization', `Bearer ${access}`)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0]), { filename: 'r.jpg', contentType: 'image/jpeg' })
      .expect(503)
  })
})
