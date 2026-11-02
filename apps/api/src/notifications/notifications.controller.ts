import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PageDto } from '../projects/projects.dto.js';
import type { CurrentUser } from '../users/users.service.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  @Get() list(@Actor() user: CurrentUser, @Query() page: PageDto) {
    return this.notifications.list(user.id, page.page, page.limit);
  }
  @Patch(':id/read') read(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.read(user.id, id);
  }
  @Post('read-all') @HttpCode(200) readAll(@Actor() user: CurrentUser) {
    return this.notifications.readAll(user.id);
  }
}
