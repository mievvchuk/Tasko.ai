import {
  fitPlanDeadlines,
  milestoneDeadline,
  parseProjectPlan,
  projectPlanSchema,
} from '../../../src/agent/project-plan.js';

const plan = {
  milestones: [
    {
      title: 'Підготовка',
      description: 'Погодити вимоги',
      acceptanceCriteria: ['Замовник погодив вимоги'],
      tasks: [
        {
          title: 'Зібрати вимоги',
          description: 'Описати сценарії',
          priority: 'HIGH',
          amount: 1500,
          acceptanceCriteria: ['Сценарії задокументовано'],
        },
      ],
    },
  ],
};

describe('project plan validation', () => {
  it('accepts a complete plan and trims titles', () => {
    const input = structuredClone(plan);
    input.milestones[0].title = '  Підготовка  ';
    expect(parseProjectPlan(JSON.stringify(input)).milestones[0].title).toBe(
      'Підготовка',
    );
  });
  it('rejects truncated JSON, empty plans and unsupported fields', () => {
    for (const value of [
      '{',
      '{"milestones":[]}',
      JSON.stringify({ ...plan, projectId: 'another-project' }),
    ]) {
      expect(() => parseProjectPlan(value)).toThrow();
    }
  });
  it('requires acceptance criteria and bounds the amount of generated work', () => {
    const input = structuredClone(plan);
    input.milestones[0].tasks[0].acceptanceCriteria = [];
    expect(projectPlanSchema.safeParse(input).success).toBe(false);
    expect(
      projectPlanSchema.safeParse({
        milestones: Array(7).fill(plan.milestones[0]),
      }).success,
    ).toBe(false);
  });
  it('rejects unexpected priority and oversized task descriptions', () => {
    for (const patch of [
      { priority: 'URGENT' },
      { description: 'x'.repeat(3001) },
    ]) {
      const input = structuredClone(plan);
      Object.assign(input.milestones[0].tasks[0], patch);
      expect(projectPlanSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('plan deadlines', () => {
  const plan = (deadline: string | null) => ({
    milestones: [{ tasks: [{ deadline }, { deadline: '2026-12-20' }] }],
  });
  const today = new Date('2026-11-15T10:00:00Z');

  it('moves past dates to today and late dates to the project deadline', () => {
    const fitted = fitPlanDeadlines(
      plan('2026-01-01'),
      today,
      new Date('2026-12-10T00:00:00Z'),
    );
    expect(fitted.milestones[0].tasks.map((task) => task.deadline)).toEqual([
      '2026-11-15',
      '2026-12-10',
    ]);
  });

  it('takes the latest task deadline as the milestone deadline', () => {
    expect(milestoneDeadline(plan('2026-11-30').milestones[0])).toEqual(
      new Date('2026-12-20T00:00:00Z'),
    );
    expect(milestoneDeadline({ tasks: [{ deadline: null }] })).toBeNull();
  });

  it('rejects a date that does not exist', () => {
    const base = {
      title: 'Етап',
      description: 'Опис етапу',
      acceptanceCriteria: ['Готово'],
    };
    const task = { ...base, priority: 'LOW', amount: 0, rating: 2 };
    expect(
      projectPlanSchema.safeParse({
        milestones: [{ ...base, tasks: [{ ...task, deadline: '2026-02-30' }] }],
      }).success,
    ).toBe(false);
  });
});
