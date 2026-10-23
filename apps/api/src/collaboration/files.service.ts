import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type { PageDto } from '../projects/projects.dto.js';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
const maxFileSize = 10 * 1024 * 1024;

export function validateFile(file: UploadedFile) {
  const extension = extname(file.originalname).toLowerCase();
  const formats: Record<string, { mime: string; signature: number[] }> = {
    '.pdf': { mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
    '.png': {
      mime: 'image/png',
      signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    },
    '.jpg': { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
    '.jpeg': { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
    '.docx': {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      signature: [0x50, 0x4b, 0x03, 0x04],
    },
    '.zip': { mime: 'application/zip', signature: [0x50, 0x4b, 0x03, 0x04] },
    '.txt': { mime: 'text/plain', signature: [] },
  };
  const format = formats[extension];
  if (
    !format ||
    file.size === 0 ||
    file.size > maxFileSize ||
    file.size !== file.buffer.length
  )
    throw new BadRequestException(
      'Дозволено PDF, PNG, JPG, DOCX, ZIP, TXT розміром до 10 МБ.',
    );
  if (!format.signature.every((byte, index) => file.buffer[index] === byte))
    throw new BadRequestException('Вміст файлу не відповідає його типу.');
  if (extension === '.txt') {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException('Текстовий файл має бути у UTF-8.');
    }
  }
  return { extension, mime: format.mime };
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly directory = fileURLToPath(
    new URL('../../storage/', import.meta.url),
  );
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private get files() {
    return this.projects.prisma.client.orm.public.FileAttachment;
  }

  async list(user: CurrentUser, projectId: string, page: PageDto) {
    await this.projects.requireAccess(user, projectId);
    return this.files
      .where({ projectId })
      .select(
        'id',
        'fileName',
        'mimeType',
        'size',
        'uploadedBy',
        'uploadedAt',
        'submissionId',
      )
      .orderBy((file) => file.uploadedAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
  }
  async upload(
    user: CurrentUser,
    projectId: string,
    file: UploadedFile | undefined,
  ) {
    this.projects.ensureWritable(
      await this.projects.requireAccess(user, projectId),
    );
    if (!file) throw new BadRequestException('Додайте файл у поле file.');
    const { extension, mime } = validateFile(file);
    const storagePath = `${randomUUID()}${extension}`;
    const fileName = Array.from(
      basename(file.originalname.replaceAll('\\', '/')),
    )
      .filter(
        (character) =>
          character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127,
      )
      .join('')
      .slice(0, 200);
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, storagePath), file.buffer, {
      flag: 'wx',
    });
    try {
      return await this.files
        .select('id', 'fileName', 'mimeType', 'size', 'uploadedAt')
        .create({
          id: randomUUID(),
          projectId,
          uploadedBy: user.id,
          fileName,
          storagePath,
          mimeType: mime,
          size: file.size,
          uploadedAt: new Date(),
          submissionId: null,
        });
    } catch (error) {
      try {
        await unlink(join(this.directory, storagePath));
      } catch {
        this.logger.error('Не вдалося прибрати незбережений файл.');
      }
      throw error;
    }
  }
  async download(user: CurrentUser, id: string) {
    const file = await this.files.where({ id }).first();
    if (!file) throw new NotFoundException('Файл не знайдено.');
    await this.projects.requireAccess(user, file.projectId);
    if (!/^[a-f0-9-]{36}\.[a-z]+$/.test(file.storagePath))
      throw new NotFoundException('Файл недоступний.');
    const path = join(this.directory, file.storagePath);
    try {
      await stat(path);
    } catch {
      throw new NotFoundException('Файл відсутній у сховищі.');
    }
    return { path, name: file.fileName };
  }
}
