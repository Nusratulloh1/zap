import { Module } from '@nestjs/common'
import { SplitsService } from './splits.service'
import { PublicSplitController, SplitsController } from './splits.controller'
import { GroupsModule } from '../groups/groups.module'
import { HistoryModule } from '../history/history.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [GroupsModule, HistoryModule, AuthModule],
  controllers: [SplitsController, PublicSplitController],
  providers: [SplitsService],
  exports: [SplitsService],
})
export class SplitsModule {}
