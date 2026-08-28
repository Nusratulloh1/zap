import { Controller, Get } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { FiscalService } from '../fiscal/fiscal.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscal: FiscalService,
  ) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`
    return { ok: true, ts: Date.now(), fiscal: await this.fiscal.healthStats() }
  }
}
