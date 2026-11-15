import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DataChangeInterceptor } from './data-change.interceptor.js';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: APP_INTERCEPTOR, useClass: DataChangeInterceptor },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
