import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

// Лічильники біля розмов: рахуємо лише непрочитані повідомлення, і читаємо лише відкриту розмову
describe('unread messages per conversation', () => {
  const rows = () => [
    {
      id: 'n1',
      type: 'NEW_MESSAGE',
      projectId: 'p1',
      applicationId: null,
      readAt: null,
    },
    {
      id: 'n2',
      type: 'NEW_MESSAGE',
      projectId: 'p1',
      applicationId: null,
      readAt: null,
    },
    {
      id: 'n3',
      type: 'NEW_MESSAGE',
      projectId: 'p2',
      applicationId: null,
      readAt: new Date(),
    },
    {
      id: 'n4',
      type: 'APPLICATION_MESSAGE',
      projectId: null,
      applicationId: 'a1',
      readAt: null,
    },
    {
      id: 'n5',
      type: 'WORK_SUBMITTED',
      projectId: 'p1',
      applicationId: null,
      readAt: null,
    },
  ];
  let read: string[];
  function service() {
    const all = rows();
    const Notification = {
      where: (filter: { id?: string }) => ({
        all: async () => all,
        update: async () => {
          read.push(filter.id!);
          return null;
        },
      }),
    };
    return new NotificationsService({
      client: { orm: { public: { Notification } } },
    } as unknown as PrismaService);
  }
  beforeEach(() => {
    read = [];
  });

  it('counts unread messages by project and by application', async () => {
    await expect(service().unreadChats('u1')).resolves.toEqual({
      projects: { p1: 2 },
      applications: { a1: 1 },
    });
  });

  it('marks only the opened conversation as read', async () => {
    await service().readChat('u1', { projectId: 'p1' });
    expect(read).toEqual(['n1', 'n2']);
    read = [];
    await service().readChat('u1', { applicationId: 'a1' });
    expect(read).toEqual(['n4']);
  });
});
