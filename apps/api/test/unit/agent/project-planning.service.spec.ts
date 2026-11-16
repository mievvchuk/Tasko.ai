import { ForbiddenException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectPlanningService } from '../../../src/agent/project-planning.service.js';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { AgentService } from '../../../src/agent/agent.service.js';

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
  budgetMin: 5000,
  budgetMax: 10000,
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
          amount: 3000,
          rating: 5,
          deadline: null,
          acceptanceCriteria: ['Сторінка адаптивна'],
        },
        {
          title: 'Контакти',
          description: 'Форма зворотного звʼязку',
          priority: 'LOW',
          amount: 1000,
          rating: 3,
          deadline: null,
          acceptanceCriteria: ['Форма надсилає лист'],
        },
      ],
    },
  ],
};

describe('project planning permissions and persistence', () => {
  function setup() {
    const activities: Record<string, unknown>[] = [];
    const tasks: Record<string, unknown>[] = [];
    const milestones: Record<string, unknown>[] = [
      {
        id: 'paid',
        projectId: project.id,
        position: 4,
        amount: 2000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      },
    ];
    const applications: Record<string, unknown>[] = [];
    const matches = (row: Record<string, unknown>, query: object) => Object.entries(query).every(([key, value]) => row[key] === value);
    // Простий двійник таблиці: where(...) з all/first/delete/deleteAll
    const table = (rows: Record<string, unknown>[]) => ({
      where: vi.fn((query: object) => ({
        all: vi.fn(async () => rows.filter((row) => matches(row, query))),
        first: vi.fn(async () => rows.find((row) => matches(row, query)) ?? null),
        delete: vi.fn(async () => {
          rows.splice(
            rows.findIndex((row) => matches(row, query)),
            1,
          );
        }),
        deleteAll: vi.fn(async () => undefined),
        updateAll: vi.fn(async (patch: object) => {
          for (const row of rows.filter((row) => matches(row, query))) Object.assign(row, patch);
        }),
      })),
      create: vi.fn(async (row: Record<string, unknown>) => {
        rows.push(row);
        return row;
      }),
    });
    const db = {
      Project: {
        where: vi.fn(() => ({
          update: vi.fn(),
          first: vi.fn(async () => project),
        })),
      },
      ActivityLog: {
        where: vi.fn((query: { id: string }) => ({
          first: vi.fn(async () => activities.find((row) => row.id === query.id) ?? null),
        })),
        create: vi.fn(async (row: Record<string, unknown>) => {
          activities.push(row);
          return row;
        }),
      },
      ProjectMilestone: table(milestones),
      ProjectApplication: table(applications),
      Task: table(tasks),
      Notification: table([]),
      WorkSubmission: table([]),
    };
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ orm: { public: db } }));
    const projects = {
      requireOwner: vi.fn(async () => project),
      ensureWritable: vi.fn((item: { status: string }) => {
        if (item.status === 'COMPLETED') throw new ConflictException();
      }),
      prisma: { client: { orm: { public: db }, transaction } },
    };
    const agent = { generateProjectPlan: vi.fn(async () => plan) };
    const service = new ProjectPlanningService(projects as unknown as ProjectsService, agent as unknown as AgentService);
    return {
      activities,
      tasks,
      milestones,
      applications,
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
      // бюджет проєкту мінус уже розподілене в наявних етапах
      budget: 8000,
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('blocks generation and saving for someone who is not the owner', async () => {
    const { service, projects, agent, transaction } = setup();
    projects.requireOwner.mockRejectedValue(new ForbiddenException());
    await expect(service.generate(user, project.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.apply(user, project.id, randomUUID(), plan)).rejects.toMatchObject({ status: 403 });
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
      amount: 4000,
      paymentStatus: 'UNPAID',
    });
    expect(tasks[0]).toMatchObject({
      projectId: project.id,
      assigneeId: null,
      status: 'TODO',
      priority: 'HIGH',
    });
    expect(tasks[0].description).toContain('Сторінка адаптивна');
    // Завдання прив'язане до свого етапу, а не лише згадує його в описі
    expect(tasks[0].milestoneId).toBe(milestones[1].id);
    expect(tasks[0].description).toContain('Вартість: 3000 грн');
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
    expect(tasks).toHaveLength(2);
    expect(milestones).toHaveLength(2);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects an invalid plan before performing any write', async () => {
    const { service, transaction } = setup();
    await expect(service.apply(user, project.id, randomUUID(), { milestones: [] })).rejects.toMatchObject({
      status: 400,
    });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('refuses a project closed before saving', async () => {
    const { service, projects, transaction } = setup();
    projects.requireOwner.mockResolvedValueOnce({
      ...project,
      status: 'COMPLETED',
    });
    await expect(service.apply(user, project.id, randomUUID(), plan)).rejects.toMatchObject({ status: 409 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('propagates storage failures instead of reporting a saved plan', async () => {
    const { service, db } = setup();
    db.Task.create.mockRejectedValueOnce(new Error('write failed'));
    await expect(service.apply(user, project.id, randomUUID(), plan)).rejects.toThrow('write failed');
  });
  it('keeps the plan within the budget of an accepted freelancer bid', async () => {
    const { service, applications, agent, transaction } = setup();
    applications.push({
      projectId: project.id,
      status: 'ACCEPTED',
      proposedBudget: 3000,
    });
    // Фрілансер погодився на 3000 грн, 2000 з них уже в оплаченому етапі; AI запропонував 4000 — суми зменшуються пропорційно
    const draft = await service.generate(user, project.id, '', true);
    expect(agent.generateProjectPlan).toHaveBeenCalledWith(expect.objectContaining({ budget: 1000 }));
    const amounts = draft.milestones[0].tasks.map((task) => task.amount);
    expect(amounts).toEqual([750, 250]);
    await expect(service.apply(user, project.id, randomUUID(), plan, true)).rejects.toMatchObject({ status: 400 });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('replaces only milestones that were not started, with their untouched plan tasks', async () => {
    const { service, milestones, tasks } = setup();
    milestones.push({
      id: 'old',
      projectId: project.id,
      title: 'Старий етап',
      position: 5,
      amount: 1000,
      status: 'PLANNED',
      paymentStatus: 'UNPAID',
    });
    tasks.push(
      {
        id: 'old-task',
        projectId: project.id,
        status: 'TODO',
        assigneeId: null,
        description: 'Етап: Старий етап\n\nЗробити',
      },
      {
        id: 'taken',
        projectId: project.id,
        status: 'IN_PROGRESS',
        assigneeId: 'f1',
        description: 'Етап: Старий етап\n\nЗробити',
      },
      {
        id: 'linked',
        projectId: project.id,
        milestoneId: 'old',
        status: 'TODO',
        assigneeId: null,
        description: 'Зробити',
      },
      {
        id: 'assigned',
        projectId: project.id,
        milestoneId: 'old',
        status: 'TODO',
        assigneeId: 'f1',
        description: 'Зробити',
      },
    );
    await service.apply(user, project.id, randomUUID(), plan, true);
    // Невзяте завдання етапу видаляється, призначене — лишається без етапу
    expect(tasks.map((task) => task.id)).not.toContain('linked');
    expect(tasks.find((task) => task.id === 'assigned')).toMatchObject({
      milestoneId: null,
    });
    expect(milestones.map((item) => item.id ?? item.title)).toEqual(['paid', expect.any(String)]);
    expect(milestones[1]).toMatchObject({ title: 'Розробка', position: 5 });
    expect(tasks.map((task) => task.id)).toContain('taken');
    expect(tasks.map((task) => task.id)).not.toContain('old-task');
  });
});
