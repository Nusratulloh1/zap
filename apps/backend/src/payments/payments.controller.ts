import { Body, Controller, HttpCode, Inject, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'
import { CurrentUser, JwtAuthGuard, PaymentTokenGuard, type AuthUser } from '../common/auth.guard'
import { IdempotencyInterceptor } from '../common/idempotency.interceptor'
import { HistoryService } from '../history/history.service'
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment.provider'

class PayDto {
  @IsInt()
  @Min(1)
  amount!: number

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  merchantId?: string
}

/** «Оплатить целиком» без сплита (payAlone фронта). */
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly history: HistoryService,
  ) {}

  @Post('pay')
  @HttpCode(200)
  @UseGuards(PaymentTokenGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async pay(@CurrentUser() user: AuthUser, @Body() dto: PayDto) {
    const res = await this.payments.charge(user.id, dto.amount, `pay:${Date.now().toString(36)}`)
    await this.history.record(null, user.id, 'payment', {
      amountSigned: -dto.amount,
      meta: { title: dto.title ?? 'Оплата', titleKey: dto.title ? undefined : 'entry.payment', subtitle: 'Оплата целиком', subtitleKey: 'entry.paidWhole', merchantId: dto.merchantId },
    })
    /*
      Возвращаем номер транзакции: экран чека после оплаты показывает его
      («ZAP-8F2K-481») — без него чек пришлось бы выдумывать на клиенте.
    */
    return { ok: true, txId: res.txId ?? null }
  }
}
