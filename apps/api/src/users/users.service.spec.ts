import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService, type CurrentUser } from './users.service.js';

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
