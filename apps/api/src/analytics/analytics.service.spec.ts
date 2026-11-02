import type { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import {
  AnalyticsService,
  nearestDeadline,
  taskRisk,
} from './analytics.service.js';

describe('nearest deadline', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  it('ignores finished, overdue and undated tasks', () => {
    expect(
      nearestDeadline(
        [
          { status: 'DONE', deadline: new Date('2026-10-18T12:00:00Z') },
          { status: 'TODO', deadline: new Date('2026-10-16T12:00:00Z') },
          { status: 'TODO', deadline: null },
        ],
        now,
      ),
    ).toBeNull();
  });
  it('returns the earliest future deadline including work under review', () => {
    expect(
      nearestDeadline(
        [
          { status: 'TODO', deadline: new Date('2026-10-20T12:00:00Z') },
          { status: 'REVIEW', deadline: new Date('2026-10-18T12:00:00Z') },
        ],
        now,
      ),
    ).toEqual(new Date('2026-10-18T12:00:00Z'));
    expect(nearestDeadline([], now)).toBeNull();
  });
});

describe('task risk', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it('ignores completed tasks even when overdue', () => {
    expect(
      taskRisk(
        { status: 'DONE', priority: 'HIGH', deadline: new Date('2026-10-01') },
        now,
      ),
    ).toBe('NONE');
  });
  it('detects overdue and approaching deadlines', () => {
    expect(
      taskRisk(
        { status: 'TODO', priority: 'LOW', deadline: new Date('2026-10-09') },
        now,
      ),
    ).toBe('OVERDUE');
    expect(
      taskRisk(
        { status: 'TODO', priority: 'LOW', deadline: new Date('2026-10-12') },
        now,
      ),
    ).toBe('NEAR_DEADLINE');
  });
  it('handles high priority without a deadline', () => {
    expect(
      taskRisk({ status: 'TODO', priority: 'HIGH', deadline: null }, now),
    ).toBe('HIGH_PRIORITY');
    expect(
      taskRisk({ status: 'TODO', priority: 'LOW', deadline: null }, now),
    ).toBe('NONE');
  });
});

describe('AnalyticsService', () => {
  const user: CurrentUser = {
    id: 'client-id',
    name: 'Client',
    email: 'client@example.com',
    role: 'CLIENT',
    sessionId: 'session-id',
    twoFactorEnabled: false,
  };
  const projects = [{ id: 'project-id', clientId: user.id, status: 'ACTIVE' }];
  const tasks = [
    {
      id: 'task-1',
      projectId: 'project-id',
      title: 'Важливе завдання',
      status: 'TODO',
      priority: 'HIGH',
      assigneeId: 'freelancer-id',
      deadline: new Date(Date.now() - 60_000),
    },
    {
      id: 'task-2',
      projectId: 'project-id',
      title: 'Виконане завдання',
      status: 'DONE',
      priority: 'LOW',
      assigneeId: 'freelancer-id',
      deadline: null,
    },
  ];
  const projectWhere = { all: vi.fn(async () => projects) };
  const taskWhere = { all: vi.fn(async () => tasks) };
  const memberWhere = {
    all: vi.fn(async () => [
      { projectId: 'project-id', userId: 'freelancer-id' },
    ]),
  };
  const personWhere = {
    select: vi.fn(() => ({
      first: vi.fn(async () => ({ id: 'freelancer-id', name: 'Freelancer' })),
    })),
  };
  const db = {
    Project: {
      all: vi.fn(async () => projects),
      where: vi.fn(() => projectWhere),
    },
    ProjectMember: { where: vi.fn(() => memberWhere) },
    Task: { where: vi.fn(() => taskWhere) },
    User: { where: vi.fn(() => personWhere) },
  };
  const projectService = {
    prisma: { client: { orm: { public: db } } },
    detail: vi.fn(async () => ({ ...projects[0], progress: 50 })),
  };
  const analytics = new AnalyticsService(
    projectService as unknown as ProjectsService,
  );

  beforeEach(() => vi.clearAllMocks());

  it('builds a dashboard only from visible data', async () => {
    const result = await analytics.dashboard(user);
    expect(result).toMatchObject({
      projects: 1,
      activeProjects: 1,
      tasks: 2,
      completedTasks: 1,
      overdueTasks: 1,
    });
    expect(result.tasksByStatus).toMatchObject({ TODO: 1, DONE: 1 });
  });

  it('sorts active deadlines and includes their risk', async () => {
    const result = await analytics.deadlines(user);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'task-1', risk: 'OVERDUE' });
  });

  it('counts workload by project member', async () => {
    const result = await analytics.workload(user);
    expect(result[0]).toMatchObject({
      activeTasks: 1,
      overdueTasks: 1,
      highPriorityTasks: 1,
    });
    expect(result[0]).toHaveProperty('tasks', [
      expect.objectContaining({ id: 'task-1', risk: 'OVERDUE' }),
    ]);
    expect(result[0]).toHaveProperty('nearestDeadline', tasks[0].deadline);
  });

  it('returns risky tasks in a project summary', async () => {
    const result = await analytics.summary(user, 'project-id');
    expect(result.project).toMatchObject({ id: 'project-id', progress: 50 });
    expect(result.riskyTasks).toHaveLength(1);
  });

  it('returns no data for a freelancer without memberships', async () => {
    memberWhere.all.mockResolvedValueOnce([]);
    const result = await analytics.visibleProjects({
      ...user,
      id: 'freelancer-id',
      role: 'FREELANCER',
    });
    expect(result).toEqual([]);
  });
});
