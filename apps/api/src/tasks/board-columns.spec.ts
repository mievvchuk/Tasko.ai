import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import { TasksService, columnKey, planColumnOrder } from './tasks.service.js';

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
  let columns: {
    id: string;
    projectId: string;
    position: number;
    status: string;
  }[] = [];
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
    requireAccess: vi.fn(async () => ({
      status: 'ACTIVE',
      clientId: 'client-id',
    })),
    requireOwner: vi.fn(async () => ({ status: 'ACTIVE' })),
    ensureWritable: vi.fn(),
    logActivity: vi.fn(),
  };
  const tasks = new TasksService(projects as unknown as ProjectsService);

  beforeEach(() => {
    vi.clearAllMocks();
    columns = [
      {
        id: 'own-column',
        projectId: 'project-id',
        position: 1,
        status: 'IN_PROGRESS',
      },
      { id: 'backlog', projectId: 'project-id', position: 2, status: 'TODO' },
    ];
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
    columns.push({
      id: 'other-column',
      projectId: 'other',
      position: 1,
      status: 'IN_PROGRESS',
    });
    await expect(
      tasks.status(freelancer, task.id, 'IN_PROGRESS', 'other-column'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      tasks.status(freelancer, task.id, 'TODO', 'own-column'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('moves a task into a To do column such as Backlog', async () => {
    await tasks.status(freelancer, task.id, 'TODO', 'backlog');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TODO', columnId: 'backlog' }),
    );
    await expect(
      tasks.status(freelancer, task.id, 'IN_PROGRESS', 'backlog'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the project owner move a task assigned to someone else', async () => {
    const owner = { ...freelancer, id: 'client-id', role: 'CLIENT' as const };
    await tasks.status(owner, task.id, 'IN_PROGRESS');
    expect(update).toHaveBeenCalled();
    const stranger = { ...freelancer, id: 'stranger-id' };
    await expect(
      tasks.status(stranger, task.id, 'IN_PROGRESS'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('clears the column when a task goes back to To do', async () => {
    await tasks.status(freelancer, task.id, 'TODO');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TODO', columnId: null }),
    );
  });

  it('adds columns at the end of their stage and stops at eight', async () => {
    const added = await tasks.addColumn(freelancer, 'project-id', 'Тести');
    expect(added).toMatchObject({
      title: 'Тести',
      position: 2100,
      status: 'IN_PROGRESS',
    });
    const backlog = await tasks.addColumn(
      freelancer,
      'project-id',
      'Беклог',
      'TODO',
    );
    expect(backlog).toMatchObject({ status: 'TODO', position: 100 });
    columns = [1, 2, 3, 4, 5, 6, 7, 8].map((position) => ({
      id: `c${position}`,
      projectId: 'project-id',
      position,
      status: 'IN_PROGRESS',
    }));
    await expect(
      tasks.addColumn(freelancer, 'project-id', 'Зайва'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('kanban column order', () => {
  it('puts legacy «In progress» columns after the standard lane', () => {
    expect(columnKey({ status: 'IN_PROGRESS', position: 3 })).toBe(2003);
    expect(columnKey({ status: 'TODO', position: 3 })).toBe(3);
    expect(columnKey({ status: 'IN_PROGRESS', position: 2110 })).toBe(2110);
  });

  it('derives stage and position from the place on the board', () => {
    expect(
      planColumnOrder(
        ['a', 'TODO', 'b', 'IN_PROGRESS', 'c', 'd'],
        ['a', 'b', 'c', 'd'],
      ),
    ).toEqual([
      { id: 'a', position: 100, status: 'TODO' },
      { id: 'b', position: 1100, status: 'TODO' },
      { id: 'c', position: 2100, status: 'IN_PROGRESS' },
      { id: 'd', position: 2110, status: 'IN_PROGRESS' },
    ]);
  });

  it('rejects incomplete orders and swapped standard lanes', () => {
    expect(() => planColumnOrder(['TODO', 'IN_PROGRESS'], ['a'])).toThrow(
      BadRequestException,
    );
    expect(() => planColumnOrder(['IN_PROGRESS', 'a', 'TODO'], ['a'])).toThrow(
      BadRequestException,
    );
    expect(() =>
      planColumnOrder(['TODO', 'a', 'a', 'IN_PROGRESS'], ['a', 'b']),
    ).toThrow(BadRequestException);
  });
});
