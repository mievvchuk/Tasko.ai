import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';
import {
  TasksService,
  compareQueue,
} from '../../../src/tasks/tasks.service.js';

describe('taking the next task from the queue', () => {
  const freelancer: CurrentUser = {
    id: 'freelancer-id',
    name: 'Андрій',
    email: 'andrii@example.com',
    role: 'FREELANCER',
    sessionId: 'session-id',
    twoFactorEnabled: false,
  };
  const day = (n: number) => new Date(Date.UTC(2026, 11, n));
  interface Row {
    id: string;
    title?: string;
    projectId: string;
    assigneeId: string | null;
    status: string;
    priority: string;
    deadline: Date | null;
    createdAt: Date;
  }
  const task = (data: Partial<Row> & { id: string }): Row => ({
    projectId: 'project-id',
    assigneeId: null,
    status: 'TODO',
    priority: 'MEDIUM',
    deadline: null,
    createdAt: day(1),
    ...data,
  });
  let rows: Row[] = [];
  // Імітує умовне оновлення: null, якщо завдання вже хтось узяв
  const update = vi.fn();
  const db = {
    Task: {
      where: vi.fn((filter: Record<string, unknown>) => ({
        all: async () => rows,
        // Перевірка «чи не взяв фрілансер уже щось паралельно»
        where: () => ({
          all: async () =>
            rows.filter(
              (row) =>
                row.assigneeId === filter.assigneeId &&
                ['TODO', 'IN_PROGRESS'].includes(row.status),
            ),
        }),
        updateAll: async (data: object) => {
          update(filter, data);
          const row = rows.find((item) => item.id === filter.id);
          return row && row.assigneeId === null ? [{ ...row, ...data }] : [];
        },
      })),
    },
  };
  const projects = {
    prisma: { client: { orm: { public: db } } },
    requireAccess: vi.fn(async () => ({
      status: 'ACTIVE',
      clientId: 'client-id',
    })),
    requireAssignee: vi.fn(),
    logActivity: vi.fn(),
    notify: vi.fn(),
  };
  const tasks = new TasksService(projects as unknown as ProjectsService);

  beforeEach(() => vi.clearAllMocks());

  it('orders by deadline, then priority, then age', () => {
    const queue = [
      task({ id: 'no-deadline-high', priority: 'HIGH' }),
      task({ id: 'later', deadline: day(20) }),
      task({ id: 'soon-low', deadline: day(10), priority: 'LOW' }),
      task({ id: 'soon-high', deadline: day(10), priority: 'HIGH' }),
      task({ id: 'old', createdAt: day(1) }),
    ].sort(compareQueue);
    expect(queue.map((item) => item.id)).toEqual([
      'soon-high',
      'soon-low',
      'later',
      'no-deadline-high',
      'old',
    ]);
  });

  it('assigns the first free task and tells the client', async () => {
    rows = [
      task({ id: 'taken', assigneeId: 'other', deadline: day(2) }),
      task({ id: 'done', status: 'DONE', deadline: day(3) }),
      task({ id: 'next', title: 'Макет', deadline: day(5) }),
      task({ id: 'after', deadline: day(9) }),
    ];
    const result = await tasks.takeNext(freelancer, 'project-id');
    expect(result).toMatchObject({ id: 'next', assigneeId: freelancer.id });
    expect(projects.notify).toHaveBeenCalledWith(
      'client-id',
      freelancer.id,
      'TASK_TAKEN',
      'Андрій узяв завдання «Макет».',
      'project-id',
      'next',
    );
  });

  it('skips a task another freelancer took a moment earlier', async () => {
    rows = [task({ id: 'first', deadline: day(2) }), task({ id: 'second' })];
    // Між читанням черги й оновленням перше завдання встигли взяти
    db.Task.where.mockImplementationOnce(() => ({
      all: async () => {
        const snapshot = rows.map((row) => ({ ...row }));
        rows[0] = { ...rows[0], assigneeId: 'other' };
        return snapshot;
      },
      where: () => ({ all: async () => [] }),
      updateAll: async () => [],
    }));
    const result = await tasks.takeNext(freelancer, 'project-id');
    expect(result).toMatchObject({ id: 'second' });
  });

  it('refuses while the freelancer still has an unfinished task', async () => {
    rows = [
      task({ id: 'mine', assigneeId: freelancer.id, status: 'IN_PROGRESS' }),
      task({ id: 'free' }),
    ];
    await expect(
      tasks.takeNext(freelancer, 'project-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('reports an empty queue, a closed project and non-freelancers', async () => {
    rows = [
      task({ id: 'review', status: 'REVIEW', assigneeId: freelancer.id }),
    ];
    await expect(
      tasks.takeNext(freelancer, 'project-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    projects.requireAccess.mockResolvedValueOnce({
      status: 'PAUSED',
      clientId: 'client-id',
    });
    await expect(
      tasks.takeNext(freelancer, 'project-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      tasks.takeNext({ ...freelancer, role: 'CLIENT' }, 'project-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
