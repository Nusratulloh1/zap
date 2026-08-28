// Шлюз send.smsxabar.uz (broker-api, Basic auth) — по контракту предоставленного
// SmsService, ужесточённый: креды ТОЛЬКО из env, таймаут + 1 ретрай,
// маппинг ошибок, журнал SmsLog, SMS_DRY_RUN=true — коды в лог вместо отправки.
//
// ── Запасной провайдер (если smsxabar продолжит блокироваться) ────────────
// Всё, что знает остальное приложение, — это `SmsService.send(phone, text,
// kind)`; вызовов ровно пять (auth, debts, splits ×2, partners). Поэтому
// второй провайдер добавляется без правок вызывающего кода:
//
//   1. вынести тело send() в интерфейс SmsTransport { send(phone, text):
//      Promise<void> } и сделать две реализации — SmsXabarTransport и,
//      например, EskizTransport (eskiz.uz: Bearer-токен, POST /api/message/
//      sms/send, поля mobile_phone/message/from);
//   2. SmsService оставить фасадом: журнал SmsLog, dry-run, локаль и выбор
//      транспорта. Порядок — из env SMS_PROVIDERS=smsxabar,eskiz;
//   3. переключаться на второй транспорт по isAccountError() — это ровно тот
//      класс ошибок, который повтором к тому же провайдеру не лечится
//      (сетевые сбои по-прежнему ретраить на первом).
//
// Разница между провайдерами — только в форме запроса и авторизации; формат
// номера (998XXXXXXXXX) и тексты из sms.i18n.ts переиспользуются как есть.
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { SmsKind } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../common/prisma.service'
import { maskPhone } from '../common/utils'
import { DEFAULT_SMS_LOCALE, isSmsLocale, resolveSmsLocale, type SmsLocale } from './sms.i18n'

const TIMEOUT_MS = 8000

/**
 * Коды ошибок шлюза, означающие СОСТОЯНИЕ АККАУНТА, а не наш запрос:
 * баланс, лимит, блокировка модератором. Отличать важно — на них бессмысленно
 * ретраить, и именно они требуют вмешательства в кабинете провайдера.
 *
 * 102 «Account lock» — наблюдался 27.08.2026 11:20–12:51 UTC: 12 OTP подряд
 * не ушли, до и после этого окна отправка работала теми же кредами.
 */
const ACCOUNT_ERROR_CODES = new Set([102])
/** 101 «Syntax error» и подобное — виноват наш payload, ретрай не поможет. */
const REQUEST_ERROR_CODES = new Set([101])

/** Чаще одного раза в полчаса про одну и ту же блокировку не пишем. */
const ALERT_COOLDOWN_MS = 30 * 60_000

export interface ProviderError {
  code: number | null
  description: string | null
}

/** Тело ошибки шлюза: {"error-code":102,"error-description":"Account lock"}. */
export function parseProviderError(body: string): ProviderError {
  try {
    const j = JSON.parse(body) as Record<string, unknown>
    const code = j['error-code']
    const desc = j['error-description']
    return {
      code: typeof code === 'number' ? code : null,
      description: typeof desc === 'string' ? desc : null,
    }
  } catch {
    return { code: null, description: null }
  }
}

export function isAccountError(e: ProviderError): boolean {
  return e.code !== null && ACCOUNT_ERROR_CODES.has(e.code)
}

export function isRequestError(e: ProviderError): boolean {
  return e.code !== null && REQUEST_ERROR_CODES.has(e.code)
}

