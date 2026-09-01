import { Global, Module } from '@nestjs/common'
import { PushController } from './push.controller'
import { PushService } from './push.service'

/**
 * Глобальный, потому что пуши отправляются из разных доменов (сплиты, долги,
 * кэшбек), и тащить импорт в каждый модуль ради одного вызова — лишний шум.
 */
@Global()
@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
