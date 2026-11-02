import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import type { CurrentUser } from '../users/users.service.js';
import { PageDto } from '../projects/projects.dto.js';
import { MessageDto, ReviewDto, SubmissionDto } from './collaboration.dto.js';
import { CollaborationService } from './collaboration.service.js';
import {
  FilesService,
  type UploadedFile as UploadedFileData,
} from './files.service.js';

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CollaborationController {
  constructor(
    @Inject(CollaborationService)
    private readonly collaboration: CollaborationService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}
  @Get('projects/:id/messages') messages(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.collaboration.messages(user, id, page);
  }
  @Post('projects/:id/messages') message(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: MessageDto,
  ) {
    return this.collaboration.message(user, id, data);
  }
  @Get('projects/:id/files') listFiles(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.files.list(user, id, page);
  }
  @Post('projects/:id/files')
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
      defParamCharset: 'utf8',
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  upload(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
  ) {
    return this.files.upload(user, id, file);
  }
  @Get('files/:id/download')
  async download(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const file = await this.files.download(user, id);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.download(file.path, file.name);
  }
  @Get('tasks/:id/submissions') submissions(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.collaboration.submissions(user, id, page);
  }
  @Post('tasks/:id/submissions') submit(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: SubmissionDto,
  ) {
    return this.collaboration.submit(user, id, data);
  }
  @Post('submissions/:id/review') review(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ReviewDto,
  ) {
    return this.collaboration.review(user, id, data);
  }
}
