import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { RecapService } from './recap.service'

@Controller('recap')
@UseGuards(JwtAuthGuard)
export class RecapController {
  constructor(private readonly recap: RecapService) {}

  /** GET /recap?month=YYYY-MM — без параметра отдаёт прошедший месяц. */
  @Get()
  async monthly(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    const valid = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined
    return this.recap.forUser(user.id, valid)
  }
}
