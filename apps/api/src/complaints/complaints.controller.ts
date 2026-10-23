import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PageDto } from '../projects/projects.dto.js';
import type { CurrentUser } from '../users/users.service.js';
import { CreateComplaintDto, DecideComplaintDto } from './complaints.dto.js';
import { ComplaintsService } from './complaints.service.js';

class ComplaintQueryDto extends PageDto {
  @IsOptional() @IsIn(['OPEN', 'RESOLVED', 'REJECTED']) status?: string;
}

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ComplaintsController {
  constructor(
    @Inject(ComplaintsService) private readonly complaints: ComplaintsService,
  ) {}
  @Get('complaints') own(@Actor() user: CurrentUser, @Query() page: PageDto) {
    return this.complaints.own(user, page.page, page.limit);
  }
  @Post('complaints') create(
    @Actor() user: CurrentUser,
    @Body() data: CreateComplaintDto,
  ) {
    return this.complaints.create(user, data);
  }
  @Get('admin/complaints') all(
    @Actor() user: CurrentUser,
    @Query() query: ComplaintQueryDto,
  ) {
    return this.complaints.all(user, query.page, query.limit, query.status);
  }
  @Patch('admin/complaints/:id') decide(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: DecideComplaintDto,
  ) {
    return this.complaints.decide(user, id, data);
  }
}
