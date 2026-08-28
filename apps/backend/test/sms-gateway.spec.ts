// Контракт со шлюзом smsxabar (broker-api) и поведение при его отказах.
//
// Повод: 27.08.2026 шлюз ~90 минут отвечал 400 {"error-code":102,
// "error-description":"Account lock"} — 12 OTP подряд не ушли. Тесты
// фиксируют форму запроса (чтобы отказ нельзя было списать на наш payload)
// и то, что на блокировку мы не ретраим и не молчим.
import { SmsService, parseProviderError, isAccountError, isRequestError } from '../src/sms/sms.service'

type LogRow = { phone: string; kind: string; status: string; error?: string; providerMessageId?: string }

function makeService(opts: { fetchImpl?: jest.Mock; rows?: LogRow[] } = {}) {
  const rows = opts.rows ?? []
  const prisma = {
    smsLog: {
      create: jest.fn(async ({ data }: { data: LogRow }) => {
        rows.push(data)
        return data
      }),
      count: jest.fn(async () => 0),
      findFirst: jest.fn(async () => null),
    },
    user: { findUnique: jest.fn(async () => null) },
  }
  const svc = new SmsService(prisma as never)
  return { svc, prisma, rows }
}

const OK = () => Promise.resolve(new Response('Request is received', { status: 200 }))
const LOCKED = () =>
  Promise.resolve(new Response('{"error-code":102,"error-description":"Account lock"}', { status: 400 }))
const SYNTAX = () =>
  Promise.resolve(new Response('{"error-code":101,"error-description":"Syntax error"}', { status: 400 }))

const ENV_KEYS = [
  'SMS_DRY_RUN',
  'SMS_SERVICE_URL',
  'SMS_SERVICE_USERNAME',
  'SMS_SERVICE_PASSWORD',
  'SMS_ORIGINATOR',
  'ALERT_WEBHOOK_URL',
] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  process.env.SMS_DRY_RUN = 'false'
  process.env.SMS_SERVICE_URL = 'https://send.smsxabar.uz'
  process.env.SMS_SERVICE_USERNAME = 'user'
  process.env.SMS_SERVICE_PASSWORD = 'secret'
  process.env.SMS_ORIGINATOR = '3700'
  delete process.env.ALERT_WEBHOOK_URL
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  jest.restoreAllMocks()
})

describe('разбор ошибки провайдера', () => {
  it('вытаскивает код и описание из реального тела ответа', () => {
    const e = parseProviderError('{"error-code":102,"error-description":"Account lock"}')
    expect(e).toEqual({ code: 102, description: 'Account lock' })
  })

  it('102 — состояние аккаунта, 101 — наш запрос', () => {
    expect(isAccountError({ code: 102, description: 'Account lock' })).toBe(true)
    expect(isRequestError({ code: 102, description: 'Account lock' })).toBe(false)
    expect(isRequestError({ code: 101, description: 'Syntax error' })).toBe(true)
    expect(isAccountError({ code: 101, description: 'Syntax error' })).toBe(false)
  })

  it('не падает на не-JSON и на пустом теле', () => {
    expect(parseProviderError('<html>502</html>')).toEqual({ code: null, description: null })
    expect(parseProviderError('')).toEqual({ code: null, description: null })
    expect(isAccountError(parseProviderError(''))).toBe(false)
  })
})

describe('форма запроса к broker-api', () => {
  it('шлёт ровно тот payload, который принимает шлюз', async () => {
    const fetchMock = jest.fn(OK)
    global.fetch = fetchMock as never
    const { svc } = makeService()

    await svc.send('998901888338', 'ZAP! Kod: 123456', 'otp' as never)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://send.smsxabar.uz/broker-api/send')
    expect(init.method).toBe('POST')

    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    // Basic base64(user:pass) — ровно как ждёт шлюз
    expect(headers.Authorization).toBe('Basic ' + Buffer.from('user:secret').toString('base64'))

    const body = JSON.parse(String(init.body)) as {
      messages: { recipient: string; 'message-id': string; sms: { originator: string; content: { text: string } } }[]
    }
    expect(body.messages).toHaveLength(1)
    const m = body.messages[0]!
    expect(m.recipient).toBe('998901888338') // только цифры, без «+»
    expect(m['message-id']).toMatch(/^zap-/)
    expect(m.sms.originator).toBe('3700')
    expect(m.sms.content.text).toBe('ZAP! Kod: 123456')
  })

  it('CRLF в .env не попадает ни в URL, ни в Basic-заголовок', async () => {
    // ровно этот случай нашёлся на проде: EnvironmentFile отдавал URL с \r
    process.env.SMS_SERVICE_URL = 'https://send.smsxabar.uz\r'
    process.env.SMS_SERVICE_PASSWORD = 'secret\r'
    process.env.SMS_ORIGINATOR = '3700\r'
    const fetchMock = jest.fn(OK)
    global.fetch = fetchMock as never
    const { svc } = makeService()

    await svc.send('998901888338', 'x', 'otp' as never)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://send.smsxabar.uz/broker-api/send')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Basic ' + Buffer.from('user:secret').toString('base64'),
    )
    const body = JSON.parse(String(init.body)) as { messages: { sms: { originator: string } }[] }
    expect(body.messages[0]!.sms.originator).toBe('3700')
  })

  it('кривой номер отклоняется до похода в сеть', async () => {
    const fetchMock = jest.fn(OK)
    global.fetch = fetchMock as never
    const { svc, rows } = makeService()

    await expect(svc.send('12345', 'x', 'otp' as never)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(rows[0]).toMatchObject({ status: 'failed', error: 'invalid phone format' })
  })
})

