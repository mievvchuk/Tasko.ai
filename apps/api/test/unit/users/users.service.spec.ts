import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { UsersService, type CurrentUser } from '../../../src/users/users.service.js';

const client: CurrentUser = {
  id: 'client-id',
  name: 'Client',
  email: 'client@example.com',
  role: 'CLIENT',
  sessionId: 'session-id',
  twoFactorEnabled: false,
};

describe('UsersService freelancer profile', () => {
  it('rejects profile editing by a client', async () => {
    const service = new UsersService({} as PrismaService);
    await expect(
      service.updateFreelancerProfile(client, {
        bio: 'Опис',
        hourlyRate: 500,
        availability: 'AVAILABLE',
        skills: ['TypeScript'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UsersService role choice', () => {
  const found = (value: unknown) => ({ first: async () => value });
  const prisma = (existing: { project?: unknown; update?: () => unknown }) =>
    ({
      client: {
        orm: {
          public: {
            Project: { where: () => found(existing.project ?? null) },
            ProjectApplication: { where: () => found(null) },
            ProjectMember: { where: () => found(null) },
            User: {
              where: () => ({
                update: async (data: { role: string }) => {
                  existing.update?.();
                  return { ...client, ...data, avatarUrl: null, createdAt: new Date() };
                },
              }),
            },
          },
        },
      },
    }) as unknown as PrismaService;

  it('switches a new client to freelancer', async () => {
    const service = new UsersService(prisma({}));
    const user = await service.updateRole(client, { role: 'FREELANCER' });
    expect(user.role).toBe('FREELANCER');
  });

  it('refuses once the user has a project', async () => {
    const update = vi.fn();
    const service = new UsersService(prisma({ project: { id: 'p' }, update }));
    await expect(
      service.updateRole(client, { role: 'FREELANCER' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('never changes an admin', async () => {
    const service = new UsersService({} as PrismaService);
    await expect(
      service.updateRole({ ...client, role: 'ADMIN' }, { role: 'CLIENT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
