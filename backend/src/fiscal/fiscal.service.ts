// Инжест фискальных чеков: парсинг публичной страницы ОФД, на которую ведёт QR
// на чеке (без контракта/API-ключа — та же страница, что открывает любой человек).
// Правило: инжест НИКОГДА не блокирует флоу — мгновенный ответ из самих
// параметров QR, позиции догружаются асинхронно + Socket.IO.
import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as cheerio from 'cheerio'
import { lookup } from 'node:dns/promises'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'
import path from 'node:path'
import { PrismaService } from '../common/prisma.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'

export interface FiscalInstant {
  totalAmount?: number
  datetime?: string
}

export interface ParsedReceipt {
  merchantName?: string
  merchantInn?: string
  datetime?: Date
  totalAmount: number
  items: { name: string; qtyMilli: number; unitPrice: number; lineTotal: number }[]
}

/** Форма JSON-ответа new-ofd.soliq.uz/api/payment (только используемые поля). */
interface OfdPayment {
  tin?: number | string
  paymentDate?: string
  cashTotal?: number
  cardTotal?: number
  extraInfo?: { companyName?: string }
  paymentDetails?: { name?: string; productName?: string; price?: number; amount?: number }[]
}

const SNAP_DIR = path.resolve('var/fiscal-snapshots')
const SNAP_RETENTION_MS = 30 * 24 * 3600_000
const MAX_BODY = 2 * 1024 * 1024
// хост JSON-API ОФД, откуда SPA берёт данные чека (POST /api/payment)
const OFD_API_HOST = 'new-ofd.soliq.uz'

/** Фетч до ОФД недоступен (сеть/блокировка), в отличие от ошибки парсинга. */
class FetchBlockedError extends Error {}
const FETCH_TIMEOUT = 8000
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

@Injectable()
export class FiscalService {
  private readonly log = new Logger(FiscalService.name)
  private readonly jobs = new Map<string, Promise<void>>()
  private lastAlertAt = 0

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private get hosts(): string[] {
    return (process.env.OFD_HOSTS ?? 'ofd.soliq.uz').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
  }

  // ---------- 1a. распознавание фискального URL ----------

  /** Мгновенная (оффлайн) часть: классификация + параметры из самого QR. */
  tryParseFiscalUrl(payload: string): { url: URL; instant: FiscalInstant; fiscalKey: string } | null {
    let url: URL
    try {
      url = new URL(payload.trim())
    } catch {
      return null
    }
    if (!this.hosts.includes(url.host.toLowerCase())) return null

    const p = url.searchParams
    // типовые параметры чеков ОФД: t=терминал, r/c=номер чека, f/fs=фискальный
    // признак, s=сумма (тийины), d/t(дата)=YYYYMMDDHHMM. Логируем форму — для
    // доводки парсинга по реальным вариациям.
    this.log.log(`fiscal QR params shape: ${[...p.keys()].sort().join(',')} @ ${url.host}`)

    const instant: FiscalInstant = {}
    // ВАЖНО: узбекский QR НЕ несёт суммы. Параметры: t=терминал, r=№ чека,
    // c=дата YYYYMMDDHHMMSS, s=ФИСКАЛЬНЫЙ ПРИЗНАК (подпись, не сумма!).
    // Мгновенно доступна только дата — тотал приходит с самим чеком.
    const c = p.get('c') ?? [...p.values()].find((v) => /^20\d{10,12}$/.test(v))
    if (c && /^20\d{10,12}$/.test(c)) {
      const ss = c.length >= 14 ? c.slice(12, 14) : '00'
      instant.datetime = `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}T${c.slice(8, 10)}:${c.slice(10, 12)}:${ss}`
    }

    // дедуп-ключ: стабильная выжимка идентифицирующих параметров
    const idParams = ['t', 'r', 'c', 'f', 'fs', 'fp', 'i', 's']
      .map((k) => `${k}=${p.get(k) ?? ''}`)
      .join('&')
    const fiscalKey = `${url.host}|${idParams}`
    return { url, instant, fiscalKey }
  }

  // ---------- 1b. асинхронная загрузка позиций ----------

