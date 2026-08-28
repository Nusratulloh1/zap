// Язык SMS выбирается по получателю: его locale → locale инициатора → uz.
// Тест закрывает и выбор языка, и то, что в текст попадает шаблон именно этого
// языка (а не просто «какой-нибудь перевод»).
import { SmsService } from '../src/sms/sms.service'
import {
  DEFAULT_SMS_LOCALE,
  FRIEND_FALLBACK,
  isSmsLocale,
  resolveSmsLocale,
  smsAmount,
  smsText,
} from '../src/sms/sms.i18n'

describe('resolveSmsLocale — приоритет получателя', () => {
  it('берёт первую валидную локаль из списка', () => {
    expect(resolveSmsLocale('ru', 'en')).toBe('ru')
    expect(resolveSmsLocale(null, 'en')).toBe('en')
    expect(resolveSmsLocale(undefined, undefined, 'uz')).toBe('uz')
  })

  it('мусор и неизвестные языки игнорирует', () => {
    expect(resolveSmsLocale('de', 'ru')).toBe('ru')
    expect(resolveSmsLocale('', '  ', 'en')).toBe('en')
  })

  it('без кандидатов — узбекский (основной рынок)', () => {
    expect(resolveSmsLocale()).toBe('uz')
    expect(resolveSmsLocale(null, undefined)).toBe(DEFAULT_SMS_LOCALE)
    expect(DEFAULT_SMS_LOCALE).toBe('uz')
  })

  it('isSmsLocale отсекает всё, кроме uz/ru/en', () => {
    expect(isSmsLocale('uz')).toBe(true)
    expect(isSmsLocale('RU')).toBe(false)
    expect(isSmsLocale(42)).toBe(false)
  })
})

describe('smsText — шаблон соответствует языку', () => {
  it('OTP: код в тексте на своём языке', () => {
    expect(smsText('otp', 'uz', { code: '123456' })).toBe('ZAP! Kod: 123456')
    expect(smsText('otp', 'ru', { code: '123456' })).toBe('ZAP! Код: 123456')
    expect(smsText('otp', 'en', { code: '123456' })).toBe('ZAP! Code: 123456')
  })

  it('ссылка на сплит: подставляются имя, название и URL', () => {
    const p = { name: 'Ali', title: 'Ужин', url: 'https://zapapp.uz/s/AB12' }
    expect(smsText('splitLink', 'uz', p)).toBe('ZAP! Ali «Ужин» uchun ulushingizni so‘rayapti: https://zapapp.uz/s/AB12')
    expect(smsText('splitLink', 'ru', p)).toBe('ZAP! Ali просит вашу долю в «Ужин»: https://zapapp.uz/s/AB12')
    expect(smsText('splitLink', 'en', p)).toBe('ZAP! Ali is asking for your share of “Ужин”: https://zapapp.uz/s/AB12')
  })

  it('в шаблонах не остаётся неподставленных плейсхолдеров', () => {
    const text = smsText('debtReminder', 'uz', { name: 'Ali', amount: '50 000', reason: 'kofe' })
    expect(text).not.toMatch(/\{\w+\}/)
  })

  it('нет пересечения языков: русский шаблон не приходит узбеку', () => {
    expect(smsText('splitReminder', 'uz', { title: 'T', url: 'U' })).not.toContain('Напоминание')
    expect(smsText('splitReminder', 'en', { title: 'T', url: 'U' })).not.toContain('Напоминание')
  })

  it('запасное имя отправителя — на языке получателя', () => {
    expect(FRIEND_FALLBACK.uz).toBe('Do‘stingiz')
    expect(FRIEND_FALLBACK.ru).toBe('Друг')
    expect(FRIEND_FALLBACK.en).toBe('A friend')
  })

  it('разряды суммы: пробел для uz/ru, запятая для en', () => {
    expect(smsAmount(120000, 'uz').replace(/ /g, ' ')).toBe('120 000')
    expect(smsAmount(120000, 'ru').replace(/ /g, ' ')).toBe('120 000')
    expect(smsAmount(120000, 'en')).toBe('120,000')
  })
})

describe('SmsService.localeFor — язык получателя важнее языка отправителя', () => {
  function service(profileLocale: string | null | undefined) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(profileLocale === undefined ? null : { locale: profileLocale }),
      },
    }
    return new SmsService(prisma as never)
  }

  it('профиль получателя перебивает язык инициатора', async () => {
    await expect(service('en').localeFor('998901234567', 'ru')).resolves.toBe('en')
  })

  it('получателя нет в базе — язык инициатора', async () => {
    await expect(service(undefined).localeFor('998901234567', 'ru')).resolves.toBe('ru')
  })

  it('ни того ни другого — узбекский', async () => {
    await expect(service(undefined).localeFor('998901234567', null)).resolves.toBe('uz')
  })

  it('битый номер не ходит в базу', async () => {
    const prisma = { user: { findUnique: jest.fn() } }
    const sms = new SmsService(prisma as never)
    await expect(sms.localeFor('12345', 'en')).resolves.toBe('en')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('сбой базы не ломает отправку — остаётся язык инициатора', async () => {
    const prisma = { user: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) } }
    const sms = new SmsService(prisma as never)
    await expect(sms.localeFor('998901234567', 'ru')).resolves.toBe('ru')
  })
})
