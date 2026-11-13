import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';

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

  it('counts and marks message notifications separately', async () => {
    const items = [
      {
        id: 'm1',
        userId: 'u',
        type: 'NEW_MESSAGE',
        readAt: null,
        createdAt: new Date(),
      },
      {
        id: 'm2',
        userId: 'u',
        type: 'APPLICATION_MESSAGE',
        readAt: null,
        createdAt: new Date(),
      },
      {
        id: 't1',
        userId: 'u',
        type: 'TASK_ASSIGNED',
        readAt: null,
        createdAt: new Date(),
      },
    ];
    const update = vi.fn();
    const where = vi.fn((filter: { id?: string }) => ({
      orderBy: () => ({ all: async () => items }),
      all: async () => items,
      update: (data: unknown) => update(filter.id, data),
    }));
    const prisma = { client: { orm: { public: { Notification: { where } } } } };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
    );
    const list = await service.list('u', 1, 1);
    expect(list.unreadCount).toBe(3);
    expect(list.unreadMessages).toBe(2);
    await expect(
      service.readAll('u', ['NEW_MESSAGE', 'APPLICATION_MESSAGE']),
    ).resolves.toEqual({ updated: 2 });
    expect(update.mock.calls.map(([id]) => id)).toEqual(['m1', 'm2']);
  });
});
