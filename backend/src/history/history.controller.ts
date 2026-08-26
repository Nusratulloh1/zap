import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { HistoryService } from './history.service'
import { clampLimit } from '../common/utils'

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('cursor') cursor?: string, @Query('limit') limit?: number) {
    return this.history.list(user.id, cursor, clampLimit(limit))
  }
}
