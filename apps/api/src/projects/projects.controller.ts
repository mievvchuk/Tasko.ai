import {
  Body,
  Controller,
  Delete,
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
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { CurrentUser } from '../users/users.service.js';
import {
  AddMemberDto,
  CreateApplicationDto,
  CreateFreelancerReviewDto,
  CreateProjectDto,
  MarketplaceQueryDto,
  PageDto,
  ProjectQueryDto,
  UpdateProjectDto,
} from './projects.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  @Get('directory/freelancers') directory(
    @Actor() user: CurrentUser,
    @Query() page: PageDto,
  ) {
    return this.projects.directory(user, page);
  }
  @Get('projects') list(
    @Actor() user: CurrentUser,
    @Query() page: ProjectQueryDto,
  ) {
    return this.projects.list(user, page);
  }
  @Post('projects') create(
    @Actor() user: CurrentUser,
    @Body() data: CreateProjectDto,
  ) {
    return this.projects.create(user, data);
  }
  @Get('projects/:id') detail(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.detail(user, id);
  }
  @Patch('projects/:id') update(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateProjectDto,
  ) {
    return this.projects.update(user, id, data);
  }
  @Get('projects/:id/members') members(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.members(user, id);
  }
  @Post('projects/:id/members') addMember(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: AddMemberDto,
  ) {
    return this.projects.addMember(user, id, data.userId);
  }

  @Get('marketplace/projects')
  marketplace(@Actor() user: CurrentUser, @Query() page: MarketplaceQueryDto) {
    return this.projects.marketplace(user, page);
  }

  @Post('projects/:id/favorite')
  favorite(@Actor() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.favorite(user, id);
  }

  @Delete('projects/:id/favorite')
  unfavorite(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.unfavorite(user, id);
  }

  @Post('projects/:id/applications')
  apply(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CreateApplicationDto,
  ) {
    return this.projects.apply(user, id, data);
  }

  @Get('projects/:id/applications')
  applications(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.projects.applications(user, id, page);
  }

  @Post('applications/:id/accept')
  acceptApplication(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.acceptApplication(user, id);
  }

  @Get('freelancers/:id/profile')
  freelancerProfile(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.freelancerProfile(user, id);
  }

  @Post('projects/:id/reviews')
  createReview(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CreateFreelancerReviewDto,
  ) {
    return this.projects.createReview(user, id, data);
  }

  @Get('projects/:id/activity')
  activity(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.projects.activity(user, id, page);
  }
}
