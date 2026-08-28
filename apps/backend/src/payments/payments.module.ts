import { Global, Module } from '@nestjs/common'
import { PAYMENT_PROVIDER } from './payment.provider'
import { InternalWalletProvider } from './internal-wallet.provider'
import { PaymentsController } from './payments.controller'
import { HistoryModule } from '../history/history.module'

@Global()
@Module({
  imports: [HistoryModule],
  controllers: [PaymentsController],
  providers: [{ provide: PAYMENT_PROVIDER, useClass: InternalWalletProvider }],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
