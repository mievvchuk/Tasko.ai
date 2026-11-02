import { ForbiddenException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectPlanningService } from './project-planning.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { AgentService } from './agent.service.js';

const user = {
  id: randomUUID(),
  role: 'CLIENT' as const,
  email: 'test@example.com',
  name: 'Test',
  sessionId: randomUUID(),
  twoFactorEnabled: false,
};
const project = {
  id: randomUUID(),
  clientId: user.id,
  title: 'Сайт',
  description: 'Створити портфоліо',
  deadline: null,
  status: 'ACTIVE',
};
const plan = {
  milestones: [
    {
      title: 'Розробка',
      description: 'Створити сайт',
      acceptanceCriteria: ['Сайт доступний'],
      tasks: [
        {
          title: 'Головна сторінка',
          description: 'Реалізувати головну',
          priority: 'HIGH',
          acceptanceCriteria: ['Сторінка адаптивна'],
        },
      ],
    },
  ],
};

describe('project planning permissions and persistence', () => {
  function setup() {
    const activities: Record<string, unknown>[] = [];
    const tasks: Record<string, unknown>[] = [];
    const milestones: Record<string, unknown>[] = [{ position: 4 }];
    const db = {
      Project: {
        where: vi.fn(() => ({
          update: vi.fn(),
          first: vi.fn(async () => project),
        })),
      },
      ActivityLog: {
        where: vi.fn((query: { id: string }) => ({
          first: vi.fn(
            async () => activities.find((row) => row.id === query.id) ?? null,
          ),
        })),
        create: vi.fn(async (row: Record<string, unknown>) => {
          activities.push(row);
          return row;
        }),
      },
      ProjectMilestone: {
        where: vi.fn(() => ({ all: vi.fn(async () => [...milestones]) })),
        create: vi.fn(async (row: Record<string, unknown>) => {
          milestones.push(row as { position: number });
          return row;
        }),
      },
      Task: {
        create: vi.fn(async (row: Record<string, unknown>) => {
          tasks.push(row);
          return row;
        }),
      },
    };
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ orm: { public: db } }),
    );
    const projects = {
      requireOwner: vi.fn(async () => project),
      ensureWritable: vi.fn((item: { status: string }) => {
        if (item.status === 'COMPLETED') throw new ConflictException();
      }),
      prisma: { client: { orm: { public: db }, transaction } },
    };
    const agent = { generateProjectPlan: vi.fn(async () => plan) };
    const service = new ProjectPlanningService(
      projects as unknown as ProjectsService,
      agent as unknown as AgentService,
    );
    return {
      activities,
      tasks,
      milestones,
      db,
      transaction,
      projects,
      agent,
      service,
    };
  }
  it('generates only a draft from the selected project without writing to the database', async () => {
    const { service, agent, transaction } = setup();
    expect(await service.generate(user, project.id, 'MVP')).toEqual(plan);
    expect(agent.generateProjectPlan).toHaveBeenCalledWith({
      title: project.title,
      description: project.description,
      deadline: null,
      instructions: 'MVP',
    });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('blocks generation and saving for someone who is not the owner', async () => {
    const { service, projects, agent, transaction } = setup();
    projects.requireOwner.mockRejectedValue(new ForbiddenException());
    await expect(service.generate(user, project.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.apply(user, project.id, randomUUID(), plan),
    ).rejects.toMatchObject({ status: 403 });
    expect(agent.generateProjectPlan).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('appends milestones and unassigned tasks with acceptance criteria in one transaction', async () => {
    const { service, tasks, milestones, activities, transaction } = setup();
    const result = await service.apply(user, project.id, randomUUID(), plan);
    expect(result).toEqual({ applied: true, alreadyApplied: false });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(milestones[1]).toMatchObject({
      position: 5,
      amount: 0,
      paymentStatus: 'UNPAID',
    });
    expect(tasks[0]).toMatchObject({
      projectId: project.id,
      assigneeId: null,
      status: 'TODO',
      priority: 'HIGH',
    });
    expect(tasks[0].description).toContain('Сторінка адаптивна');
    expect(tasks[0].description).toContain('Етап: Розробка');
    expect(activities[0]).toMatchObject({
      actorId: user.id,
      type: 'AI_PLAN_APPLIED',
    });
  });
  it('does not duplicate the same confirmed plan when the client retries', async () => {
    const { service, tasks, milestones, transaction } = setup();
    const id = randomUUID();
    await service.apply(user, project.id, id, plan);
    expect(await service.apply(user, project.id, id, plan)).toMatchObject({
      alreadyApplied: true,
    });
    expect(tasks).toHaveLength(1);
    expect(milestones).toHaveLength(2);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects an invalid plan before performing any write', async () => {
    const { service, transaction } = setup();
    await expect(
      service.apply(user, project.id, randomUUID(), { milestones: [] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('refuses a project closed before saving', async () => {
    const { service, projects, transaction } = setup();
    projects.requireOwner.mockResolvedValueOnce({
      ...project,
      status: 'COMPLETED',
    });
    await expect(
      service.apply(user, project.id, randomUUID(), plan),
    ).rejects.toMatchObject({ status: 409 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('propagates storage failures instead of reporting a saved plan', async () => {
    const { service, db } = setup();
    db.Task.create.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      service.apply(user, project.id, randomUUID(), plan),
    ).rejects.toThrow('write failed');
  });
});
