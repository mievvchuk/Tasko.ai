import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';
import { TasksService } from '../../../src/tasks/tasks.service.js';

type Row = Record<string, unknown>;

const person = (id: string, role: CurrentUser['role']): CurrentUser => ({
  id,
  name: id,
  email: `${id}@example.com`,
  role,
  sessionId: 's',
  twoFactorEnabled: false,
});
const client = person('client', 'CLIENT');
const freelancer = person('f1', 'FREELANCER');
const other = person('f2', 'FREELANCER');

// Двійник бази: таблиці-масиви, where(...) з first/all/update/delete
function setup(task: Row, extra: { milestones?: Row[]; tasks?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    Task: [task, ...(extra.tasks ?? [])],
    ProjectMember: [
      { projectId: 'p1', userId: 'f1' },
      { projectId: 'p1', userId: 'f2' },
    ],
    ProjectMilestone: extra.milestones ?? [],
    BoardColumn: [
      { id: 'c1', projectId: 'p1', status: 'IN_PROGRESS', title: 'Frontend' },
      { id: 'c2', projectId: 'p1', status: 'IN_PROGRESS', title: 'Backend' },
    ],
    ActivityLog: [],
  };
  const matches = (row: Row, query: Row) => Object.entries(query).every(([key, value]) => row[key] === value);
  const table = (name: string) => ({
    where: (query: Row) => ({
      first: async () => tables[name].find((row) => matches(row, query)) ?? null,
      all: async () => tables[name].filter((row) => matches(row, query)),
      update: async (patch: Row) => {
        const row = tables[name].find((item) => matches(item, query));
        if (!row) return null;
        Object.assign(row, patch);
        return row;
      },
      // Як у Prisma 8: updateAll враховує всю умову й повертає змінені рядки
      updateAll: async (patch: Row) => {
        const rows = tables[name].filter((item) => matches(item, query));
        rows.forEach((row) => Object.assign(row, patch));
        return rows;
      },
      delete: async () => {
        tables[name] = tables[name].filter((row) => !matches(row, query));
      },
    }),
    create: async (row: Row) => {
      tables[name].push(row);
      return row;
    },
  });
  const db = Object.fromEntries(Object.keys(tables).map((name) => [name, table(name)]));
  const projects = {
    prisma: {
      client: {
        orm: { public: db },
        transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ orm: { public: db } }),
      },
    },
    requireAccess: vi.fn(async (user: CurrentUser) => {
      if (user.id === 'stranger') throw new ForbiddenException();
      return { id: 'p1', status: 'ACTIVE', clientId: 'client' };
    }),
    requireOwner: vi.fn(async (user: CurrentUser) => {
      if (user.id !== 'client') throw new ForbiddenException();
      return { id: 'p1', status: 'ACTIVE', clientId: 'client' };
    }),
    ensureWritable: vi.fn(),
    logActivity: vi.fn(),
    notify: vi.fn(),
  };
  const service = new TasksService(projects as unknown as ProjectsService);
  return { service, tables, projects };
}

const baseTask = (patch: Row = {}): Row => ({
  id: 't1',
  projectId: 'p1',
  title: 'Макет',
  status: 'TODO',
  assigneeId: 'f1',
  columnId: null,
  milestoneId: null,
  ...patch,
});