@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name)
  /** dev: последние dry-run SMS по номеру (в памяти, только для /dev/sms/latest) */
  private readonly devBuffer = new Map<string, { phone: string; text: string; at: number }>()
  private lastAlertAt = 0

  devLatest(phone: string) {
    return this.devBuffer.get(phone) ?? null
  }

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Язык сообщения = язык ПОЛУЧАТЕЛЯ. Ищем его профиль по номеру; если
   * получателя ещё нет в базе (первый OTP, участник по SMS-ссылке) —
   * берём язык инициатора, а в последнюю очередь uz.
   */
  async localeFor(phone: string, actorLocale?: string | null): Promise<SmsLocale> {
    if (!/^998\d{9}$/.test(phone)) return resolveSmsLocale(actorLocale)
    const user = await this.prisma.user
      .findUnique({ where: { phone }, select: { locale: true } })
      .catch(() => null)
    return resolveSmsLocale(user?.locale, actorLocale)
  }

  /** Локаль без обращения к базе — когда профиль получателя уже загружен. */
  localeOf(...candidates: (string | null | undefined)[]): SmsLocale {
    return resolveSmsLocale(...candidates)
  }

  /**
   * Значения из .env всегда через trim: systemd отдаёт EnvironmentFile как
   * есть, и один CRLF в файле (был в SMS_SERVICE_URL) превращается в часть
   * значения — URL ещё переживает, а пароль в Basic-заголовке уже нет.
   */
  private env(name: string): string | undefined {
    const v = process.env[name]
    return v === undefined ? undefined : v.trim()
  }

  private get dryRun(): boolean {
    return (this.env('SMS_DRY_RUN') ?? 'true') !== 'false'
  }

  private get baseUrl(): string {
    return (this.env('SMS_SERVICE_URL') || 'https://send.smsxabar.uz').replace(/\/+$/, '')
  }

  private get originator(): string {
    return this.env('SMS_ORIGINATOR') || '3700'
  }

  private get authHeader(): string {
    const user = this.env('SMS_SERVICE_USERNAME')
    const pass = this.env('SMS_SERVICE_PASSWORD')
    if (!user || !pass) throw new ServiceUnavailableException('SMS-шлюз не сконфигурирован')
    return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
  }

  /**
   * Блокировка аккаунта чинится только в кабинете провайдера, поэтому про неё
   * нужно узнавать сразу, а не от пользователей. Шлём в тот же вебхук, что и
   * фискальные алерты, не чаще раза в полчаса.
   */
  private async alertAccountLocked(e: ProviderError) {
    const hook = this.env('ALERT_WEBHOOK_URL')
    if (!hook || Date.now() - this.lastAlertAt < ALERT_COOLDOWN_MS) return
    this.lastAlertAt = Date.now()
    const stats = await this.healthStats().catch(() => null)
    const text =
      `🚨 ZAP SMS: шлюз отклоняет отправку — «${e.description ?? 'неизвестно'}» (код ${e.code ?? '—'}).\n` +
      `Регистрация по OTP не работает. Чинится в кабинете smsxabar (баланс/лимит/блокировка).\n` +
      `За сутки: отправлено ${stats?.sent24h ?? '?'}, отказов ${stats?.failed24h ?? '?'}.`
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch((err) => this.log.warn(`alert webhook failed: ${String(err)}`))
  }

  /**
   * Сводка для /health: видно и долю отказов, и последнюю ошибку провайдера.
   * `accountLocked` — единственный флаг, по которому дежурный понимает, что
   * проблема не в коде, а в кабинете провайдера.
   */
  async healthStats() {
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const [sent24h, failed24h, dryRun24h, lastFailed, lastSent] = await Promise.all([
      this.prisma.smsLog.count({ where: { status: 'sent', createdAt: { gt: dayAgo } } }),
      this.prisma.smsLog.count({ where: { status: 'failed', createdAt: { gt: dayAgo } } }),
      this.prisma.smsLog.count({ where: { status: 'dry_run', createdAt: { gt: dayAgo } } }),
      this.prisma.smsLog.findFirst({ where: { status: 'failed' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.smsLog.findFirst({ where: { status: 'sent' }, orderBy: { createdAt: 'desc' } }),
    ])
    const attempts = sent24h + failed24h
    const lastProviderError = lastFailed?.error ? parseProviderError(lastFailed.error.replace(/^HTTP \d+: /, '')) : null
    return {
      dryRun: this.dryRun,
      sent24h,
      failed24h,
      dryRun24h,
      failureRate24h: attempts ? failed24h / attempts : null,
      lastSentAt: lastSent?.createdAt ?? null,
      lastFailedAt: lastFailed?.createdAt ?? null,
      lastError: lastFailed?.error?.slice(0, 200) ?? null,
      // блокировка «свежая», если последний отказ новее последней удачи
      accountLocked:
        !!lastProviderError &&
        isAccountError(lastProviderError) &&
        (!lastSent || (lastFailed?.createdAt ?? 0) > lastSent.createdAt),
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      return await fetch(url, { ...init, signal: ctrl.signal })
    } finally {
      clearTimeout(t)
    }
  }

  /** Единая точка отправки. Наружу детали провайдера не утекают. */
  async send(phone: string, text: string, kind: SmsKind): Promise<void> {
    if (!/^998\d{9}$/.test(phone)) {
      await this.prisma.smsLog.create({ data: { phone, kind, status: 'failed', error: 'invalid phone format' } })
      throw new ServiceUnavailableException('Неверный формат номера')
    }

    if (this.dryRun) {
      // заметный блок в консоли — локальный логин идёт через эти коды
      // eslint-disable-next-line no-console
      console.log('\n┏━━ SMS DRY-RUN ━━\n┃ [SMS→' + phone + '] ' + text + '\n┗━━━━━━━━━━━━━━━━\n')
      this.devBuffer.set(phone, { phone, text, at: Date.now() })
      await this.prisma.smsLog.create({ data: { phone, kind, status: 'dry_run' } })
      return
    }

    const messageId = `zap-${randomUUID().slice(0, 18)}`
    const payload = {
      messages: [
        {
          recipient: phone,
          'message-id': messageId,
          sms: {
            originator: this.originator,
            content: { text },
          },
        },
      ],
    }

    let lastErr = ''
    let provider: ProviderError = { code: null, description: null }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.fetchWithTimeout(`${this.baseUrl}/broker-api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
          body: JSON.stringify(payload),
        })
        const bodyText = await res.text().catch(() => '')
        if (!res.ok) {
          provider = parseProviderError(bodyText)
          throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
        }
        await this.prisma.smsLog.create({
          data: { phone, kind, status: 'sent', providerMessageId: messageId },
        })
        return
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        this.log.warn(`SMS attempt ${attempt + 1} failed → ${maskPhone(phone)}: ${lastErr}`)
        // блокировка аккаунта и кривой payload за 300 мс не рассосутся —
        // второй заход только удваивает задержку перед ошибкой у пользователя
        if (isAccountError(provider) || isRequestError(provider)) break
      }
    }
    await this.prisma.smsLog.create({ data: { phone, kind, status: 'failed', error: lastErr.slice(0, 500) } })
    if (isAccountError(provider)) {
      this.log.error(
        `SMS-шлюз отклоняет отправку: аккаунт заблокирован у провайдера ` +
          `(${provider.code} ${provider.description}). Нужен кабинет smsxabar.`,
      )
      void this.alertAccountLocked(provider)
    }
    // code — чтобы клиент показал перевод на своём языке, а не эту строку
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'sms_unavailable',
      message: 'SMS временно недоступны',
    })
  }
}
