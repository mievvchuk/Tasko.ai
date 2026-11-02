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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Actor } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { UploadedFile as UploadedFileData } from '../collaboration/files.service.js';
import { maxAvatarSize } from './avatar.js';
import {
  CreatePortfolioItemDto,
  UpdateAccountDto,
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

  @Patch('profile/account')
  updateAccount(@Actor() user: CurrentUser, @Body() data: UpdateAccountDto) {
    return this.users.updateAccount(user, data);
  }

  @Post('profile/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: maxAvatarSize, files: 1, fields: 0 },
    }),
  )
  uploadAvatar(
    @Actor() user: CurrentUser,
    @UploadedFile() file: UploadedFileData | undefined,
  ) {
    return this.users.setAvatar(user, file);
  }

  @Delete('profile/avatar')
  removeAvatar(@Actor() user: CurrentUser) {
    return this.users.removeAvatar(user);
  }

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

// Фото профілю віддаємо без токена: тег <img> не може надіслати заголовок
// Authorization. Ім'я файлу — випадковий UUID, тож його не вгадати.
@ApiTags('Profiles')
@Controller('avatars')
export class AvatarsController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get(':file')
  async avatar(@Param('file') fileName: string, @Res() response: Response) {
    const file = await this.users.avatarFile(fileName);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // Нове фото — нове ім'я файлу, тож старе можна кешувати надовго
    response.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    response.sendFile(file.path);
  }
}
