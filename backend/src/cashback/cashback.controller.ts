import { Body, Controller, Get, HttpCode, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { IsInt, IsString, Min } from 'class-validator'
import { CurrentUser, JwtAuthGuard, PaymentTokenGuard, type AuthUser } from '../common/auth.guard'
import { IdempotencyInterceptor } from '../common/idempotency.interceptor'
import { CashbackService } from './cashback.service'
import { clampLimit } from '../common/utils'

class WithdrawDto {
  @IsString()
  cardId!: string

  @IsInt()
  @Min(1000)
  amount!: number
}

@Controller('cashback')
@UseGuards(JwtAuthGuard)
export class CashbackController {
  constructor(private readonly cashback: CashbackService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query('cursor') cursor?: string, @Query('limit') limit?: number) {
    return this.cashback.overview(user.id, cursor, clampLimit(limit))
  }

  @Post('spend')
  @HttpCode(200)
  spend(@CurrentUser() user: AuthUser) {
    return this.cashback.spendOnNext(user.id)
  }

  @Post('withdraw')
  @HttpCode(200)
  @UseGuards(PaymentTokenGuard)
  @UseInterceptors(IdempotencyInterceptor)
  withdraw(@CurrentUser() user: AuthUser, @Body() dto: WithdrawDto) {
    return this.cashback.withdraw(user.id, dto.cardId, dto.amount)
  }
}