  async startJob(userId: string, url: URL, fiscalKey: string, instant: FiscalInstant): Promise<string> {
    // rate limit: 10 чеков/час на пользователя
    const hourAgo = new Date(Date.now() - 3600_000)
    const recent = await this.prisma.fiscalReceipt.count({ where: { userId, createdAt: { gt: hourAgo } } })
    if (recent >= Number(process.env.FISCAL_HOURLY_LIMIT ?? 40)) throw new HttpException('Слишком часто — подождите пару секунд', 429)

    // дедуп: тот же чек уже парсили
    const existing = await this.prisma.fiscalReceipt.findUnique({ where: { fiscalKey }, include: { items: true } })
    if (existing) {
      if (existing.status === 'ready') setTimeout(() => this.notify(userId, existing.id, 'ready'), 50)
      return existing.id
    }

    await this.metric('fiscal_resolved')
    const row = await this.prisma.fiscalReceipt.create({
      data: {
        userId,
        fiscalKey,
        url: url.toString(),
        totalAmount: instant.totalAmount,
        receiptDatetime: instant.datetime ? new Date(instant.datetime) : undefined,
      },
    })
    const job = this.runJob(userId, row.id, url).catch((e) => this.log.error(`fiscal job ${row.id}: ${String(e)}`))
    this.jobs.set(row.id, job)
    return row.id
  }

  private async runJob(userId: string, receiptId: string, url: URL) {
    try {
      // источник данных — JSON-API ОФД (new-ofd.soliq.uz/api/payment), а НЕ HTML:
      // страница чека — это SPA-оболочка, данные грузятся XHR-запросом.
      const raw = await this.fetchPaymentJson(url)
      this.lastHtml.set(receiptId, raw)
      const parsed = this.parsePaymentJson(raw)
      const stored = await this.prisma.fiscalReceipt.findUniqueOrThrow({ where: { id: receiptId } })

      // JSON от ОФД — авторитетный источник; лёгкая проверка на пустоту
      const itemsSum = parsed.items.reduce((s, i) => s + i.lineTotal, 0)
      const total = parsed.totalAmount || itemsSum
      if (!parsed.items.length || total <= 0) throw new Error(`empty receipt: items=${parsed.items.length} total=${total}`)

      await this.prisma.$transaction([
        this.prisma.fiscalReceipt.update({
          where: { id: receiptId },
          data: {
            status: 'ready',
            source: 'json',
            merchantName: parsed.merchantName,
            merchantInn: parsed.merchantInn,
            receiptDatetime: parsed.datetime ?? stored.receiptDatetime,
            totalAmount: total,
          },
        }),
        this.prisma.fiscalReceiptItem.createMany({
          data: parsed.items.map((i) => ({ receiptId, ...i })),
        }),
      ])
      await this.metric('parse_ok')
      this.notify(userId, receiptId, 'ready')
    } catch (e) {
      // отличаем НЕДОСТУПНОСТЬ фетча (сеть/блокировка ОФД) от ошибки парсинга
      if (e instanceof FetchBlockedError) {
        await this.prisma.fiscalReceipt.update({ where: { id: receiptId }, data: { status: 'fetch_blocked' } })
        await this.metric('fetch_blocked')
        this.log.warn(`fiscal fetch blocked (OFD unreachable) for ${receiptId}: ${e.message}`)
      } else {
        const snapshotFile = await this.snapshotOnFail(receiptId, e)
        await this.prisma.fiscalReceipt.update({ where: { id: receiptId }, data: { status: 'failed_parse', snapshotFile } })
        await this.metric('parse_failed')
        await this.maybeAlert(snapshotFile)
      }
      // для UI обе ветки — «не удалось», флоу не блокируется (ручной ввод / фото)
      this.notify(userId, receiptId, 'failed')
    } finally {
      this.jobs.delete(receiptId)
    }
  }

