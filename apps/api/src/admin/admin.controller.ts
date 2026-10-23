import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { CurrentUser } from '../users/users.service.js';
import {
  ReportExportQueryDto,
  UpdateUserDto,
  UserQueryDto,
} from './admin.dto.js';
import { AdminService } from './admin.service.js';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}
  @Get('users') users(
    @Actor() user: CurrentUser,
    @Query() filters: UserQueryDto,
  ) {
    return this.admin.list(user, filters);
  }
  @Patch('users/:id') update(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserDto,
  ) {
    return this.admin.update(user, id, data);
  }
  @Get('report') report(@Actor() user: CurrentUser) {
    return this.admin.report(user);
  }
  @Get('report/export')
  async exportReport(
    @Actor() user: CurrentUser,
    @Query() query: ReportExportQueryDto,
    @Res() response: Response,
  ) {
    const file = await this.admin.exportReport(user, query.format);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    response.send(file.content);
  }
}
