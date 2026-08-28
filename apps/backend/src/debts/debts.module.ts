import { Module } from '@nestjs/common'
import { DebtsService } from './debts.service'
import { DebtsController } from './debts.controller'
import { HistoryModule } from '../history/history.module'

@Module({ imports: [HistoryModule], controllers: [DebtsController], providers: [DebtsService], exports: [DebtsService] })
export class DebtsModule {}
