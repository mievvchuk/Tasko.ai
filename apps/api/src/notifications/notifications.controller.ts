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
  Sse,
  UseGuards,
} from '@nestjs/common';
import { filter, interval, map, merge } from 'rxjs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PageDto } from '../projects/projects.dto.js';
import type { CurrentUser } from '../users/users.service.js';
import { messageTypes, NotificationsService } from './notifications.service.js';
import { notificationEvents } from './notification-events.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  // Подія «щось змінилось» лише для цього користувача; пінг раз на 25 с тримає з'єднання
  @Sse('stream') stream(@Actor() user: CurrentUser) {
    return merge(
      notificationEvents.pipe(
        filter((userId) => userId === user.id),
        map(() => ({ type: 'changed', data: '' })),
      ),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }
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
  // Користувач відкрив «Повідомлення» — сповіщення про листування вважаємо прочитаними
  @Post('read-messages') @HttpCode(200) readMessages(
    @Actor() user: CurrentUser,
  ) {
    return this.notifications.readAll(user.id, messageTypes);
  }
}
