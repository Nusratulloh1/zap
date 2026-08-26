import { Controller, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { CurrentUser, JwtAuthGuard, PaymentTokenGuard, type AuthUser } from '../common/auth.guard'
import { IdempotencyInterceptor } from '../common/idempotency.interceptor'
import { DebtsService } from './debts.service'

@Controller('debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.debts.list(user.id)
  }

  @Post(':id/remind')
  @HttpCode(200)
  remind(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.debts.remind(user.id, id)
  }

  @Post('remind-all')
  @HttpCode(200)
  remindAll(@CurrentUser() user: AuthUser) {
    return this.debts.remindAll(user.id)
  }

  /** кредитор помечает «вернул наличными» — денег не двигаем, PIN не нужен */
  @Post(':id/mark-returned')
  @HttpCode(200)
  markReturned(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.debts.settle(user.id, id)
  }

  @Post(':id/settle')
  @HttpCode(200)
  @UseGuards(PaymentTokenGuard)
  @UseInterceptors(IdempotencyInterceptor)
  settle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.debts.settle(user.id, id)
  }
}
