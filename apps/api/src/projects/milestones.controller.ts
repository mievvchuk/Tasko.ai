import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { CurrentUser } from '../users/users.service.js';
import { CreateMilestoneDto, UpdateMilestoneDto } from './milestones.dto.js';
import { MilestonesService } from './milestones.service.js';

@ApiTags('Milestones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MilestonesController {
  constructor(
    @Inject(MilestonesService) private readonly milestones: MilestonesService,
  ) {}
  @Get('projects/:id/milestones') list(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.milestones.list(user, id);
  }
  @Post('projects/:id/milestones') create(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CreateMilestoneDto,
  ) {
    return this.milestones.create(user, id, data);
  }
  @Patch('milestones/:id') update(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateMilestoneDto,
  ) {
    return this.milestones.update(user, id, data);
  }
}
