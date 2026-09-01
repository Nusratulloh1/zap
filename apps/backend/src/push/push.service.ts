import { Injectable, Logger } from '@nestjs/common'
import { createSign } from 'node:crypto'
import { PrismaService } from '../common/prisma.service'
import { resolveSmsLocale, type SmsLocale } from '../sms/sms.i18n'

/**
 * Пуши через FCM HTTP v1.
 *
 * Почему не firebase-admin: SDK тянет большой граф зависимостей ради одного
 * POST-запроса. Здесь ровно то, что нужно, — подпись JWT сервис-аккаунтом,
 * обмен на access_token и отправка. Ключ живёт в переменной окружения и в
 * репозиторий не попадает.
 *
 * Ничего не настроено (нет FCM_SERVICE_ACCOUNT) — сервис молча выключен:
 * домены продолжают работать, просто без пушей. Пуш не должен ронять оплату.
 *
 * iOS работает через тот же FCM: APNs-ключ загружается в консоль Firebase,
 * приложение получает FCM-токен. Отдельной интеграции с APNs здесь нет.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name)

  constructor(private readonly prisma: PrismaService) {}

  private token: { value: string; expiresAt: number } | null = null

  private get account(): { client_email: string; private_key: string; project_id: string } | null {
    const raw = process.env.FCM_SERVICE_ACCOUNT
    if (!raw) return null
    try {
      const j = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string }
      if (!j.client_email || !j.private_key || !j.project_id) return null
      return j
    } catch {
      this.log.warn('FCM_SERVICE_ACCOUNT не разбирается как JSON — пуши выключены')
      return null
    }
  }

  get enabled(): boolean {
    return this.account !== null
  }

  /** Регистрация токена устройства. Повторный вызов обновляет lastSeenAt. */
  async register(userId: string, token: string, platform: string, locale?: string): Promise<void> {
    const loc = resolveSmsLocale(locale, 'uz')
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform, locale: loc },
      update: { userId, platform, locale: loc, lastSeenAt: new Date(), disabledAt: null },
    })
  }

  async unregister(token: string): Promise<void> {
    await this.prisma.pushToken.updateMany({ where: { token }, data: { disabledAt: new Date() } })
  }

  /** OAuth2-токен для FCM; живёт час, держим в памяти. */
  private async accessToken(): Promise<string | null> {
    const acc = this.account
    if (!acc) return null
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const claim = {
      iss: acc.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const unsigned = `${b64(header)}.${b64(claim)}`
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    const jwt = `${unsigned}.${signer.sign(acc.private_key.replace(/\\n/g, '\n'), 'base64url')}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    })
    if (!res.ok) {
      this.log.warn(`FCM oauth ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return null
    }
    const j = (await res.json()) as { access_token: string; expires_in: number }
    this.token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
    return j.access_token
  }

  /**
   * Отправить пуш пользователю на все его живые устройства.
   *
   * text выбирается по локали ТОКЕНА, а не отправителя: уведомление читает
   * получатель, и оно должно быть на его языке.
   */
  async send(
    userId: string,
    build: (locale: SmsLocale) => { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<void> {
    const acc = this.account
    if (!acc) return

    const tokens = await this.prisma.pushToken.findMany({ where: { userId, disabledAt: null } })
    if (!tokens.length) return

    const auth = await this.accessToken()
    if (!auth) return

    const url = `https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`

    await Promise.all(
      tokens.map(async (t) => {
        const { title, body } = build(resolveSmsLocale(t.locale, 'uz'))
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'HIGH', notification: { channel_id: 'zap_default' } },
                apns: { payload: { aps: { sound: 'default' } } },
              },
            }),
          })
          if (res.status === 404 || res.status === 403) {
            // токен мёртв (переустановка, отзыв) — гасим, чтобы не долбить FCM
            await this.unregister(t.token)
            return
          }
          if (!res.ok) this.log.warn(`FCM ${res.status}: ${(await res.text()).slice(0, 160)}`)
        } catch (e) {
          this.log.warn(`FCM send failed: ${String(e)}`)
        }
      }),
    )
  }
}
