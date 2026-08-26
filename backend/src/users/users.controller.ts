import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator'
import { CardBrand } from '@prisma/client'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { UsersService } from './users.service'

class AddContactDto {
  @IsString()
  phone!: string

  @IsOptional()
  @IsString()
  name?: string
}

class AddCardDto {
  @IsEnum(CardBrand)
  brand!: CardBrand

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  last4!: string
}

class ProfileDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  handle?: string
}

class SettingsDto {
  @IsOptional()
  @IsBoolean()
  debtNotifications?: boolean

  @IsOptional()
  @IsBoolean()
  promoDismissed?: boolean
}

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** единая проекция всех данных пользователя (форма мок-интерфейса фронта) */
  @Get('bootstrap')
  bootstrap(@CurrentUser() user: AuthUser) {
    return this.users.bootstrap(user.id)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id)
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.users.updateProfile(user.id, dto)
  }

  @Post('contacts')
  addContact(@CurrentUser() user: AuthUser, @Body() dto: AddContactDto) {
    return this.users.addContact(user.id, dto.phone, dto.name)
  }

  @Post('cards')
  addCard(@CurrentUser() user: AuthUser, @Body() dto: AddCardDto) {
    return this.users.addCard(user.id, dto.brand, dto.last4)
  }

  @Post('cards/:id/primary')
  @HttpCode(200)
  setPrimary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.setPrimaryCard(user.id, id)
  }

  @Patch('settings')
  settings(@CurrentUser() user: AuthUser, @Body() dto: SettingsDto) {
    return this.users.updateSettings(user.id, dto)
  }
}
