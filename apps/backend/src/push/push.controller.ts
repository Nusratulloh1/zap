import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common'
import { IsIn, IsOptional, IsString, Length } from 'class-validator'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { PushService } from './push.service'

class RegisterPushDto {
  @IsString()
  @Length(10, 512)
  token!: string

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios'

  @IsOptional()
  @IsString()
  locale?: string
}

class UnregisterPushDto {
  @IsString()
  @Length(10, 512)
  token!: string
}

/** Регистрация устройства для пушей. */
@Controller('users/me/push-token')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushDto) {
    await this.push.register(user.id, dto.token, dto.platform, dto.locale)
    return { ok: true, enabled: this.push.enabled }
  }

  /** Выход из аккаунта / отключение уведомлений. */
  @Delete()
  async unregister(@Body() dto: UnregisterPushDto) {
    await this.push.unregister(dto.token)
    return { ok: true }
  }
}
