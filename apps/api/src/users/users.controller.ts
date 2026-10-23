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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CreatePortfolioItemDto,
  UpdateFreelancerProfileDto,
  UpdatePortfolioItemDto,
} from './users.dto.js';
import { UsersService, type CurrentUser } from './users.service.js';

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get('profile/freelancer')
  profile(@Actor() user: CurrentUser) {
    return this.users.getFreelancerProfile(user);
  }

  @Patch('profile/freelancer')
  updateProfile(
    @Actor() user: CurrentUser,
    @Body() data: UpdateFreelancerProfileDto,
  ) {
    return this.users.updateFreelancerProfile(user, data);
  }

  @Get('profile/portfolio')
  portfolio(@Actor() user: CurrentUser) {
    return this.users.listPortfolio(user);
  }

  @Post('profile/portfolio')
  createPortfolio(
    @Actor() user: CurrentUser,
    @Body() data: CreatePortfolioItemDto,
  ) {
    return this.users.createPortfolioItem(user, data);
  }

  @Patch('profile/portfolio/:id')
  updatePortfolio(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdatePortfolioItemDto,
  ) {
    return this.users.updatePortfolioItem(user, id, data);
  }

  @Delete('profile/portfolio/:id')
  deletePortfolio(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.deletePortfolioItem(user, id);
  }

  @Get('skills') skills() {
    return this.users.listSkills();
  }

  @Get('project-categories') categories() {
    return this.users.listCategories();
  }
}
