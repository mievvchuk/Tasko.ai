import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  it('does not allow reading another user notification', async () => {
    const query = { first: vi.fn(async () => ({ id: 'n1', userId: 'other' })) };
    const prisma = {
      client: {
        orm: { public: { Notification: { where: vi.fn(() => query) } } },
      },
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
    );
    await expect(service.read('user', 'n1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
