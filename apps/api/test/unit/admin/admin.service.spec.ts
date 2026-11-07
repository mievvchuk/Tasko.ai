import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { hashPassword } from '../../../src/auth/password.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
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
    { id: 'p1', status: 'ACTIVE', createdAt: new Date(now.getTime() - 10 * hour) },
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
  };
  const prisma = { client: { orm: { public: db } } };
  const service = new AdminService(prisma as unknown as PrismaService);

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
    const service = new AdminService({
      client: {
        orm: { public: { User } },
        transaction: (run: (t: typeof tx) => unknown) => run(tx),
      },
    } as unknown as PrismaService);

    beforeAll(async () => {
      people.admin = {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'ADMIN',
        passwordHash: await hashPassword('Admin-pass-123'),
        twoFactorEnabled: false,
      };
      people.other = { id: 'other-admin', email: 'o@example.com', role: 'ADMIN' };
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
        service.createAdmin(admin, { ...data, email: 'o@example.com', currentPassword: 'Admin-pass-123' }),
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

  it('lists the last months oldest first, across a year boundary', () => {
    expect(lastMonths(3, new Date('2026-01-20T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});
