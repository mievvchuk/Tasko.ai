import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUser } from '../users/users.service.js';
import { AdminService, lastMonths } from './admin.service.js';

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
  const projectRows = [
    { status: 'ACTIVE', createdAt: now },
    { status: 'COMPLETED', createdAt: now },
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
    expect(report.growth.at(-1)).toMatchObject({ users: 1, projects: 2 });
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

  it('lists the last months oldest first, across a year boundary', () => {
    expect(lastMonths(3, new Date('2026-01-20T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});
