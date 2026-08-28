import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { CommonModule } from './common/common.module'
import { SmsModule } from './sms/sms.module'
import { AuthModule } from './auth/auth.module'
import { PartnersModule } from './partners/partners.module'
import { UsersModule } from './users/users.module'
import { MerchantsModule } from './merchants/merchants.module'
import { PaymentsModule } from './payments/payments.module'
import { SplitsModule } from './splits/splits.module'
import { GroupsModule } from './groups/groups.module'
import { DebtsModule } from './debts/debts.module'
import { CashbackModule } from './cashback/cashback.module'
import { HistoryModule } from './history/history.module'
import { RealtimeModule } from './realtime/realtime.module'
import { HealthController } from './common/health.controller'
import { DevModule } from './dev/dev.module'
import { FiscalModule } from './fiscal/fiscal.module'

/** маскирование PII в логах: телефоны никогда не пишутся целиком */
const redactPhone = (v: unknown) =>
  typeof v === 'string' ? v.replace(/998\d{6}(\d{3})/g, '998******$1') : v

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: { paths: ['req.headers.authorization', 'req.body.phone', 'req.body.code', 'req.body.pin'], censor: '[masked]' },
        autoLogging: process.env.NODE_ENV !== 'test',
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    CommonModule,
    SmsModule,
    AuthModule,
    UsersModule,
    MerchantsModule,
    PaymentsModule,
    SplitsModule,
    GroupsModule,
    DebtsModule,
    CashbackModule,
    HistoryModule,
    RealtimeModule,
    FiscalModule,
    // dev-ручки не попадают в прод-граф
    PartnersModule,
    ...(process.env.NODE_ENV !== 'production' ? [DevModule] : []),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
