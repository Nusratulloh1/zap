import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator'
import { SplitMode } from '@prisma/client'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser, JwtAuthGuard, PaymentTokenGuard, type AuthUser } from '../common/auth.guard'
import { IdempotencyInterceptor } from '../common/idempotency.interceptor'
import { SplitsService } from './splits.service'
import { GroupsService } from '../groups/groups.service'
import { AuthService } from '../auth/auth.service'
import { normalizePhone } from '../common/utils'

class MemberDto {
  @IsString()
  phone!: string

  @IsString()
  name!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  shareAmount?: number

  @IsOptional()
  @IsBoolean()
  inDebt?: boolean

  @IsOptional()
  @IsArray()
  itemIds?: string[]
}

class CreateSplitDto {
  @IsOptional()
  @IsString()
  billId?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  totalAmount?: number

  @IsString()
  title!: string

  @IsEnum(SplitMode)
  mode!: SplitMode

  @IsOptional()
  @IsString()
  merchantId?: string

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members!: MemberDto[]
}

class CoverDto {
  @IsOptional()
  @IsArray()
  memberIds?: string[]
}

class RenameDto {
  @IsString()
  @Length(1, 80)
  title!: string
}

class ReactDto {
  @IsString()
  memberId!: string

  /** одно из REACTION_EMOJI — валидируется в сервисе */
  @IsString()
  @Length(1, 8)
  emoji!: string
}

class SaveGroupDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsArray()
  memberIds?: string[]

  @IsOptional()
  @IsBoolean()
  accrueCashback?: boolean
}

class PublicOpenDto {
  @IsString()
  phone!: string
}

class PublicPayDto {
  @IsString()
  phone!: string

  @IsInt()
  @Min(1)
  amount!: number

  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string
}

@Controller('splits')
@UseGuards(JwtAuthGuard)
export class SplitsController {
  constructor(
    private readonly splits: SplitsService,
    private readonly groups: GroupsService,
  ) {}

  @Post()
  @UseGuards(PaymentTokenGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateSplitDto) {
    return this.splits.create(user.id, dto)
  }

  @Get(':id')
  async byId(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.splits.byIdOrThrow(id, user.id)
  }

  @Post(':id/cover')
  @HttpCode(200)
  @UseGuards(PaymentTokenGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async cover(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CoverDto) {
    return this.splits.cover(id, user.id, dto.memberIds)
  }

  @Post(':id/remind/:memberId')
  @HttpCode(200)
  async remind(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.splits.remindMember(id, user.id, memberId)
  }


  /** Своё название счёта: «🍕 Boys Dinner» вместо мерчанта (vision §14). */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async rename(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RenameDto) {
    return this.splits.rename(id, user.id, dto.title)
  }

  /** Реакция на оплату участника: ⚡ 😂 ❤️ 🫡 🤝 (повторный тап снимает). */
  @Post(':id/reactions')
  @UseGuards(JwtAuthGuard)
  async react(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.splits.react(user.id, id, dto.memberId, dto.emoji)
  }

  /**
   * Photo Moment (vision §C15): «Add a photo 📸» после закрытия счёта.
   * Лимит меньше, чем у OCR: это снимок компании, а не чек под распознавание.
   */
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    return this.splits.attachPhoto(user.id, id, file)
  }

  @Post(':id/send-link')
  @HttpCode(200)
  async sendLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.splits.sendLink(id, user.id)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.splits.cancel(id, user.id)
  }

  @Post(':id/save-group')
  @HttpCode(200)
  async saveGroup(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveGroupDto) {
    return this.groups.saveFromSplit(user.id, id, dto.name, dto.memberIds, dto.accrueCashback ?? true)
  }
}

/** Публичные ручки участника: /s/:code (view/open/pay c OTP-lite) */
@Controller('s')
export class PublicSplitController {
  constructor(
    private readonly splits: SplitsService,
    private readonly auth: AuthService,
  ) {}

  @Get(':code')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async view(@Param('code') code: string, @Query('phone') phone?: string) {
    return this.splits.publicByCode(code, phone || undefined)
  }

  @Post(':code/open')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async open(@Param('code') code: string, @Body() dto: PublicOpenDto) {
    return this.splits.markOpened(code, dto.phone)
  }

  /** без code — шлём OTP (participant_pay) и ждём повторный вызов с кодом */
  @Post(':code/pay')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async pay(@Param('code') splitCode: string, @Body() dto: PublicPayDto) {
    const phone = normalizePhone(dto.phone)
    if (!dto.code) {
      // участника в базе может ещё не быть — тогда SMS уйдёт на языке организатора
      const res = await this.auth.requestOtp(phone, 'participant_pay', await this.splits.creatorLocale(splitCode))
      return { otpRequired: true, ...res }
    }
    await this.auth.verifyOtp(phone, dto.code, 'participant_pay')
    // OTP подтверждён → участник становится залогиненным пользователем (user + сессия),
    // ПЕРЕД оплатой: чтобы payPublic нашёл payer'а и записал списание + историю.
    const auth = await this.auth.sessionForPhone(phone)
    const view = await this.splits.payPublic(splitCode, phone, dto.amount)
    return { ...view, auth }
  }
}
