import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsOptional, IsString, Length, Matches } from 'class-validator'
import { PartnersService } from './partners.service'

class PartnerLeadDto {
  @IsString()
  @Length(2, 160)
  company!: string

  @IsString()
  @Length(2, 120)
  contact!: string

  @IsString()
  @Matches(/^\+?\d[\d\s()-]{7,20}$/)
  phone!: string

  @IsOptional()
  @IsString()
  @Length(0, 80)
  city?: string

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  message?: string
}

/** Публичная ручка лендинга — авторизация не нужна. */
@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Post('lead')
  @HttpCode(200)
  @Throttle({ default: { ttl: 3600_000, limit: 10 } })
  lead(@Body() dto: PartnerLeadDto) {
    return this.partners.create(dto)
  }
}
