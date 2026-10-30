import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import { TasksService } from './tasks.service.js';

describe('kanban board columns', () => {
  const freelancer: CurrentUser = {
    id: 'freelancer-id',
    name: 'Freelancer',
    email: 'freelancer@example.com',
    role: 'FREELANCER',
    sessionId: 'session-id',
    twoFactorEnabled: false,
  };
  const task = {
    id: 'task-id',
    projectId: 'project-id',
    assigneeId: freelancer.id,
    title: 'Макет',
    status: 'TODO',
  };
  const update = vi.fn(async (data: object) => ({ ...task, ...data }));
  let columns: { id: string; projectId: string; position: number }[] = [];
  const db = {
    Task: { where: vi.fn(() => ({ first: async () => task, update })) },
    BoardColumn: {
      where: vi.fn(({ id }: { id?: string }) => ({
        first: async () => columns.find((column) => column.id === id),
        orderBy: () => ({ all: async () => columns }),
      })),
      create: vi.fn(async (data: object) => data),
    },
  };
  const projects = {
    prisma: { client: { orm: { public: db } } },
    requireAccess: vi.fn(async () => ({ status: 'ACTIVE' })),
    requireOwner: vi.fn(async () => ({ status: 'ACTIVE' })),
    ensureWritable: vi.fn(),
    logActivity: vi.fn(),
  };
  const tasks = new TasksService(projects as unknown as ProjectsService);

  beforeEach(() => {
    vi.clearAllMocks();
    columns = [{ id: 'own-column', projectId: 'project-id', position: 1 }];
  });

  it('moves a task into a column of its own project', async () => {
    await tasks.status(freelancer, task.id, 'IN_PROGRESS', 'own-column');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'IN_PROGRESS',
        columnId: 'own-column',
      }),
    );
  });

  it('rejects a column from another project or with the To do status', async () => {
    columns.push({ id: 'other-column', projectId: 'other', position: 1 });
    await expect(
      tasks.status(freelancer, task.id, 'IN_PROGRESS', 'other-column'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      tasks.status(freelancer, task.id, 'TODO', 'own-column'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('clears the column when a task goes back to To do', async () => {
    await tasks.status(freelancer, task.id, 'TODO');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TODO', columnId: null }),
    );
  });

  it('adds columns after the last one and stops at five', async () => {
    const added = await tasks.addColumn(freelancer, 'project-id', 'Тести');
    expect(added).toMatchObject({ title: 'Тести', position: 2 });
    columns = [1, 2, 3, 4, 5].map((position) => ({
      id: `c${position}`,
      projectId: 'project-id',
      position,
    }));
    await expect(
      tasks.addColumn(freelancer, 'project-id', 'Зайва'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
