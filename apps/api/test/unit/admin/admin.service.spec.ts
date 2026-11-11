import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { hashPassword } from '../../../src/auth/password.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';
import { AdminService, lastMonths } from '../../../src/admin/admin.service.js';

describe('AdminService reports', () => {
  const admin: CurrentUser = {
    id: 'admin-id',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
    sessionId: 'session-id',
    twoFactorEnabled: false,
  };
  const now = new Date();
  const longAgo = new Date('2020-01-15T00:00:00Z');
  const userRows = [
    { role: 'CLIENT', status: 'ACTIVE', createdAt: now },
    { role: 'FREELANCER', status: 'BLOCKED', createdAt: longAgo },
  ];
  const hour = 3_600_000;
  const projectRows = [
    {
      id: 'p1',
      status: 'ACTIVE',
      createdAt: new Date(now.getTime() - 10 * hour),
    },
    { id: 'p2', status: 'COMPLETED', createdAt: now },
  ];
  const complaintRows = [
    { status: 'OPEN', createdAt: now, updatedAt: now },
    {
      status: 'RESOLVED',
      createdAt: new Date(now.getTime() - 4 * hour),
      updatedAt: now,
    },
  ];
  // До проєкту p1: перша заявка через 2 год, прийнята через 6 год
  const applicationRows = [
    {
      projectId: 'p1',
      status: 'ACCEPTED',
      createdAt: new Date(now.getTime() - 8 * hour),
      updatedAt: new Date(now.getTime() - 4 * hour),
    },
    {
      projectId: 'p1',
      status: 'REJECTED',
      createdAt: new Date(now.getTime() - 7 * hour),
      updatedAt: new Date(now.getTime() - 4 * hour),
    },
  ];
  const taskRows = [
    { status: 'TODO', deadline: new Date(Date.now() - 60_000) },
    { status: 'DONE', deadline: new Date(Date.now() - 60_000) },
  ];
  const db = {
    User: { select: vi.fn(() => ({ all: vi.fn(async () => userRows) })) },
    Project: {
      select: vi.fn(() => ({ all: vi.fn(async () => projectRows) })),
    },
    Task: { select: vi.fn(() => ({ all: vi.fn(async () => taskRows) })) },
    Complaint: {
      select: vi.fn(() => ({ all: vi.fn(async () => complaintRows) })),
    },
    ProjectApplication: {
      select: vi.fn(() => ({ all: vi.fn(async () => applicationRows) })),
    },
    Order: {
      select: vi.fn(() => ({
        all: vi.fn(async () => [
          { status: 'COMPLETED', amount: 1500 },
          { status: 'COMPLETED', amount: null },
          { status: 'IN_PROGRESS', amount: 800 },
        ]),
      })),
    },
  };
  const prisma = { client: { orm: { public: db } } };
  const service = new AdminService(
    prisma as unknown as PrismaService,
    {} as ProjectsService,
  );

  it('builds system totals and protects them from non-admins', async () => {
    const report = await service.report(admin);

    expect(report).toMatchObject({
      users: 2,
      blockedUsers: 1,
      projects: 2,
      activeProjects: 1,
      completedProjects: 1,
      tasks: 2,
      overdueTasks: 1,
      usersByRole: { CLIENT: 1, FREELANCER: 1, ADMIN: 0 },
      projectsByStatus: { ACTIVE: 1, COMPLETED: 1, PLANNING: 0 },
    });
    // Поточний місяць — останній; старі записи в діаграму не потрапляють
    expect(report.growth).toHaveLength(6);
    expect(report.growth.at(-1)).toMatchObject({ users: 1 });
    // p1 створено 10 год тому — на межі місяця він може потрапити в попередній
    expect(report.growth.reduce((sum, row) => sum + row.projects, 0)).toBe(2);
    expect(report).toMatchObject({
      complaintsByStatus: { OPEN: 1, RESOLVED: 1, REJECTED: 0 },
      applicationsByStatus: { PENDING: 0, ACCEPTED: 1, REJECTED: 1 },
      ordersByStatus: { PENDING: 0, IN_PROGRESS: 1, COMPLETED: 2, CANCELLED: 0 },
      completedOrdersAmount: 1500,
      week: { users: 1, projects: 2, complaints: 2, applications: 2 },
      averageHours: { complaintResolution: 4, firstApplication: 2, hire: 6 },
    });
    expect(report.week.days).toHaveLength(7);
    await expect(
      service.report({ ...admin, role: 'CLIENT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['json', 'application/json', '{'],
    ['csv', 'text/csv', '\uFEFF'],
    ['xlsx', 'application/vnd.openxmlformats', 'PK'],
    ['pdf', 'application/pdf', '%PDF'],
  ] as const)('exports a real %s file', async (format, type, signature) => {
    const file = await service.exportReport(admin, format);

    expect(file.contentType).toContain(type);
    expect(file.fileName.endsWith(`.${format}`)).toBe(true);
    expect(file.content.toString('utf8').startsWith(signature)).toBe(true);
    expect(file.content.length).toBeGreaterThan(100);
  });

  describe('admin role protection', () => {
    const people: Record<string, Record<string, unknown>> = {};
    const created: Record<string, unknown>[] = [];
    const User = {
      where: vi.fn((filter: { id?: string; email?: string }) => ({
        first: vi.fn(async () =>
          Object.values(people).find(
            (person) =>
              (filter.id && person.id === filter.id) ||
              (filter.email && person.email === filter.email),
          ),
        ),
      })),
      create: vi.fn(async (row: Record<string, unknown>) => {
        created.push(row);
        return row;
      }),
    };
    const tx = { orm: { public: { User } } };
    const service = new AdminService(
      {
        client: {
          orm: { public: { User } },
          transaction: (run: (t: typeof tx) => unknown) => run(tx),
        },
      } as unknown as PrismaService,
      {} as ProjectsService,
    );

    beforeAll(async () => {
      people.admin = {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'ADMIN',
        passwordHash: await hashPassword('Admin-pass-123'),
        twoFactorEnabled: false,
      };
      people.other = {
        id: 'other-admin',
        email: 'o@example.com',
        role: 'ADMIN',
      };
    });

    it('never lets the panel change another admin, or yourself', async () => {
      for (const id of ['other-admin', 'admin-id'])
        await expect(
          service.update(admin, id, { status: 'BLOCKED' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a separate admin only after the creator password matches', async () => {
      const data = {
        name: 'Нова Адмінка',
        email: 'new-admin@example.com',
        password: 'New-admin-123',
        currentPassword: 'wrong-pass-1',
      };
      await expect(service.createAdmin(admin, data)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.createAdmin({ ...admin, role: 'CLIENT' }, data),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createAdmin(admin, {
          ...data,
          email: 'o@example.com',
          currentPassword: 'Admin-pass-123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      const result = await service.createAdmin(admin, {
        ...data,
        currentPassword: 'Admin-pass-123',
      });
      expect(result).toMatchObject({ email: data.email, role: 'ADMIN' });
      expect(result).not.toHaveProperty('passwordHash');
      expect(created).toHaveLength(1);
    });
  });

  describe('deleting users', () => {
    // Таблиці в пам'яті: where() фільтрує за рівністю полів
    let tables: Record<string, Record<string, unknown>[]>;
    const matches = (
      row: Record<string, unknown>,
      filter: Record<string, unknown>,
    ) => Object.entries(filter).every(([key, value]) => row[key] === value);
    const table = (name: string) => ({
      where: (filter: Record<string, unknown>) => {
        const rows = () =>
          (tables[name] ??= []).filter((row) => matches(row, filter));
        return {
          first: async () => rows()[0] ?? null,
          all: async () => rows(),
          delete: async () => {
            tables[name] = tables[name].filter((row) => row !== rows()[0]);
          },
          deleteAll: async () => {
            const gone = rows();
            tables[name] = tables[name].filter((row) => !gone.includes(row));
          },
          update: async (data: Record<string, unknown>) =>
            Object.assign(rows()[0], data),
          updateAll: async (data: Record<string, unknown>) =>
            rows().forEach((row) => Object.assign(row, data)),
        };
      },
    });
    const names = [
      'User',
      'Project',
      'ProjectMember',
      'Task',
      'ProjectApplication',
      'Message',
      'WorkSubmission',
      'FreelancerReview',
      'Complaint',
      'FileAttachment',
      'ActivityLog',
      'AuthSession',
      'Notification',
      'FavoriteProject',
      'FreelancerSkill',
      'PortfolioItem',
      'FreelancerProfile',
      'BoardColumn',
      'ProjectSkill',
      'ProjectMilestone',
      'Order',
      'StoredFile',
      'ApplicationMessage',
    ];
    const orm = {
      public: Object.fromEntries(names.map((name) => [name, table(name)])),
    };
    const service = new AdminService(
      {
        client: {
          orm,
          transaction: (run: (t: { orm: typeof orm }) => unknown) =>
            run({ orm }),
        },
      } as unknown as PrismaService,
      {} as ProjectsService,
    );

    beforeEach(() => {
      tables = {
        User: [
          {
            id: 'fresh',
            name: 'Новий',
            email: 'fresh@example.com',
            role: 'CLIENT',
          },
          {
            id: 'busy',
            name: 'Іван',
            email: 'busy@example.com',
            role: 'FREELANCER',
            avatarUrl: '/avatars/a.png',
          },
          { id: 'other-admin', role: 'ADMIN' },
        ],
        Project: [
          { id: 'own', clientId: 'busy' },
          { id: 'foreign', clientId: 'someone' },
        ],
        Task: [
          { id: 't-own', projectId: 'own', assigneeId: 'busy' },
          { id: 't-foreign', projectId: 'foreign', assigneeId: 'busy' },
        ],
        WorkSubmission: [
          { id: 's1', taskId: 't-foreign', submittedBy: 'busy' },
        ],
        Message: [
          { projectId: 'foreign', senderId: 'busy' },
          { projectId: 'foreign', senderId: 'someone' },
        ],
        ProjectMember: [{ projectId: 'own', userId: 'someone' }],
        ProjectApplication: [
          {
            id: 'app-busy',
            projectId: 'foreign',
            freelancerId: 'busy',
            portfolioItemId: 'p1',
          },
          { id: 'app-own', projectId: 'own', freelancerId: 'someone' },
          { id: 'app-other', projectId: 'foreign', freelancerId: 'someone' },
        ],
        ApplicationMessage: [
          { applicationId: 'app-busy' },
          { applicationId: 'app-own' },
          { applicationId: 'app-other' },
        ],
        PortfolioItem: [{ id: 'p1', userId: 'busy' }],
        AuthSession: [{ userId: 'busy' }, { userId: 'fresh' }],
        FileAttachment: [
          {
            id: 'f1',
            projectId: 'own',
            uploadedBy: 'busy',
            storagePath: 'f1.pdf',
          },
        ],
        StoredFile: [
          { id: 'f1.pdf' },
          { id: 'avatars/a.png' },
          { id: 'someone-else.pdf' },
        ],
      };
    });

    it('removes a user without history completely', async () => {
      await expect(service.remove(admin, 'fresh')).resolves.toMatchObject({
        deleted: true,
      });
      expect(tables.User.find((u) => u.id === 'fresh')).toBeUndefined();
      expect(tables.AuthSession.some((s) => s.userId === 'fresh')).toBe(false);
    });

    it('removes an active user with own projects and every trace, leaving others intact', async () => {
      await expect(service.remove(admin, 'busy')).resolves.toMatchObject({
        deleted: true,
      });
      expect(tables.User.find((u) => u.id === 'busy')).toBeUndefined();
      expect(tables.Project.map((p) => p.id)).toEqual(['foreign']);
      expect(tables.Task).toEqual([
        { id: 't-foreign', projectId: 'foreign', assigneeId: null },
      ]);
      expect(tables.ProjectMember).toHaveLength(0);
      expect(tables.WorkSubmission).toHaveLength(0);
      expect(tables.Message).toEqual([
        { projectId: 'foreign', senderId: 'someone' },
      ]);
      expect(tables.ProjectApplication.map((a) => a.id)).toEqual(['app-other']);
      // Переписка щодо видалених заявок зникає, чужа — лишається
      expect(tables.ApplicationMessage).toEqual([{ applicationId: 'app-other' }]);
      expect(tables.PortfolioItem).toHaveLength(0);
      expect(tables.AuthSession.some((s) => s.userId === 'busy')).toBe(false);
      // Вміст файлів і фото видаляється разом з акаунтом, чужі файли лишаються
      expect(tables.StoredFile).toEqual([{ id: 'someone-else.pdf' }]);
    });

    it('never deletes admins, yourself, or for non-admins', async () => {
      await expect(service.remove(admin, 'other-admin')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.remove(admin, 'admin-id')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.remove({ ...admin, role: 'CLIENT' }, 'fresh'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tables.User).toHaveLength(3);
    });
  });

  it('lists the last months oldest first, across a year boundary', () => {
    expect(lastMonths(3, new Date('2026-01-20T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});

describe('AdminService project moderation', () => {
  const admin = { id: 'admin-id', role: 'ADMIN' } as CurrentUser;
  function setup(status: string) {
    const update = vi.fn(async (data: object) => ({ id: 'p1', ...data }));
    const db = {
      Project: {
        where: vi.fn(() => ({
          first: vi.fn(async () => ({
            id: 'p1',
            clientId: 'client-id',
            title: 'Сайт',
            status,
          })),
          update,
        })),
      },
    };
    const projects = { logActivity: vi.fn(), notify: vi.fn() };
    const service = new AdminService(
      { client: { orm: { public: db } } } as unknown as PrismaService,
      projects as unknown as ProjectsService,
    );
    return { service, update, projects };
  }

  it('approves a project into the marketplace and notifies the client', async () => {
    const { service, update, projects } = setup('MODERATION');
    await service.moderate(admin, 'p1', { decision: 'APPROVE' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PLANNING' }),
    );
    expect(projects.notify).toHaveBeenCalledWith(
      'client-id',
      'admin-id',
      'PROJECT_APPROVED',
      expect.any(String),
      'p1',
    );
  });

  it('rejects with a reason kept in the project history', async () => {
    const { service, update, projects } = setup('MODERATION');
    await service.moderate(admin, 'p1', {
      decision: 'REJECT',
      reason: 'Опишіть обсяг робіт',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REJECTED' }),
    );
    expect(projects.logActivity).toHaveBeenCalledWith(
      'admin-id',
      'p1',
      'PROJECT_REJECTED',
      'Опишіть обсяг робіт',
    );
  });

  it('refuses projects outside the queue and non-admins', async () => {
    const { service, update } = setup('PLANNING');
    await expect(
      service.moderate(admin, 'p1', { decision: 'APPROVE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.moderate({ ...admin, role: 'CLIENT' }, 'p1', {
        decision: 'APPROVE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });
});
