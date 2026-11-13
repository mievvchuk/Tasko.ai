import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CollaborationService } from '../../../src/collaboration/collaboration.service.js';
import { FilesService } from '../../../src/collaboration/files.service.js';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { TasksService } from '../../../src/tasks/tasks.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';

const me = { id: 'me', role: 'FREELANCER' } as CurrentUser;

// Видаляти можна лише своє: повідомлення в чаті та файли, що ще не стали частиною здачі
describe('deleting own messages and files', () => {
  let deleted: string[];
  const row = (value: unknown) => ({
    first: async () => value,
    delete: async () => {
      deleted.push(JSON.stringify(value));
    },
  });

  beforeEach(() => {
    deleted = [];
  });

  it('deletes only the sender’s own project message', async () => {
    let message = { id: 'm1', projectId: 'p1', senderId: 'me' };
    const projects = {
      requireAccess: vi.fn(async () => ({ id: 'p1' })),
      prisma: {
        client: {
          orm: { public: { Message: { where: () => row(message) } } },
        },
      },
    };
    const service = new CollaborationService(
      projects as unknown as ProjectsService,
      {} as TasksService,
    );
    await expect(service.deleteMessage(me, 'p1', 'm1')).resolves.toEqual({
      deleted: true,
    });
    message = { ...message, senderId: 'someone-else' };
    await expect(service.deleteMessage(me, 'p1', 'm1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deleted).toHaveLength(1);
  });

  it('keeps files that are already part of a submission', async () => {
    let file = {
      id: 'f1',
      projectId: 'p1',
      uploadedBy: 'me',
      submissionId: null as string | null,
      storagePath: 'x.pdf',
    };
    const orm = {
      public: {
        FileAttachment: { where: () => row(file) },
        StoredFile: { where: () => row('stored') },
      },
    };
    const projects = {
      requireAccess: vi.fn(async () => ({ status: 'ACTIVE' })),
      ensureWritable: vi.fn(),
      prisma: {
        client: {
          orm,
          transaction: (run: (tx: { orm: typeof orm }) => unknown) =>
            run({ orm }),
        },
      },
    };
    const files = new FilesService(projects as unknown as ProjectsService);
    await expect(files.remove(me, 'f1')).resolves.toEqual({ deleted: true });
    expect(deleted).toHaveLength(2);
    file = { ...file, submissionId: 's1' };
    await expect(files.remove(me, 'f1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    file = { ...file, submissionId: null, uploadedBy: 'other' };
    await expect(files.remove(me, 'f1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
