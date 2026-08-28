import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from '../common/auth.guard'
import { MerchantsService } from './merchants.service'

class BillItemDto {
  @IsString()
  title!: string

  @IsInt()
  @Min(1)
  qty!: number

  @IsInt()
  @Min(1)
  amount!: number
}

class CreateBillDto {
  @IsString()
  externalRef!: string

  @IsOptional()
  @IsString()
  tableRef?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  items!: BillItemDto[]
}

class CreateMerchantDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  letter?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  cashbackRate?: number

  @IsOptional()
  @IsBoolean()
  cashbackX2?: boolean
}

/** admin-only по ADMIN_KEY (онбординг демо-партнёров) */
function assertAdmin(key?: string) {
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) throw new ForbiddenException()
}

@Controller()
export class MerchantsController {
  constructor(
    private readonly merchants: MerchantsService,
    private readonly jwt: JwtService,
  ) {}

  @Get('merchants')
  @UseGuards(JwtAuthGuard)
  list() {
    return this.merchants.list()
  }

  @Post('merchants')
  createMerchant(@Body() dto: CreateMerchantDto, @Headers('x-admin-key') key?: string) {
    assertAdmin(key)
    return this.merchants.create(dto)
  }

  @Post('merchants/:id/bills')
  createBill(@Param('id') id: string, @Body() dto: CreateBillDto, @Headers('x-admin-key') key?: string) {
    assertAdmin(key)
    return this.merchants.createBill(id, dto)
  }

  @Get('bills/featured')
  @UseGuards(JwtAuthGuard)
  featured() {
    return this.merchants.featuredBill()
  }

  @Get('qr/resolve')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async resolve(@Query('payload') payload = '', @Headers('authorization') auth?: string) {
    // авторизация опциональна: фискальная джоба стартует только для юзера
    let userId: string | undefined
    const token = (auth ?? '').replace(/^Bearer /, '')
    if (token) {
      try {
        const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token)
        if (p.typ === 'access') userId = p.sub
      } catch {
        /* публичный вызов */
      }
    }
    return this.merchants.resolveQr(payload, userId)
  }
}
