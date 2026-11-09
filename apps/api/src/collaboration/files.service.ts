import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

// Вміст файлу з БД; файли, збережені до переходу на БД, ще читаємо з диска (локальна розробка)
export async function readStoredFile(
  db: {
    StoredFile: {
      where: (filter: { id: string }) => {
        first: () => PromiseLike<{ content: Uint8Array } | null>;
      };
    };
  },
  key: string,
  legacyPath: string,
) {
  const stored = await db.StoredFile.where({ id: key }).first();
  if (stored) return Buffer.from(stored.content);
  try {
    return await readFile(legacyPath);
  } catch {
    return null;
  }
}

@Injectable()
export class FilesService {
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
      await this.projects.requireAccess(user, projectId, false),
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
    // Вміст і запис про файл — в одній транзакції: або обидва, або нічого
    return this.projects.prisma.client.transaction(async (tx) => {
      await tx.orm.public.StoredFile.create({
        id: storagePath,
        content: file.buffer,
        createdAt: new Date(),
      });
      return tx.orm.public.FileAttachment.select(
        'id',
        'fileName',
        'mimeType',
        'size',
        'uploadedAt',
      ).create({
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
    });
  }
  async download(user: CurrentUser, id: string) {
    const file = await this.files.where({ id }).first();
    if (!file) throw new NotFoundException('Файл не знайдено.');
    await this.projects.requireAccess(user, file.projectId);
    if (!/^[a-f0-9-]{36}\.[a-z]+$/.test(file.storagePath))
      throw new NotFoundException('Файл недоступний.');
    const content = await readStoredFile(
      this.projects.prisma.client.orm.public,
      file.storagePath,
      join(this.directory, file.storagePath),
    );
    if (!content) throw new NotFoundException('Файл відсутній у сховищі.');
    return { content, name: file.fileName, mime: file.mimeType };
  }
}
