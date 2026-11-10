import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';
import { ProjectsService, validateBudget } from '../../../src/projects/projects.service.js';

describe('validateBudget', () => {
  it('rejects a maximum below the minimum', () => {
    expect(() => validateBudget(1000, 500)).toThrow(BadRequestException);
  });

  it('accepts an empty or ordered range', () => {
    expect(() => validateBudget(undefined, undefined)).not.toThrow();
    expect(() => validateBudget(500, 1000)).not.toThrow();
  });
});

function actor(role: CurrentUser['role']): CurrentUser {
  return {
    id: `${role.toLowerCase()}-id`,
    name: role,
    email: `${role.toLowerCase()}@example.com`,
    role,
    sessionId: 'session-id',
    twoFactorEnabled: false,
  };
}

function chain<T>(value: T) {
  const query = {
    first: vi.fn(async () => value),
    all: vi.fn(async () => value),
    select: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(async (data: unknown) => data),
  };
  query.select.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.offset.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('ProjectsService', () => {
  const client = actor('CLIENT');
  const freelancer = actor('FREELANCER');
  const admin = actor('ADMIN');
  type MockModel = Record<string, ReturnType<typeof vi.fn>>;
  type MockDatabase = Record<string, MockModel>;
  let db: MockDatabase;
  let prisma: {
    client: {
      orm: { public: MockDatabase };
      transaction: ReturnType<typeof vi.fn>;
    };
    transaction: ReturnType<typeof vi.fn>;
  };
  let service: ProjectsService;

  beforeEach(() => {
    db = {
      ProjectSkill: {
        all: vi.fn(async () => []),
        where: vi.fn(() => chain([])),
      },
      FavoriteProject: {
        where: vi.fn(() => chain([])),
      },
      Notification: { create: vi.fn(async (data: unknown) => data) },
      ActivityLog: { create: vi.fn(async (data: unknown) => data) },
      FreelancerProfile: { where: vi.fn(() => chain(null)) },
      FreelancerSkill: { where: vi.fn(() => chain([])) },
      PortfolioItem: { where: vi.fn(() => chain([])) },
    };
    prisma = {
      client: { orm: { public: db }, transaction: vi.fn() },
      transaction: vi.fn(),
    };
    service = new ProjectsService(prisma as unknown as PrismaService);
  });

  it('allows the owner and a member to open a project', async () => {
    const project = { id: 'project-id', clientId: client.id, status: 'ACTIVE' };
    db.Project = { where: vi.fn(() => chain(project)) };
    db.ProjectMember = { where: vi.fn(() => chain({ id: 'member-id' })) };

    expect(await service.requireAccess(client, project.id)).toBe(project);
    expect(await service.requireAccess(freelancer, project.id)).toBe(project);
    expect(await service.requireAccess(admin, project.id)).toBe(project);
  });

  it('rejects an unknown project and a user without membership', async () => {
    db.Project = { where: vi.fn(() => chain(null)) };
    await expect(
      service.requireAccess(client, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    db.Project.where.mockReturnValue(
      chain({ id: 'project-id', clientId: client.id }),
    );
    db.ProjectMember = { where: vi.fn(() => chain(null)) };
    await expect(
      service.requireAccess(freelancer, 'project-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps private parts (messages) closed to an admin outside the project', async () => {
    db.Project = {
      where: vi.fn(() => chain({ id: 'project-id', clientId: client.id })),
    };
    db.ProjectMember = { where: vi.fn(() => chain(null)) };
    await expect(
      service.requireAccess(admin, 'project-id'),
    ).resolves.toBeTruthy();
    await expect(
      service.requireAccess(admin, 'project-id', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an admin view but not manage a project they do not own', async () => {
    const project = { id: 'project-id', clientId: client.id, status: 'ACTIVE' };
    db.Project = { where: vi.fn(() => chain(project)) };
    db.ProjectMember = { where: vi.fn(() => chain(null)) };
    await expect(service.requireAccess(admin, project.id)).resolves.toBe(project);
    await expect(service.requireOwner(admin, project.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.requireOwner(client, project.id)).resolves.toBe(project);
  });

  it('lists only own projects for an admin in the workspace, all from the admin panel', async () => {
    const everyone = [{ id: 'project-id', clientId: client.id, status: 'ACTIVE' }];
    // Без where (all=true) — усі проєкти; where({ clientId: admin }) — жодного
    db.Project = { ...chain(everyone), where: vi.fn(() => chain([])) };
    db.ProjectMember = { where: vi.fn(() => chain([])) };
    db.Task = { where: vi.fn(() => chain([])) };
    await expect(service.list(admin, { page: 1, limit: 20 })).resolves.toEqual([]);
    const all = await service.list(admin, { page: 1, limit: 20, all: true });
    expect(all.map((p) => p.id)).toEqual(['project-id']);
  });

  it('only lets a client create a planning project', async () => {
    db.Project = { create: vi.fn(async (data: unknown) => data) };

    await expect(
      service.create(freelancer, { title: 'Landing page' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const project = await service.create(client, {
      title: 'Landing page',
      description: 'Description',
      deadline: '2026-12-01T12:00:00.000Z',
    });
    expect(project).toMatchObject({
      clientId: client.id,
      title: 'Landing page',
      // Новий проєкт спершу йде на модерацію
      status: 'MODERATION',
    });
  });

  it('calculates project progress in the list', async () => {
    const projects = [
      { id: 'project-id', clientId: client.id, status: 'ACTIVE' },
    ];
    const projectQuery = chain(projects);
    db.Project = { where: vi.fn(() => projectQuery) };
    db.Task = {
      where: vi.fn(() =>
        chain([
          { projectId: 'project-id', status: 'DONE' },
          { projectId: 'project-id', status: 'TODO' },
        ]),
      ),
    };

    const result = await service.list(client, { page: 1, limit: 20 });
    expect(result[0]).toMatchObject({
      totalTasks: 2,
      completedTasks: 1,
      progress: 50,
    });
  });

  it.each([-86400000, -1, 0])(
    'rejects creation with a deadline at or before now (%i ms)',
    async (offset) => {
      db.Project = { create: vi.fn(async (data: unknown) => data) };
      await expect(
        service.create(client, {
          title: 'Past deadline',
          deadline: new Date(Date.now() + offset).toISOString(),
        }),
      ).rejects.toThrow('Дедлайн проєкту має бути в майбутньому.');
      expect(db.Project.create).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid deadline even when the service is called directly', async () => {
    db.Project = { create: vi.fn() };
    await expect(
      service.create(client, { title: 'Invalid date', deadline: 'invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.Project.create).not.toHaveBeenCalled();
  });

  it('rejects moving a project deadline into the past without updating it', async () => {
    const project = { id: 'project-id', clientId: client.id, status: 'ACTIVE' };
    const query = chain(project);
    db.Project = { where: vi.fn(() => query) };
    await expect(
      service.update(client, project.id, {
        deadline: new Date(Date.now() - 86400000).toISOString(),
      }),
    ).rejects.toThrow('Дедлайн проєкту має бути в майбутньому.');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('allows a future deadline when it does not precede task deadlines', async () => {
    const project = { id: 'project-id', clientId: client.id, status: 'ACTIVE' };
    db.Project = { where: vi.fn(() => chain(project)) };
    db.Task = { where: vi.fn(() => chain([])) };
    const deadline = new Date(Date.now() + 86400000).toISOString();
    expect(
      await service.update(client, project.id, { deadline }),
    ).toMatchObject({
      deadline: new Date(deadline),
    });
  });

  it('allows editing other fields of an overdue project without changing its deadline', async () => {
    const project = {
      id: 'project-id',
      clientId: client.id,
      status: 'ACTIVE',
      deadline: new Date(Date.now() - 86400000),
    };
    const query = chain(project);
    db.Project = { where: vi.fn(() => query) };
    const result = await service.update(client, project.id, {
      title: 'New title',
    });
    expect(result).toMatchObject({ title: 'New title' });
    expect(result).not.toHaveProperty('deadline');
  });

  it('returns no projects when a freelancer has no memberships', async () => {
    db.Project = {};
    db.ProjectMember = { where: vi.fn(() => chain([])) };
    expect(await service.list(freelancer, { page: 1, limit: 20 })).toEqual([]);
  });

  it('does not close a project with unfinished work', async () => {
    const project = { id: 'project-id', clientId: client.id, status: 'ACTIVE' };
    db.Project = {
      where: vi.fn(() => chain(project)),
    };
    db.Task = {
      where: vi.fn(() => chain([{ status: 'TODO', deadline: null }])),
    };
    db.Order = { where: vi.fn(() => chain([])) };

    await expect(
      service.update(client, project.id, { status: 'COMPLETED' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(() => service.ensureWritable({ status: 'CANCELLED' })).toThrow(
      ConflictException,
    );
  });

  it('validates a project deadline against its tasks', async () => {
    const project = { id: 'project-id', clientId: client.id, status: 'ACTIVE' };
    db.Project = { where: vi.fn(() => chain(project)) };
    db.Task = {
      where: vi.fn(() =>
        chain([{ deadline: new Date('2027-01-01T12:00:00.000Z') }]),
      ),
    };
    await expect(
      service.update(client, project.id, {
        deadline: '2026-12-01T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates one application only for an open project', async () => {
    db.Project = {
      where: vi.fn(() => chain({ id: 'project-id', status: 'PLANNING' })),
    };
    db.ProjectApplication = {
      create: vi.fn(async (data: unknown) => data),
    };
    const application = await service.apply(freelancer, 'project-id', {
      message: 'I can complete this work.',
      proposedBudget: 5000,
      proposedDays: 7,
    });
    expect(application).toMatchObject({
      freelancerId: freelancer.id,
      status: 'PENDING',
    });
    await expect(
      service.apply(client, 'project-id', {
        message: 'I can complete this work.',
        proposedBudget: 5000,
        proposedDays: 7,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('shows marketplace projects with the current application status', async () => {
    const project = {
      id: 'project-id',
      clientId: client.id,
      status: 'PLANNING',
    };
    // Команда, що добирає людей, — на біржі; закритий набір і чернетка модерації — ні
    const projects = [
      project,
      { id: 'hiring', clientId: client.id, status: 'ACTIVE', hiringOpen: true },
      { id: 'closed', clientId: client.id, status: 'ACTIVE', hiringOpen: false },
      { id: 'draft', clientId: client.id, status: 'MODERATION' },
    ];
    db.Project = { orderBy: vi.fn(() => chain(projects)) };
    db.ProjectApplication = {
      where: vi.fn(() => chain([{ projectId: project.id, status: 'PENDING' }])),
    };
    db.User = {
      where: vi.fn(() => chain({ id: client.id, name: 'Client' })),
    };

    const result = await service.marketplace(freelancer, {
      page: 1,
      limit: 20,
    });
    expect(result.map((item) => item.id)).toEqual(['project-id', 'hiring']);
    expect(result[0]).toMatchObject({ applicationStatus: 'PENDING' });
    await expect(
      service.marketplace(client, { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hires the first freelancer, keeps other applications and opens hiring', async () => {
    const application = {
      id: 'application-id',
      projectId: 'project-id',
      freelancerId: freelancer.id,
      status: 'PENDING',
      proposedBudget: 1200,
      proposedDays: 10,
    };
    const applicationQuery = chain<unknown>(application);
    const projectQuery = chain({
      id: application.projectId,
      clientId: client.id,
      status: 'PLANNING',
      hiringOpen: false,
    });
    db.ProjectApplication = { where: vi.fn(() => applicationQuery) };
    db.Project = { where: vi.fn(() => projectQuery) };
    db.ProjectMember = {
      where: vi.fn(() => chain(null)),
      create: vi.fn(async (data: unknown) => data),
    };
    db.Order = { create: vi.fn(async (data: unknown) => data) };
    prisma.client.transaction.mockImplementation(
      async (action: (tx: { orm: { public: typeof db } }) => unknown) =>
        action({ orm: { public: db } }),
    );

    const result = await service.acceptApplication(client, application.id);
    expect(result).toEqual({
      projectId: application.projectId,
      freelancerId: freelancer.id,
    });
    expect(db.ProjectMember.create).toHaveBeenCalledOnce();
    // Угода з виконавцем на умовах його заявки
    const order = db.Order.create.mock.calls[0][0] as {
      deadline: Date;
      createdAt: Date;
    };
    expect(order).toMatchObject({
      projectId: application.projectId,
      clientId: client.id,
      freelancerId: freelancer.id,
      amount: 1200,
      status: 'IN_PROGRESS',
    });
    expect(order.deadline.getTime() - order.createdAt.getTime()).toBe(
      10 * 86_400_000,
    );
    // Оновлено лише прийняту заявку — інших не відхиляємо
    expect(applicationQuery.update).toHaveBeenCalledOnce();
    expect(db.ProjectApplication.where).toHaveBeenCalledWith({
      id: application.id,
      status: 'PENDING',
    });
    expect(projectQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', hiringOpen: true }),
    );
  });

  it('adds one more freelancer to an active team without re-adding a member', async () => {
    const application = {
      id: 'second',
      projectId: 'project-id',
      freelancerId: freelancer.id,
      status: 'PENDING',
    };
    const projectQuery = chain({
      id: 'project-id',
      clientId: client.id,
      status: 'ACTIVE',
      hiringOpen: true,
    });
    db.ProjectApplication = { where: vi.fn(() => chain<unknown>(application)) };
    db.Project = { where: vi.fn(() => projectQuery) };
    db.ProjectMember = {
      where: vi.fn(() => chain({ id: 'existing-member' })),
      create: vi.fn(),
    };
    db.Order = { create: vi.fn() };
    prisma.client.transaction.mockImplementation(
      async (action: (tx: { orm: { public: typeof db } }) => unknown) =>
        action({ orm: { public: db } }),
    );

    await service.acceptApplication(client, application.id);
    expect(db.ProjectMember.create).not.toHaveBeenCalled();
    expect(projectQuery.update).not.toHaveBeenCalled();
  });

  it('refuses to accept after hiring is closed', async () => {
    db.ProjectApplication = {
      where: vi.fn(() =>
        chain({ id: 'a', projectId: 'project-id', status: 'PENDING' }),
      ),
    };
    db.Project = {
      where: vi.fn(() =>
        chain({
          id: 'project-id',
          clientId: client.id,
          status: 'ACTIVE',
          hiringOpen: false,
        }),
      ),
    };
    await expect(
      service.acceptApplication(client, 'a'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('closes hiring and rejects the remaining applications', async () => {
    const projectQuery = chain({
      id: 'project-id',
      clientId: client.id,
      status: 'ACTIVE',
      hiringOpen: true,
    });
    const applicationQuery = chain<unknown>([
      { id: 'left-1', freelancerId: 'f1' },
      { id: 'left-2', freelancerId: 'f2' },
    ]);
    db.Project = { where: vi.fn(() => projectQuery) };
    db.ProjectApplication = { where: vi.fn(() => applicationQuery) };
    prisma.client.transaction.mockImplementation(
      async (action: (tx: { orm: { public: typeof db } }) => unknown) =>
        action({ orm: { public: db } }),
    );

    expect(await service.closeHiring(client, 'project-id')).toEqual({
      hiringOpen: false,
      rejected: 2,
    });
    expect(projectQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ hiringOpen: false }),
    );
    expect(applicationQuery.update).toHaveBeenCalledTimes(2);
    expect(db.Notification.create).toHaveBeenCalledTimes(2);
    db.ProjectMember = { where: vi.fn(() => chain({ id: 'member-id' })) };
    await expect(
      service.closeHiring(freelancer, 'project-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
