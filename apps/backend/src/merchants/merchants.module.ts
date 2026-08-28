import { Module } from '@nestjs/common'
import { MerchantsService } from './merchants.service'
import { MerchantsController } from './merchants.controller'
import { FiscalModule } from '../fiscal/fiscal.module'

@Module({ imports: [FiscalModule], controllers: [MerchantsController], providers: [MerchantsService], exports: [MerchantsService] })
export class MerchantsModule {}
