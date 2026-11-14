import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ComplaintsService } from '../../../src/complaints/complaints.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';

// Рішення по скарзі: санкція лягає на порушника, обидві сторони отримують сповіщення
describe('ComplaintsService.decide', () => {
  const admin = { id: 'admin', role: 'ADMIN' } as CurrentUser;
  let userUpdates: Record<string, unknown>[];
  let complaintUpdate: Record<string, unknown> | null;
  let notify: ReturnType<typeof vi.fn>;
  let target: { id: string; role: string };

  function service(complaint: Record<string, unknown>) {
    const users = {
      where: () => ({
        first: async () => target,
        update: async (row: Record<string, unknown>) => {
          userUpdates.push(row);
          return row;
        },
      }),
    };
    const complaints = {
      where: () => ({
        first: async () => complaint,
        updateAll: async (row: Record<string, unknown>) => {
          complaintUpdate = row;
          return [row];
        },
      }),
    };
    const orm = { public: { User: users, Complaint: complaints } };
    return new ComplaintsService(
      {
        client: {
          orm,
          transaction: (run: (tx: { orm: typeof orm }) => unknown) =>
            run({ orm }),
        },
      } as unknown as PrismaService,
      { notify } as unknown as ProjectsService,
    );
  }
  const open = {
    id: 'c1',
    status: 'OPEN',
    reason: 'Не оплатив роботу',
    reporterId: 'freelancer',
    targetUserId: 'client',
    projectId: 'p1',
  };

  beforeEach(() => {
    userUpdates = [];
    complaintUpdate = null;
    notify = vi.fn();
    target = { id: 'client', role: 'CLIENT' };
  });

  it('restricts the offender for the given days and notifies both sides', async () => {
    await service(open).decide(admin, 'c1', {
      status: 'RESOLVED',
      adminNote: 'Підтверджено неоплату',
      action: 'RESTRICT',
      restrictDays: 14,
    });
    const until = userUpdates[0].restrictedUntil as Date;
    const days = Math.round((until.getTime() - Date.now()) / 86400000);
    expect(days).toBe(14);
    expect(userUpdates[0].restrictionReason).toBe('Підтверджено неоплату');
    expect(complaintUpdate).toMatchObject({
      action: 'RESTRICT',
      restrictDays: 14,
    });
    expect(notify.mock.calls.map((call) => call[0])).toEqual([
      'freelancer',
      'client',
    ]);
  });

  it('blocks with the decision as the block reason', async () => {
    await service(open).decide(admin, 'c1', {
      status: 'RESOLVED',
      adminNote: 'Шахрайство підтверджено',
      action: 'BLOCK',
    });
    expect(userUpdates[0]).toMatchObject({
      status: 'BLOCKED',
      blockReason: 'Шахрайство підтверджено',
    });
  });

  it('applies no sanction when the complaint is rejected', async () => {
    await service(open).decide(admin, 'c1', {
      status: 'REJECTED',
      adminNote: 'Доказів немає',
      action: 'BLOCK',
    });
    expect(userUpdates).toEqual([]);
    expect(complaintUpdate).toMatchObject({ action: 'NONE' });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('refuses sanctions without a target user or against an admin', async () => {
    await expect(
      service({ ...open, targetUserId: null }).decide(admin, 'c1', {
        status: 'RESOLVED',
        adminNote: 'Порушення в проєкті',
        action: 'WARNING',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    target = { id: 'client', role: 'ADMIN' };
    await expect(
      service(open).decide(admin, 'c1', {
        status: 'RESOLVED',
        adminNote: 'Порушення',
        action: 'WARNING',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