describe('поведение при отказах шлюза', () => {
  it('на «Account lock» не ретраит и пишет ошибку провайдера в лог', async () => {
    const fetchMock = jest.fn(LOCKED)
    global.fetch = fetchMock as never
    const { svc, rows } = makeService()

    await expect(svc.send('998901888338', 'x', 'otp' as never)).rejects.toMatchObject({ status: 503 })

    expect(fetchMock).toHaveBeenCalledTimes(1) // без второго захода
    expect(rows.at(-1)).toMatchObject({ status: 'failed' })
    expect(rows.at(-1)!.error).toContain('Account lock')
    expect(rows.at(-1)!.error).toContain('102')
  })

  it('ошибка наружу несёт машинный код — клиент переведёт сам', async () => {
    global.fetch = jest.fn(LOCKED) as never
    const { svc } = makeService()

    const err = await svc.send('998901888338', 'x', 'otp' as never).catch((e: unknown) => e)
    const res = (err as { getResponse: () => { code?: string } }).getResponse()
    expect(res.code).toBe('sms_unavailable')
  })

  it('на «Syntax error» тоже не ретраит: payload за 300 мс не исправится', async () => {
    const fetchMock = jest.fn(SYNTAX)
    global.fetch = fetchMock as never
    const { svc } = makeService()

    await expect(svc.send('998901888338', 'x', 'otp' as never)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('сетевой сбой — ретраит один раз (это как раз лечится повтором)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
    global.fetch = fetchMock as never
    const { svc } = makeService()

    await expect(svc.send('998901888338', 'x', 'otp' as never)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('первый заход упал, второй прошёл — отправка считается успешной', async () => {
    const fetchMock = jest.fn().mockRejectedValueOnce(new Error('ETIMEDOUT')).mockImplementation(OK)
    global.fetch = fetchMock as never
    const { svc, rows } = makeService()

    await svc.send('998901888338', 'x', 'otp' as never)
    expect(rows.at(-1)).toMatchObject({ status: 'sent' })
  })

  it('блокировка уходит в алерт-вебхук, а не только в лог', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hook.example/zap'
    const calls: string[] = []
    const fetchMock = jest.fn((url: string) => {
      calls.push(url)
      return url.includes('hook.example') ? OK() : LOCKED()
    })
    global.fetch = fetchMock as never
    const { svc } = makeService()

    await expect(svc.send('998901888338', 'x', 'otp' as never)).rejects.toThrow()
    await new Promise((r) => setImmediate(r)) // алерт уходит фоном

    expect(calls.some((u) => u.includes('hook.example'))).toBe(true)
  })
})

describe('dry-run: демо остаётся живым, пока провайдер чинится', () => {
  it('ничего не отправляет и помечает запись dry_run', async () => {
    process.env.SMS_DRY_RUN = 'true'
    const fetchMock = jest.fn(OK)
    global.fetch = fetchMock as never
    const { svc, rows } = makeService()

    await svc.send('998901888338', 'ZAP! Kod: 000000', 'otp' as never)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(rows.at(-1)).toMatchObject({ status: 'dry_run' })
    // код виден через /dev/sms/latest — так тестируют вход без реальной SMS
    expect(svc.devLatest('998901888338')?.text).toBe('ZAP! Kod: 000000')
  })
})

describe('healthStats', () => {
  it('поднимает accountLocked, когда последний отказ новее последней удачи', async () => {
    const { svc, prisma } = makeService()
    prisma.smsLog.count = jest.fn(async () => 3) as never
    prisma.smsLog.findFirst = jest.fn(async ({ where }: { where: { status: string } }) =>
      where.status === 'failed'
        ? { createdAt: new Date('2026-08-27T12:50:58Z'), error: 'HTTP 400: {"error-code":102,"error-description":"Account lock"}' }
        : { createdAt: new Date('2026-08-27T10:42:48Z') },
    ) as never

    const s = await svc.healthStats()
    expect(s.accountLocked).toBe(true)
    expect(s.failureRate24h).toBeCloseTo(0.5)
  })

  it('после успешной отправки блокировка считается снятой', async () => {
    const { svc, prisma } = makeService()
    prisma.smsLog.count = jest.fn(async () => 1) as never
    prisma.smsLog.findFirst = jest.fn(async ({ where }: { where: { status: string } }) =>
      where.status === 'failed'
        ? { createdAt: new Date('2026-08-27T12:50:58Z'), error: 'HTTP 400: {"error-code":102,"error-description":"Account lock"}' }
        : { createdAt: new Date('2026-08-28T07:52:15Z') },
    ) as never

    const s = await svc.healthStats()
    expect(s.accountLocked).toBe(false)
  })
})
