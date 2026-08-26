// Dev-only ручки (NODE_ENV !== 'production'): последние dry-run SMS —
// чтобы проходить auth-флоу локально без чтения логов.
import { Controller, ForbiddenException, Get, Query } from '@nestjs/common'
import { SmsService } from '../sms/sms.service'
import { normalizePhone } from '../common/utils'

function assertDev() {
  if (process.env.NODE_ENV === 'production') throw new ForbiddenException()
}

@Controller('dev')
export class DevController {
  constructor(private readonly sms: SmsService) {}

  /** Последняя dry-run SMS на номер: { phone, text, code, at } | null */
  @Get('sms/latest')
  latest(@Query('phone') phone = '') {
    assertDev()
    const entry = this.sms.devLatest(normalizePhone(phone))
    if (!entry) return { found: false }
    return { found: true, ...entry, code: entry.text.match(/\d{6}/)?.[0] ?? null }
  }
}
