import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Throttle } from '@nestjs/throttler'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { FiscalService } from './fiscal.service'

class ClientItemDto {
  @IsString()
  @MaxLength(200)
  name!: string

  /** количество ×1000 (0.500 кг → 500) */
  @IsInt()
  @Min(1)
  qtyMilli!: number

  @IsInt()
  @Min(0)
  unitPrice!: number

  @IsInt()
  @Min(0)
  lineTotal!: number
}

class ClientResultDto {
  /** исходный URL чека (из QR) — для дедупа и аудита */
  @IsString()
  @MaxLength(500)
  sourceUrl!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  merchantName?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  merchantInn?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  datetime?: string

  @IsInt()
  @Min(1)
  totalAmount!: number

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ClientItemDto)
  items!: ClientItemDto[]
}

@Controller('qr/fiscal')
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Get(':jobId')
  status(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.fiscal.jobStatus(user.id, jobId)
  }

  /** Результат КЛИЕНТСКОГО фетча чека (телефон пользователя в UZ не заблокирован
   *  соликом, наш сервер — заблокирован). Клиентской математике не доверяем:
   *  сервер сам пересчитывает суммы и валидирует форму. */
  @Post('client-result')
  @HttpCode(200)
  @Throttle({ default: { ttl: 3600_000, limit: 20 } })
  clientResult(@CurrentUser() user: AuthUser, @Body() dto: ClientResultDto) {
    return this.fiscal.acceptClientResult(user.id, dto)
  }

  /** OCR-фолбэк: фото чека. Изображение не сохраняется после обработки.
   *  Лимит — из env (MVP: 20/час), чтобы тестирование не упиралось в 429. */
  @Post('ocr')
  @Throttle({ default: { ttl: 3600_000, limit: Number(process.env.OCR_HOURLY_LIMIT ?? 20) } })
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024 } }))
  ocr(@CurrentUser() user: AuthUser, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file?.buffer?.length) throw new HttpException('Нет изображения', 400)
    if (!/^image\/(jpeg|png|webp|heic)/.test(file.mimetype)) throw new HttpException('Неподдерживаемый формат', 400)
    return this.fiscal.ocr(user.id, file.buffer, file.mimetype === 'image/heic' ? 'image/jpeg' : file.mimetype)
  }
}
