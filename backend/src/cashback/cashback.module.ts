import { Module } from '@nestjs/common'
import { CashbackService } from './cashback.service'
import { CashbackController } from './cashback.controller'
import { HistoryModule } from '../history/history.module'

@Module({ imports: [HistoryModule], controllers: [CashbackController], providers: [CashbackService], exports: [CashbackService] })
export class CashbackModule {}
