import { ConflictException } from '@nestjs/common';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';
import { TasksService } from '../../../src/tasks/tasks.service.js';

describe('orders', () => {
  const client = { id: 'client-id', role: 'CLIENT' } as CurrentUser;
  let order: Record<string, unknown>;
  let taskRows: { status: string }[];
  const taskWhere = vi.fn(() => ({
    select: () => ({ all: async () => taskRows }),
  }));
  const update = vi.fn(async (data: object) => ({ ...order, ...data }));
  const db = {
    Order: { where: vi.fn(() => ({ first: async () => order, update })) },
    Task: { where: taskWhere },
  };
  const projects = {
    prisma: { client: { orm: { public: db } } },
    requireOwner: vi.fn(async () => ({ status: 'ACTIVE' })),
    ensureWritable: vi.fn(),
  };
  const tasks = new TasksService(projects as unknown as ProjectsService);

  beforeEach(() => {
    vi.clearAllMocks();
    order = {
      id: 'order-id',
      projectId: 'project-id',
      freelancerId: 'freelancer-id',
      status: 'IN_PROGRESS',
    };
    taskRows = [{ status: 'DONE' }];
  });

  it("completes a deal once that freelancer's tasks are accepted", async () => {
    await tasks.updateOrder(client, 'order-id', 'COMPLETED');
    expect(taskWhere).toHaveBeenCalledWith({
      projectId: 'project-id',
      assigneeId: 'freelancer-id',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });

  it('refuses to complete while the freelancer has open tasks', async () => {
    taskRows = [{ status: 'REVIEW' }];
    await expect(
      tasks.updateOrder(client, 'order-id', 'COMPLETED'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('checks the whole project for old orders without a freelancer', async () => {
    order.freelancerId = null;
    await tasks.updateOrder(client, 'order-id', 'COMPLETED');
    expect(taskWhere).toHaveBeenCalledWith({ projectId: 'project-id' });
  });

  it('does not reopen a finished deal', async () => {
    order.status = 'COMPLETED';
    await expect(
      tasks.updateOrder(client, 'order-id', 'IN_PROGRESS'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
