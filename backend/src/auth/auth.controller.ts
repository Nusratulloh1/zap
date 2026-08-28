import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsString, Length, Matches } from 'class-validator'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { normalizePhone } from '../common/utils'

class PhoneDto {
  @IsString()
  phone!: string
}
class VerifyDto extends PhoneDto {
  @IsString()
  @Length(6, 6)
  code!: string
}
class PinDto {
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string
}
class ChangePinDto {
  @IsString()
  @Matches(/^\d{4}$/)
  oldPin!: string

  @IsString()
  @Matches(/^\d{4}$/)
  newPin!: string
}
class RefreshDto {
  @IsString()
  refreshToken!: string
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  // лимит по IP: за одним NAT сидит целый офис, 5/мин упиралось слишком быстро.
  // Основная защита — окно на телефон в AuthService.assertOtpAllowed
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async requestOtp(@Body() dto: PhoneDto) {
    const phone = normalizePhone(dto.phone)
    const res = await this.auth.requestOtp(phone, 'login')
    // ответ никогда не раскрывает, существует ли номер
    return { ok: true, ...res }
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async verifyOtp(@Body() dto: VerifyDto, @Req() req: Request) {
    const phone = normalizePhone(dto.phone)
    return this.auth.loginWithOtp(phone, dto.code, req.headers['user-agent'])
  }

  @Post('pin/set')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async setPin(@CurrentUser() user: AuthUser, @Body() dto: PinDto) {
    await this.auth.setPin(user.id, dto.pin)
    return { ok: true }
  }

  @Post('pin/verify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async verifyPin(@CurrentUser() user: AuthUser, @Body() dto: PinDto) {
    return this.auth.verifyPin(user.id, dto.pin)
  }

  @Post('pin/change')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePin(@CurrentUser() user: AuthUser, @Body() dto: ChangePinDto) {
    await this.auth.changePin(user.id, dto.oldPin, dto.newPin)
    return { ok: true }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken)
    return { ok: true }
  }
}
