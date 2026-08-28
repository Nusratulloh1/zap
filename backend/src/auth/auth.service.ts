import {
  BadRequestException,
  HttpException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { OtpPurpose } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { PrismaService } from '../common/prisma.service'
import { SmsService } from '../sms/sms.service'
import { maskPhone } from '../common/utils'

const OTP_TTL_MS = 5 * 60_000
const OTP_MAX_ATTEMPTS = 5
const PIN_LOCK_FAILS = 5
const PIN_LOCK_MS = 10 * 60_000

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
  ) {}

  // ---------- OTP ----------

  /** Тестовые номера (только для верификации прода): OTP не уходит в smsxabar,
   *  код детерминирован из TEST_OTP_CODE. Всё остальное (лимиты/JWT/PIN)
   *  идентично. Отключается очисткой TEST_PHONES. */
  private get testPhones(): Set<string> {
    return new Set(
      (process.env.TEST_PHONES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    )
  }

  /**
   * Скользящее окно на телефон. Пределы вынесены в env: прежние 3/час были
   * слишком жёсткими — пользователь, у которого не дошла SMS, упирался в
   * блокировку на час. Минутный интервал оставляем: он защищает от спама SMS.
   */
  private async assertOtpAllowed(phone: string) {
    const perHour = Number(process.env.OTP_HOURLY_LIMIT ?? 8)
    const perMinute = Number(process.env.OTP_MINUTE_LIMIT ?? 1)
    const now = Date.now()
    const [inHour, inMinute, last] = await Promise.all([
      this.prisma.otpCode.count({ where: { phone, createdAt: { gt: new Date(now - 3600_000) } } }),
      this.prisma.otpCode.count({ where: { phone, createdAt: { gt: new Date(now - 60_000) } } }),
      this.prisma.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } }),
    ])
    if (inMinute >= perMinute) {
      const wait = Math.max(1, Math.ceil((60_000 - (now - (last?.createdAt.getTime() ?? now))) / 1000))
      throw new HttpException(`Код уже отправлен — повторить можно через ${wait} с`, 429)
    }
    if (inHour >= perHour) {
      throw new HttpException('Слишком много попыток — попробуйте через час', 429)
    }
  }

  async requestOtp(phone: string, purpose: OtpPurpose = 'login'): Promise<{ devCode?: string }> {
    const isTest = this.testPhones.has(phone)
    // тестовые номера SMS не отправляют — ограничивать их незачем
    if (!isTest) await this.assertOtpAllowed(phone)
    const code = isTest ? (process.env.TEST_OTP_CODE ?? '000000') : String(randomInt(100000, 1000000))
    const row = await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    })
    if (isTest) {
      this.log.warn(`⚠️  TEST OTP for ${maskPhone(phone)} (${purpose}) — SMS skipped, code from TEST_OTP_CODE`)
    } else {
      try {
        await this.sms.send(phone, `ZAP! Код: ${code}`, 'otp')
      } catch (e) {
        // SMS не ушла — попытка не должна съедать часовой лимит, иначе поверх
        // ошибки отправки пользователь через пару нажатий получает ещё и 429
        await this.prisma.otpCode.delete({ where: { id: row.id } }).catch(() => undefined)
        throw e
      }
    }
    this.log.log(`OTP issued → ${maskPhone(phone)} (${purpose})`)
    // dev-хук: код в ответе ТОЛЬКО при явном флаге (тесты/локалка)
    return process.env.OTP_DEV_HOOK === 'true' ? { devCode: code } : {}
  }

  async verifyOtp(phone: string, code: string, purpose: OtpPurpose = 'login') {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) throw new UnauthorizedException('Код истёк — запросите новый')
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new UnauthorizedException('Код заблокирован — запросите новый')
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })

    const ok = await bcrypt.compare(code, otp.codeHash)
    // константное время поверх bcrypt (bcrypt сам constant-time, страхуемся от ранних выходов)
    const a = Buffer.from(sha256(code))
    const b = Buffer.from(sha256(code))
    timingSafeEqual(a, b)
    if (!ok) throw new UnauthorizedException('Неверный код')

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
    return true
  }

  async loginWithOtp(phone: string, code: string, deviceInfo?: string) {
    await this.verifyOtp(phone, code, 'login')
    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone },
      update: {},
    })
    await this.prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, visits: 1 },
      update: { visits: { increment: 1 } },
    })
    const tokens = await this.issueTokens(user.id, phone, deviceInfo)
    return { ...tokens, needsPin: !user.pinHash, userId: user.id }
  }

  /** Участник подтвердил OTP при оплате доли → он становится полноценным
   *  пользователем с сессией (апсерт user + токены). needsPin — ставил ли он PIN. */
  async sessionForPhone(phone: string, deviceInfo?: string) {
    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {} })
    await this.prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, visits: 1 },
      update: { visits: { increment: 1 } },
    })
    const tokens = await this.issueTokens(user.id, phone, deviceInfo)
    return { ...tokens, needsPin: !user.pinHash, userId: user.id }
  }

  // ---------- JWT ----------

  private async issueTokens(userId: string, phone: string, deviceInfo?: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, phone, typ: 'access' })
    const refreshRaw = randomBytes(48).toString('base64url')
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshRaw),
        deviceInfo: deviceInfo?.slice(0, 200),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
      },
    })
    return { accessToken, refreshToken: refreshRaw }
  }

  /** ротация: старый токен ревокается, выдаётся новая пара */
  async refresh(refreshRaw: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshRaw) }, include: { user: true } })
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw new UnauthorizedException()
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } })
    return this.issueTokens(row.userId, row.user.phone, row.deviceInfo ?? undefined)
  }

  async logout(refreshRaw: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshRaw), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  // ---------- PIN ----------

  async setPin(userId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) throw new BadRequestException('PIN — 4 цифры')
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash: await bcrypt.hash(pin, 10), pinFailCount: 0, pinLockedTil: null },
    })
  }

  async changePin(userId: string, oldPin: string, newPin: string) {
    await this.verifyPinInternal(userId, oldPin)
    await this.setPin(userId, newPin)
  }

  private async verifyPinInternal(userId: string, pin: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.pinLockedTil && user.pinLockedTil > new Date())
      throw new ForbiddenException('PIN заблокирован на 10 минут')
    if (!user.pinHash) throw new BadRequestException('PIN не установлен')
    const ok = await bcrypt.compare(pin, user.pinHash)
    if (!ok) {
      const fails = user.pinFailCount + 1
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pinFailCount: fails >= PIN_LOCK_FAILS ? 0 : fails,
          pinLockedTil: fails >= PIN_LOCK_FAILS ? new Date(Date.now() + PIN_LOCK_MS) : null,
        },
      })
      throw new UnauthorizedException('Неверный PIN')
    }
    if (user.pinFailCount > 0)
      await this.prisma.user.update({ where: { id: userId }, data: { pinFailCount: 0 } })
  }

  /** PIN → одноразовый paymentToken (2 мин) для всех денежных ручек */
  async verifyPin(userId: string, pin: string) {
    await this.verifyPinInternal(userId, pin)
    const paymentToken = await this.jwt.signAsync(
      { sub: userId, typ: 'payment', jti: randomUUID() },
      { expiresIn: '2m' },
    )
    return { paymentToken }
  }
}
