// Заявки партнёров с лендинга: приём, антиспам и просмотр для админа.
import { HttpException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { SmsService } from '../sms/sms.service'
import { normalizePhone } from '../common/utils'
import { resolveSmsLocale, smsText } from '../sms/sms.i18n'

export interface PartnerLeadInput {
  company: string
  contact: string
  phone: string
  city?: string
  message?: string
}

@Injectable()
export class PartnersService {
  private readonly log = new Logger(PartnersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async create(input: PartnerLeadInput) {
    const phone = normalizePhone(input.phone)
    // антиспам: не больше 3 заявок с одного номера в сутки
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const recent = await this.prisma.partnerLead.count({ where: { phone, createdAt: { gt: dayAgo } } })
    if (recent >= 3) throw new HttpException('Заявка уже отправлена — мы свяжемся с вами', 429)

    const lead = await this.prisma.partnerLead.create({
      data: {
        company: input.company.trim().slice(0, 160),
        contact: input.contact.trim().slice(0, 120),
        phone,
        city: input.city?.trim().slice(0, 80) || undefined,
        message: input.message?.trim().slice(0, 1000) || undefined,
      },
    })
    this.log.log(`partner lead: ${lead.company} (${lead.id})`)
    void this.notify(lead.company, lead.contact, phone, lead.city ?? undefined)
    void this.notifySms(lead.company, lead.contact, phone, lead.city ?? undefined)
    return { ok: true, id: lead.id }
  }

  /**
   * SMS менеджеру о новой заявке. Номер получателя — PARTNER_LEAD_SMS_TO
   * (несколько номеров через запятую). Ошибка отправки не роняет заявку:
   * она уже сохранена в базе.
   */
  private async notifySms(company: string, contact: string, phone: string, city?: string) {
    const raw = process.env.PARTNER_LEAD_SMS_TO
    if (!raw) return
    // менеджерская SMS — язык фиксируется в PARTNER_LEAD_SMS_LOCALE (по умолчанию ru)
    const lang = resolveSmsLocale(process.env.PARTNER_LEAD_SMS_LOCALE, 'ru')
    const text = smsText('partnerLead', lang, {
      company,
      contact,
      phone,
      city: city ? `, ${city}` : '',
    })
    // normalizePhone бросает на мусоре — кривой номер в env не должен ломать приём заявки
    const recipients: string[] = []
    for (const v of raw.split(',')) {
      try {
        recipients.push(normalizePhone(v.trim()))
      } catch {
        this.log.warn(`PARTNER_LEAD_SMS_TO: пропущен неверный номер «${v.trim()}»`)
      }
    }
    for (const to of recipients) {
      await this.sms.send(to, text, 'partner_lead').catch((e: unknown) => {
        this.log.warn(`partner lead sms failed: ${e instanceof Error ? e.message : String(e)}`)
      })
    }
  }

  /** Уведомление в тот же вебхук, что и алерты (если настроен). */
  private async notify(company: string, contact: string, phone: string, city?: string) {
    const hook = process.env.ALERT_WEBHOOK_URL
    if (!hook) return
    const text = `🤝 Заявка партнёра ZAP!\n${company}\n${contact} · +${phone}${city ? `\n${city}` : ''}`
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => undefined)
  }
}
