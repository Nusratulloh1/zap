import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common'
import { IsString } from 'class-validator'
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard'
import { GroupsService } from './groups.service'

class RenameDto {
  @IsString()
  name!: string
}

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.groups.list(user.id)
  }

  @Patch(':id')
  @HttpCode(200)
  rename(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RenameDto) {
    return this.groups.rename(user.id, id, dto.name)
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.remove(user.id, id)
  }
}
