import { Controller, Get } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { FiscalService } from '../fiscal/fiscal.service'
import { SmsService } from '../sms/sms.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscal: FiscalService,
    private readonly sms: SmsService,
  ) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`
    const [fiscal, sms] = await Promise.all([this.fiscal.healthStats(), this.sms.healthStats()])
    // ok=false, когда шлюз в блокировке: регистрация по OTP в этот момент не
    // работает, и мониторинг должен это видеть, а не только «база жива»
    return { ok: !sms.accountLocked, ts: Date.now(), fiscal, sms }
  }
}
