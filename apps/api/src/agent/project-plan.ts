import { BadGatewayException } from '@nestjs/common';
import { z } from 'zod';

// Верхня межа однієї суми, щоб опечатка на кшталт зайвих нулів не пройшла
export const maxPlanAmount = 100_000_000;
const text = (max: number) => z.string().trim().min(2).max(max);
const criteria = z.array(text(400)).min(1).max(6);
const taskSchema = z
  .object({
    title: text(200),
    description: text(3000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    // Вартість завдання в гривнях; сума етапу — це сума його завдань
    amount: z.number().int().min(0).max(maxPlanAmount),
    acceptanceCriteria: criteria,
  })
  .strict();

export const projectPlanSchema = z
  .object({
    milestones: z
      .array(
        z
          .object({
            title: text(200),
            description: text(3000),
            acceptanceCriteria: criteria,
            tasks: z.array(taskSchema).min(1).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();

export type ProjectPlan = z.infer<typeof projectPlanSchema>;

// JSON Schema для режиму structured output провайдера: модель зобов'язана
// повернути саме таку структуру. Обмеження довжин і кількостей перевіряє zod вище.
const criteriaJsonSchema = { type: 'array', items: { type: 'string' } };
export const projectPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['milestones'],
  properties: {
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'acceptanceCriteria', 'tasks'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          acceptanceCriteria: criteriaJsonSchema,
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'title',
                'description',
                'priority',
                'amount',
                'acceptanceCriteria',
              ],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                amount: { type: 'integer' },
                acceptanceCriteria: criteriaJsonSchema,
              },
            },
          },
        },
      },
    },
  },
};

export function parseProjectPlan(content: string): ProjectPlan {
  try {
    return projectPlanSchema.parse(
      JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()),
    );
  } catch {
    throw new BadGatewayException(
      'AI повернув некоректний або неповний план. Спробуйте ще раз.',
    );
  }
}

type PlanAmounts = { milestones: { tasks: { amount: number }[] }[] };

export function milestoneAmount(milestone: { tasks: { amount: number }[] }) {
  return milestone.tasks.reduce((sum, task) => sum + task.amount, 0);
}

export function planTotal(plan: PlanAmounts) {
  return plan.milestones.reduce(
    (sum, milestone) => sum + milestoneAmount(milestone),
    0,
  );
}

// Модель може помилитись в арифметиці, тож межу гарантуємо самі: якщо сума
// перевищує доступний бюджет, пропорційно зменшуємо вартість кожного завдання
// (округлюючи вниз до 10 грн), щоб разом вийшло не більше бюджету.
export function fitPlanToBudget<T extends PlanAmounts>(
  plan: T,
  limit: number | null,
): T {
  const total = planTotal(plan);
  if (limit === null || total <= limit) return plan;
  const ratio = limit / total;
  return {
    ...plan,
    milestones: plan.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) => ({
        ...task,
        amount: Math.floor((task.amount * ratio) / 10) * 10,
      })),
    })),
  };
}

export function planDescription(
  description: string,
  acceptanceCriteria: string[],
  amount?: number,
) {
  const cost = amount === undefined ? '' : `\n\nВартість: ${amount} грн`;
  return `${description}${cost}\n\nКритерії приймання:\n${acceptanceCriteria.map((item) => `• ${item}`).join('\n')}`;
}