describe('task transitions on the board', () => {
  it('lets the freelancer take a task into work and between work columns', async () => {
    const { service, tables, projects } = setup(baseTask());
    await service.transition(freelancer, 't1', 'IN_PROGRESS', {
      columnId: 'c1',
    });
    await service.transition(freelancer, 't1', 'IN_PROGRESS', {
      columnId: 'c2',
    });
    expect(tables.Task[0]).toMatchObject({
      status: 'IN_PROGRESS',
      columnId: 'c2',
    });
    // Аудит: кожен перехід записано
    expect(projects.logActivity).toHaveBeenCalledWith('f1', 'p1', 'TASK_MOVED', expect.stringContaining('До виконання → У роботі'));
  });

  it('never lets the freelancer complete a task themselves', async () => {
    const { service, tables } = setup(baseTask({ status: 'IN_PROGRESS' }));
    await expect(service.transition(freelancer, 't1', 'DONE')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tables.Task[0].status).toBe('IN_PROGRESS');
  });

  it('keeps one freelancer away from another freelancer’s task', async () => {
    const { service } = setup(baseTask());
    await expect(service.transition(other, 't1', 'IN_PROGRESS')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses someone without access to the project', async () => {
    const { service } = setup(baseTask());
    await expect(service.transition(person('stranger', 'FREELANCER'), 't1', 'IN_PROGRESS')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a member take a free task, one unfinished task at a time', async () => {
    const free = setup(baseTask({ assigneeId: null }));
    await free.service.transition(other, 't1', 'IN_PROGRESS');
    expect(free.tables.Task[0]).toMatchObject({
      status: 'IN_PROGRESS',
      assigneeId: 'f2',
    });
    const busy = setup(baseTask({ assigneeId: null }), {
      tasks: [baseTask({ id: 't2', status: 'REVISION', assigneeId: 'f2' })],
    });
    await expect(busy.service.transition(other, 't1', 'IN_PROGRESS')).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets the client return accepted work with a reason and tells the freelancer', async () => {
    const { service, tables, projects } = setup(baseTask({ status: 'DONE' }));
    await expect(service.transition(client, 't1', 'REVISION')).rejects.toBeInstanceOf(BadRequestException);
    await service.transition(client, 't1', 'REVISION', {
      reason: 'Не той колір кнопок',
    });
    expect(tables.Task[0].status).toBe('REVISION');
    expect(projects.notify).toHaveBeenCalledWith(
      'f1',
      'client',
      'WORK_REVIEWED',
      expect.stringContaining('Не той колір кнопок'),
      'p1',
      't1',
    );
  });

  it('does not reopen a task whose milestone is already accepted', async () => {
    const { service } = setup(baseTask({ status: 'DONE', milestoneId: 'm1' }), {
      milestones: [{ id: 'm1', status: 'COMPLETED' }],
    });
    await expect(service.transition(client, 't1', 'REVISION', { reason: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets the freelancer resume returned work', async () => {
    const { service, tables } = setup(baseTask({ status: 'REVISION' }));
    await service.transition(freelancer, 't1', 'IN_PROGRESS');
    expect(tables.Task[0].status).toBe('IN_PROGRESS');
  });

  it('reports a concurrent change instead of overwriting it', async () => {
    const { service, tables } = setup(baseTask());
    // Інший користувач уже пересунув картку, поки цей запит ішов
    const original = service.moveContext.bind(service);
    vi.spyOn(service, 'moveContext').mockImplementation(async (...args) => {
      const context = await original(...args);
      tables.Task[0].status = 'IN_PROGRESS';
      return { ...context, task: { ...context.task, status: 'TODO' } };
    });
    await expect(service.transition(freelancer, 't1', 'TODO')).rejects.toBeInstanceOf(ConflictException);
  });

  it('sends review steps through the submission flow', async () => {
    const { service } = setup(baseTask({ status: 'IN_PROGRESS' }));
    await expect(service.transition(freelancer, 't1', 'REVIEW')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves cards of a deleted column into the chosen column without losing them', async () => {
    const { service, tables } = setup(baseTask({ status: 'IN_PROGRESS', columnId: 'c1' }));
    const result = await service.deleteColumn(client, 'c1', 'c2');
    expect(result).toEqual({ id: 'c1', moved: 1 });
    expect(tables.Task[0].columnId).toBe('c2');
    expect(tables.BoardColumn.map((column) => column.id)).toEqual(['c2']);
    await expect(service.deleteColumn(client, 'c2', 'c2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets only the client restructure the board', async () => {
    const { service } = setup(baseTask());
    await expect(service.renameColumn(freelancer, 'c1', 'UI')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.renameColumn(client, 'c1', 'UI')).resolves.toMatchObject({ title: 'UI' });
  });
});
