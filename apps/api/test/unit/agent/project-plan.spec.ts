import {
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
  it('accepts budget and deadlines from the owner, null meaning not decided', () => {
    const input = structuredClone(plan) as Record<string, any>;
    Object.assign(input.milestones[0], {
      amount: 5000,
      deadline: '2026-12-01T21:59:59.000Z',
    });
    input.milestones[0].tasks[0].deadline = null;
    expect(projectPlanSchema.safeParse(input).success).toBe(true);
    for (const patch of [
      { amount: -1 },
      { amount: 1.5 },
      { deadline: 'завтра' },
    ]) {
      const bad = structuredClone(input);
      Object.assign(bad.milestones[0], patch);
      expect(projectPlanSchema.safeParse(bad).success).toBe(false);
    }
  });
});
