// Шлюз send.smsxabar.uz (broker-api, Basic auth) — по контракту предоставленного
// SmsService, ужесточённый: креды ТОЛЬКО из env, таймаут + 1 ретрай,
// маппинг ошибок, журнал SmsLog, SMS_DRY_RUN=true — коды в лог вместо отправки.
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { SmsKind } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../common/prisma.service'
import { maskPhone } from '../common/utils'

const TIMEOUT_MS = 8000

@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name)
  /** dev: последние dry-run SMS по номеру (в памяти, только для /dev/sms/latest) */
  private readonly devBuffer = new Map<string, { phone: string; text: string; at: number }>()

  devLatest(phone: string) {
    return this.devBuffer.get(phone) ?? null
  }

  constructor(private readonly prisma: PrismaService) {}

  private get dryRun(): boolean {
    return (process.env.SMS_DRY_RUN ?? 'true') !== 'false'
  }

  private get baseUrl(): string {
    return (process.env.SMS_SERVICE_URL ?? 'https://send.smsxabar.uz').replace(/\/$/, '')
  }

  private get authHeader(): string {
    const user = process.env.SMS_SERVICE_USERNAME
    const pass = process.env.SMS_SERVICE_PASSWORD
    if (!user || !pass) throw new ServiceUnavailableException('SMS-шлюз не сконфигурирован')
    return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
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
            originator: process.env.SMS_ORIGINATOR ?? '3700',
            content: { text },
          },
        },
      ],
    }

    let lastErr = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.fetchWithTimeout(`${this.baseUrl}/broker-api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
          body: JSON.stringify(payload),
        })
        const bodyText = await res.text().catch(() => '')
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
        await this.prisma.smsLog.create({
          data: { phone, kind, status: 'sent', providerMessageId: messageId },
        })
        return
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        this.log.warn(`SMS attempt ${attempt + 1} failed → ${maskPhone(phone)}: ${lastErr}`)
      }
    }
    await this.prisma.smsLog.create({ data: { phone, kind, status: 'failed', error: lastErr.slice(0, 500) } })
    throw new ServiceUnavailableException('SMS временно недоступны')
  }
}