  /** DD.MM.YYYY HH:MM:SS → Date */
  private parseOfdDate(s?: string): Date | undefined {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s ?? '')
    if (!m) return undefined
    const [, dd, mm, yyyy, hh, mi, ss] = m
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss ?? '00'}`)
  }

  /** Маппинг JSON-ответа new-ofd.soliq.uz/api/payment → ParsedReceipt. */
  parsePaymentJson(raw: string): ParsedReceipt {
    const json = JSON.parse(raw) as { data?: OfdPayment }
    const d = json?.data
    if (!d) throw new Error('no data in payment json')
    const items = (d.paymentDetails ?? []).map((it) => {
      const qty = typeof it.amount === 'number' && it.amount > 0 ? it.amount : 1
      // ВАЖНО: в JSON ОФД `price` — это СТОИМОСТЬ СТРОКИ (уже цена×кол-во),
      // а не цена за единицу (сумма всех `price` == cardTotal). Юнит = price/qty.
      const lineTotal = Math.round(it.price ?? 0)
      return {
        name: String(it.name ?? it.productName ?? 'Товар').trim(),
        qtyMilli: Math.round(qty * 1000),
        unitPrice: Math.round((it.price ?? 0) / qty),
        lineTotal,
      }
    })
    const totalAmount = Math.round((d.cardTotal ?? 0) + (d.cashTotal ?? 0))
    return {
      merchantName: d.extraInfo?.companyName?.trim() || undefined,
      merchantInn: d.tin ? String(d.tin) : undefined,
      datetime: this.parseOfdDate(d.paymentDate),
      totalAmount,
      items,
    }
  }

  private lastHtml = new Map<string, string>()

  private async snapshotOnFail(receiptId: string, err: unknown): Promise<string | null> {
    try {
      mkdirSync(SNAP_DIR, { recursive: true })
      // ротация: старше 30 дней — удаляем
      for (const f of readdirSync(SNAP_DIR)) {
        const full = path.join(SNAP_DIR, f)
        if (Date.now() - statSync(full).mtimeMs > SNAP_RETENTION_MS) unlinkSync(full)
      }
      const html = this.lastHtml.get(receiptId)
      const name = `${new Date().toISOString().slice(0, 10)}-${receiptId}.html`
      writeFileSync(path.join(SNAP_DIR, name), `<!-- ${String(err)} -->\n${html ?? '(fetch failed before body)'}`)
      this.lastHtml.delete(receiptId)
      return name
    } catch {
      return null
    }
  }

  /** Запрос JSON чека к API ОФД (POST /api/payment из параметров QR).
   *  Сетевую недоступность (таймаут/блок) отличаем как FetchBlockedError. */
  private async fetchPaymentJson(url: URL): Promise<string> {
    const p = url.searchParams
    const apiUrl = new URL(process.env.OFD_API_URL ?? `https://${OFD_API_HOST}/api/payment`)
    await this.assertPublicHost(apiUrl)
    const body = JSON.stringify({
      terminalId: p.get('t'),
      paymentNo: p.get('r'),
      paymentDate: p.get('c'),
      paymentType: 'CHECK',
      fiscalSign: p.get('s'),
    })
    // ПРИМЕЧАНИЕ: клиент ОФД подписывает запрос заголовком x-signature (HMAC,
    // секрет в их фронт-бандле). Серверный вызов без легального ключа и без
    // сетевого доступа к ОФД не поддерживается — см. docs/FISCAL.md. Здесь мы
    // честно пытаемся и корректно классифицируем недоступность.
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
        body,
        signal: ctrl.signal,
      })
      if (res.status === 401 || res.status === 403 || res.status === 429) throw new FetchBlockedError(`HTTP ${res.status}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      const err = e as { name?: string; cause?: { code?: string }; message?: string }
      // таймаут/сетевые ошибки = недоступность ОФД (не ошибка парсинга)
      if (err.name === 'AbortError' || err.cause?.code === 'ETIMEDOUT' || err.cause?.code === 'ECONNREFUSED' || err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ECONNRESET')
        throw new FetchBlockedError(err.message ?? 'network')
      throw e
    } finally {
      clearTimeout(t)
    }
  }

  /** SSRF-guard: резолв не в приватные сети. */
  private async assertPublicHost(url: URL) {
    const hostname = url.hostname
    if (['localhost', '127.0.0.1'].includes(hostname)) return
    const addrs = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true })
    for (const a of addrs) {
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.|fe80:|::1|fc|fd)/i.test(a.address))
        throw new Error('private address rejected')
    }
  }

  /** SSRF-guard: только вайтлист-хосты, резолв не в приватные сети, тело ≤2МБ. */
  private async fetchGuarded(url: URL): Promise<string> {
    if (!this.hosts.includes(url.host.toLowerCase())) throw new Error('host not whitelisted')
    const hostname = url.hostname
    if (!['localhost', '127.0.0.1'].includes(hostname)) {
      const addrs = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true })
      for (const a of addrs) {
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.|fe80:|::1|fc|fd)/i.test(a.address))
          throw new Error('private address rejected')
      }
    }
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('no body')
        const chunks: Uint8Array[] = []
        let size = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_BODY) {
            void reader.cancel()
            throw new Error('body too large')
          }
          chunks.push(value)
        }
        return Buffer.concat(chunks).toString('utf8')
      } catch (e) {
        lastErr = e
      } finally {
        clearTimeout(t)
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  // ---------- терпимый парсер страницы чека ----------

  /** Селекция по семантике таблиц/меток, не по хрупким nth-child-путям. */
  parseCheckPage(html: string): ParsedReceipt {
    const $ = cheerio.load(html)
    const text = (el: unknown) => $(el as never).text().replace(/\s+/g, ' ').trim()
    const toUzs = (raw: string): number | null => {
      const cleaned = raw.replace(/[^\d.,]/g, '').replace(/\s/g, '')
      if (!cleaned) return null
      // «12 345,67» / «12345.67» — копейки/тийины отбрасываем в сумы
      const normalized = cleaned.replace(',', '.')
      const n = Number(normalized)
      if (!Number.isFinite(n)) return null
      return Math.round(n)
    }

    const items: ParsedReceipt['items'] = []
    // кандидаты-строки: любая таблица, где в строке есть текстовая ячейка +
    // количество (возможно дробное) + >=1 денежная ячейка
    $('tr').each((_i, tr) => {
      const cells = $(tr).find('td').toArray().map(text)
      if (cells.length < 3) return
      const name = cells[0] ?? ''
      if (!name || /итог|jami|всего|total|ндс|qqs|скидк|chegirma|наимен|товар/i.test(name)) return
      const nums = cells.slice(1).map((c) => ({ raw: c, n: toUzs(c) }))
      const qtyCell = nums.find((x) => x.n !== null && /^\d+([.,]\d{1,3})?$/.test(x.raw.replace(/\s/g, '')) && Number(x.raw.replace(',', '.')) <= 1000)
      const moneyCells = nums.filter((x) => x !== qtyCell && x.n !== null && x.n! > 0)
      if (!moneyCells.length) return
      const qty = qtyCell ? Number(qtyCell.raw.replace(/\s/g, '').replace(',', '.')) : 1
      const lineTotal = moneyCells[moneyCells.length - 1]!.n!
      const unitPrice = moneyCells.length > 1 ? moneyCells[0]!.n! : Math.round(lineTotal / (qty || 1))
      if (lineTotal <= 0 || !name) return
      items.push({ name: name.slice(0, 200), qtyMilli: Math.round(qty * 1000), unitPrice, lineTotal })
    })

    // итог: метки «Итого/Jami/Всего/Total» в любой строке/блоке
    let totalAmount = 0
    $('tr, div, p, b, strong, span').each((_i, el) => {
      const t = text(el)
      const m = t.match(/(?:итог[оа]?|jami|вс[её]го|total)[^\d]{0,20}([\d\s.,]{3,})/i)
      if (m) {
        const v = toUzs(m[1]!)
        if (v && v > totalAmount && $(el).children().length <= 4) totalAmount = v
      }
    })
    if (!totalAmount) totalAmount = items.reduce((s, i) => s + i.lineTotal, 0)

    // мерчант и ИНН
    const bodyText = $('body').text().replace(/\s+/g, ' ')
    const inn = bodyText.match(/(?:ИНН|INN|STIR)[:\s]*(\d{9})/i)?.[1]
    const merchantName =
      text($('h1,h2,.company,.merchant,.org-name').first()) ||
      bodyText.match(/(?:ООО|МЧЖ|OOO|MCHJ|ЯТТ|YATT)\s*[«"]?([^»"]{3,60})[»"]?/)?.[0]

    const dt = bodyText.match(/(\d{2})[./](\d{2})[./](20\d{2})[ ,]+(\d{2}):(\d{2})/)
    const datetime = dt ? new Date(`${dt[3]}-${dt[2]}-${dt[1]}T${dt[4]}:${dt[5]}:00`) : undefined

    return { merchantName: merchantName?.slice(0, 120), merchantInn: inn, datetime, totalAmount, items }
  }

  // ---------- статус / уведомления ----------

  /** Приём результата клиентского фетча. Сервер НЕ доверяет клиентской
   *  математике: пересчитывает суммы, валидирует хост/форму, и только потом
   *  сохраняет чек как обычный FiscalReceipt (дальше — штатный флоу). */
  async acceptClientResult(
    userId: string,
    input: {
      sourceUrl: string
      merchantName?: string
      merchantInn?: string
      datetime?: string
      totalAmount: number
      items: { name: string; qtyMilli: number; unitPrice: number; lineTotal: number }[]
    },
  ) {
    // 1) источник должен быть настоящей ссылкой чека с вайтлист-хоста
    const ref = this.tryParseFiscalUrl(input.sourceUrl)
    if (!ref) throw new BadRequestException('Некорректная ссылка чека')

    // 2) серверная валидация сумм (клиентские числа — только вход)
    if (!input.items.length) throw new BadRequestException('Чек без позиций')
    const itemsSum = input.items.reduce((s, i) => s + Math.max(0, Math.round(i.lineTotal)), 0)
    const total = Math.round(input.totalAmount)
    if (total <= 0) throw new BadRequestException('Некорректный итог чека')
    // допускаем округление дробных строк: ±1000 сум ИЛИ ±1 сум на позицию
    const tolerance = Math.max(1000, input.items.length)
    if (Math.abs(itemsSum - total) > tolerance)
      throw new BadRequestException(`Сумма позиций не сходится с итогом (${itemsSum} vs ${total})`)

    // 3) дедуп: тот же чек уже сохранён — отдаём его
    const existing = await this.prisma.fiscalReceipt.findUnique({ where: { fiscalKey: ref.fiscalKey } })
    if (existing && existing.status === 'ready') {
      await this.metric('client_fetch_dup')
      return this.jobStatus(userId, existing.id).then((s) => ({ jobId: existing.id, ...s }))
    }

    const datetime = input.datetime ? new Date(input.datetime) : ref.instant.datetime ? new Date(ref.instant.datetime) : undefined
    const data = {
      status: 'ready',
      source: 'client_fetch',
      merchantName: input.merchantName?.slice(0, 200),
      merchantInn: input.merchantInn?.slice(0, 40),
      receiptDatetime: datetime && !Number.isNaN(datetime.getTime()) ? datetime : undefined,
      totalAmount: total,
    }
    const row = existing
      ? await this.prisma.fiscalReceipt.update({ where: { id: existing.id }, data })
      : await this.prisma.fiscalReceipt.create({
          data: { userId, fiscalKey: ref.fiscalKey, url: ref.url.toString(), ...data },
        })
    await this.prisma.fiscalReceiptItem.deleteMany({ where: { receiptId: row.id } })
    await this.prisma.fiscalReceiptItem.createMany({
      data: input.items.map((i) => ({
        receiptId: row.id,
        name: String(i.name).slice(0, 200),
        qtyMilli: Math.max(1, Math.round(i.qtyMilli)),
        unitPrice: Math.max(0, Math.round(i.unitPrice)),
        lineTotal: Math.max(0, Math.round(i.lineTotal)),
      })),
    })
    await this.metric('client_fetch_ok')
    await this.metric('parse_ok')
    return this.jobStatus(userId, row.id).then((s) => ({ jobId: row.id, ...s }))
  }

  async jobStatus(userId: string, jobId: string) {
    const r = await this.prisma.fiscalReceipt.findUnique({ where: { id: jobId }, include: { items: true } })
    // готовый чек читается по jobId (cuid = capability): дедуп отдаёт один и
    // тот же чек разным сканировавшим — сам QR и есть право доступа
    if (!r || (r.userId !== userId && r.status !== 'ready')) throw new NotFoundException('Чек не найден')
    return {
      // fetch_blocked и failed_parse для UI одинаковы — «не удалось» (фото/ручной ввод)
      status: r.status === 'ready' ? 'ready' : r.status === 'failed_parse' || r.status === 'fetch_blocked' ? 'failed' : 'pending',
      receipt:
        r.status === 'ready'
          ? {
              merchant: r.merchantName,
              inn: r.merchantInn,
              datetime: r.receiptDatetime?.toISOString(),
              total: r.totalAmount,
              source: r.source,
              items: r.items.map((i) => ({ id: i.id, name: i.name, qty: i.qtyMilli / 1000, unitPrice: i.unitPrice, amount: i.lineTotal })),
            }
          : undefined,
    }
  }

  private notify(userId: string, jobId: string, status: 'ready' | 'failed') {
    this.realtime.emitUser(userId, status === 'ready' ? 'fiscal_ready' : 'fiscal_failed', { jobId })
  }

  // ---------- OCR-фолбэк (Gemini vision) ----------

  /** Фото чека → строгий JSON через Gemini. Изображение НЕ сохраняется после
   *  обработки (приватность): уходит в API и отбрасывается, в БД не пишется.
   *  Честные ошибки: если сумм/позиций нет — ошибка пользователю, НИКОГДА не 0. */
  async ocr(userId: string, image: Buffer, mime: string) {
    const hourAgo = new Date(Date.now() - 3600_000)
    const recent = await this.prisma.fiscalReceipt.count({
      where: { userId, source: 'gemini_ocr', createdAt: { gt: hourAgo } },
    })
    if (recent >= Number(process.env.OCR_HOURLY_LIMIT ?? 20)) throw new HttpException('Слишком часто — подождите пару секунд', 429)
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new HttpException('Распознавание фото не настроено', 503)
    await this.metric('ocr_used')
    await this.metric('gemini_ocr')

    const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'
    const prompt =
      'Это фискальный чек (Узбекистан, сумы UZS). Верни ТОЛЬКО JSON, без пояснений и markdown: ' +
      '{"merchant": string|null, "datetime": "ISO"|null, "total": number, ' +
      '"items": [{"name": string, "qty": number, "amount": number}], ' +
      '"currency": "UZS", "confidence": "high"|"medium"|"low"}. ' +
      'amount — итог строки в целых сумах, total — итог чека. Нечитаемое пропусти, ' +
      'НЕ выдумывай числа. Если чек не читается — верни total:0, items:[], confidence:"low".'

    let parsed: { merchant?: string | null; datetime?: string | null; total?: number; items?: { name: string; qty: number; amount: number }[]; confidence?: string }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: mime, data: image.toString('base64') } }, { text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 2048 },
          }),
        },
      )
      if (!res.ok) {
        this.log.warn(`gemini ocr HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
        throw new HttpException('Не удалось распознать фото — попробуйте ещё раз', 502)
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const textOut = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      const jsonStr = textOut.match(/\{[\s\S]*\}/)?.[0]
      if (!jsonStr) throw new BadRequestException('Не удалось распознать чек — попробуйте ещё раз или введите сумму вручную')
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      if (e instanceof HttpException) throw e
      throw new BadRequestException('Не удалось распознать чек — попробуйте ещё раз или введите сумму вручную')
    }

    const items = (parsed.items ?? []).filter((i) => i && Number(i.amount) > 0)
    const total = Math.round(Number(parsed.total) || 0)
    const itemsSum = items.reduce((s, i) => s + Math.round(Number(i.amount) || 0), 0)

    // 1) нет ни позиций, ни тотала → честная ошибка (никогда не показываем 0)
    if (!items.length && total <= 0)
      throw new BadRequestException('Не удалось распознать чек — попробуйте ещё раз или введите сумму вручную')

    // 2) позиции есть и сходятся с тоталом → полноценный чек (экран проверки)
    // 3) тотал есть, позиций нет (или не сходятся) → только сумма, без «Позиций»
    const itemsUsable = items.length > 0 && total > 0 && Math.abs(itemsSum - total) <= 1000
    const finalTotal = total > 0 ? total : itemsSum
    const storedItems = itemsUsable
      ? items.map((i) => ({
          name: String(i.name).slice(0, 200),
          qtyMilli: Math.round((Number(i.qty) || 1) * 1000),
          unitPrice: Math.round(Math.round(Number(i.amount)) / (Number(i.qty) || 1)),
          lineTotal: Math.round(Number(i.amount)),
        }))
      : []

    const row = await this.prisma.fiscalReceipt.create({
      data: {
        userId,
        fiscalKey: `ocr|${userId}|${Date.now().toString(36)}`,
        url: 'ocr://photo',
        status: 'ready',
        source: 'gemini_ocr',
        merchantName: parsed.merchant ?? undefined,
        receiptDatetime: parsed.datetime ? new Date(parsed.datetime) : undefined,
        totalAmount: finalTotal,
        items: { create: storedItems },
      },
    })
    return {
      jobId: row.id,
      confidence: parsed.confidence ?? 'low',
      itemsRecognized: itemsUsable, // false → фронт покажет «Позиции не распознаны», только сумма
      ...(await this.jobStatus(userId, row.id)),
    }
  }

  // ---------- метрики + алерт ----------

  private async metric(kind: string) {
    await this.prisma.fiscalEvent.create({ data: { kind } }).catch(() => undefined)
  }

  async healthStats() {
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const count = (kind: string) => this.prisma.fiscalEvent.count({ where: { kind, createdAt: { gt: dayAgo } } })
    const [ok, failed, blocked, resolved, ocr, clientOk, clientFail, gemini] = await Promise.all([
      count('parse_ok'),
      count('parse_failed'),
      count('fetch_blocked'),
      count('fiscal_resolved'),
      count('ocr_used'),
      count('client_fetch_ok'),
      count('client_fetch_failed'),
      count('gemini_ocr'),
    ])
    const attempts = ok + failed // fetch_blocked не входит в parse-rate (это инфраструктура, не парсер)
    const serverOk = Math.max(0, ok - clientOk) // parse_ok пишется и клиентским путём
    const clientAttempts = clientOk + clientFail
    return {
      fiscal_resolved: resolved,
      parse_ok: ok,
      parse_failed: failed,
      fetch_blocked: blocked,
      ocr_used: ocr,
      parseSuccessRate24h: attempts ? ok / attempts : null,
      // разбивка по источнику данных: клиент / сервер / OCR
      bySource: {
        mysoliq_client: { ok: clientOk, failed: clientFail, rate: clientAttempts ? clientOk / clientAttempts : null },
        server_fetch: { ok: serverOk, failed: failed, blocked },
        gemini_ocr: { used: gemini },
      },
    }
  }

  /** Трипваер «страница поменялась»: <50% успеха на последних 20 попытках. */
  private async maybeAlert(snapshotFile: string | null) {
    const hook = process.env.ALERT_WEBHOOK_URL
    if (!hook || Date.now() - this.lastAlertAt < 6 * 3600_000) return
    const last = await this.prisma.fiscalEvent.findMany({
      where: { kind: { in: ['parse_ok', 'parse_failed'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    const okCount = last.filter((e) => e.kind === 'parse_ok').length
    if (last.length < 5 || okCount / last.length >= 0.5) return
    this.lastAlertAt = Date.now()
    const text = `⚠️ ZAP fiscal parser: успех ${okCount}/${last.length} за последние попытки — похоже, страница ОФД изменилась. Снапшот: ${snapshotFile ?? '—'}`
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch((e) => this.log.warn(`alert webhook failed: ${String(e)}`))
  }
}

export { SNAP_DIR }
void existsSync
