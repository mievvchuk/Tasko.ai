import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  Sse,
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
  maxArchiveSize,
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
  @Sse('projects/:id/messages/stream') messageStream(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.messageStream(user, id);
  }
  @Post('projects/:id/messages') message(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: MessageDto,
  ) {
    return this.collaboration.message(user, id, data);
  }
  @Delete('projects/:id/messages/:messageId') deleteMessage(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.collaboration.deleteMessage(user, id, messageId);
  }
  @Post('projects/:id/typing') @HttpCode(204) typing(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.typing(user, id);
  }
  @Get('applications/conversations') applicationConversations(
    @Actor() user: CurrentUser,
  ) {
    return this.collaboration.applicationConversations(user);
  }
  @Get('applications/:id/chat') applicationChat(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.applicationChatInfo(user, id);
  }
  @Get('applications/:id/messages') applicationMessages(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.collaboration.applicationMessages(user, id, page);
  }
  @Sse('applications/:id/messages/stream') applicationMessageStream(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.applicationMessageStream(user, id);
  }
  @Post('applications/:id/messages') applicationMessage(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: MessageDto,
  ) {
    return this.collaboration.applicationMessage(user, id, data);
  }
  @Delete('applications/:id/messages/:messageId') deleteApplicationMessage(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.collaboration.deleteApplicationMessage(user, id, messageId);
  }
  @Post('applications/:id/typing') @HttpCode(204) applicationTyping(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.applicationTyping(user, id);
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
      // Верхня межа для ZIP; решту типів обмежує validateFile (10 МБ)
      limits: { fileSize: maxArchiveSize, files: 1, fields: 0 },
    }),
  )
  upload(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
  ) {
    return this.files.upload(user, id, file);
  }
  @Delete('files/:id') deleteFile(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.files.remove(user, id);
  }
  @Get('files/:id/download')
  async download(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const file = await this.files.download(user, id);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.attachment(file.name);
    response.type(file.mime);
    response.send(file.content);
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
