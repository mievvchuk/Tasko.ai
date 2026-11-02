import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { CurrentUser } from '../users/users.service.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}
  @Get('analytics/dashboard') dashboard(@Actor() user: CurrentUser) {
    return this.analytics.dashboard(user);
  }
  @Get('analytics/deadlines') deadlines(@Actor() user: CurrentUser) {
    return this.analytics.deadlines(user);
  }
  @Get('analytics/workload') workload(@Actor() user: CurrentUser) {
    return this.analytics.workload(user);
  }
  @Get('projects/:id/summary') summary(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analytics.summary(user, id);
  }
}
