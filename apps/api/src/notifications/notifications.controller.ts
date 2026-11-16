import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { concatMap, filter, interval, map, merge } from 'rxjs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PageDto } from '../projects/projects.dto.js';
import type { CurrentUser } from '../users/users.service.js';
import { NotificationsService } from './notifications.service.js';
import { notificationEvents } from './notification-events.js';
import { dataEvents } from './data-events.js';
import { IsOptional, IsUUID } from 'class-validator';

class ReadChatDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() applicationId?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  // «changed» — нове сповіщення саме для цього користувача; «data» — дані на платформі змінились
  // (сторінки тихо перечитують їх); пінг раз на 25 с тримає з'єднання
  @Sse('stream') stream(@Actor() user: CurrentUser) {
    return merge(
      notificationEvents.pipe(
        filter((userId) => userId === user.id),
        map(() => ({ type: 'changed', data: '' })),
      ),
      // Подію проєкту отримують лише ті, хто має до нього доступ
      dataEvents.pipe(
        concatMap(async (projectId) =>
          !projectId || (await this.notifications.canSeeProject(user, projectId)) ? { type: 'data', data: projectId ?? '' } : null,
        ),
        filter((event) => event !== null),
      ),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }
  @Get() list(@Actor() user: CurrentUser, @Query() page: PageDto) {
    return this.notifications.list(user.id, page.page, page.limit);
  }
  @Patch(':id/read') read(@Actor() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.read(user.id, id);
  }
  @Post('read-all') @HttpCode(200) readAll(@Actor() user: CurrentUser) {
    return this.notifications.readAll(user.id);
  }
  // Користувач відкрив «Повідомлення» — сповіщення про листування вважаємо прочитаними
  @Get('unread-chats') unreadChats(@Actor() user: CurrentUser) {
    return this.notifications.unreadChats(user.id);
  }
  // Тіло { projectId } або { applicationId } — прочитано лише цю розмову
  @Post('read-messages') @HttpCode(200) readMessages(@Actor() user: CurrentUser, @Body() chat: ReadChatDto) {
    return this.notifications.readChat(user.id, chat ?? {});
  }
}
