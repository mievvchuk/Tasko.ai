import { BadGatewayException } from '@nestjs/common';
import { z } from 'zod';

// Верхня межа однієї суми, щоб опечатка на кшталт зайвих нулів не пройшла
export const maxPlanAmount = 100_000_000;
const text = (max: number) => z.string().trim().min(2).max(max);
const criteria = z.array(text(400)).min(1).max(6);
// Дата у форматі YYYY-MM-DD, яка справді існує в календарі
const planDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => toDate(value).toISOString().slice(0, 10) === value);
const taskSchema = z
  .object({
    title: text(200),
    description: text(3000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    // Вартість завдання в гривнях; сума етапу — це сума його завдань
    amount: z.number().int().min(0).max(maxPlanAmount),
    // Рейтинг завдання 1–5 (важливість для замовника) і дедлайн; обидва можна змінити в чернетці
    rating: z.number().int().min(1).max(5).nullable().default(null),
    deadline: planDate.nullable().default(null),
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
              required: ['title', 'description', 'priority', 'amount', 'rating', 'deadline', 'acceptanceCriteria'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                amount: { type: 'integer' },
                rating: { type: 'integer', enum: [1, 2, 3, 4, 5] },
                deadline: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
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
    return projectPlanSchema.parse(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()));
  } catch {
    throw new BadGatewayException('AI повернув некоректний або неповний план. Спробуйте ще раз.');
  }
}

type PlanAmounts = { milestones: { tasks: { amount: number }[] }[] };

export function milestoneAmount(milestone: { tasks: { amount: number }[] }) {
  return milestone.tasks.reduce((sum, task) => sum + task.amount, 0);
}

export function planTotal(plan: PlanAmounts) {
  return plan.milestones.reduce((sum, milestone) => sum + milestoneAmount(milestone), 0);
}

// Модель може помилитись в арифметиці, тож межу гарантуємо самі: якщо сума
// перевищує доступний бюджет, пропорційно зменшуємо вартість кожного завдання
// (округлюючи вниз до 10 грн), щоб разом вийшло не більше бюджету.
export function fitPlanToBudget<T extends PlanAmounts>(plan: T, limit: number | null): T {
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

export function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// Модель може поставити дату в минулому або після дедлайну проєкту: підтягуємо
// кожен дедлайн у межі [сьогодні; дедлайн проєкту].
export function fitPlanDeadlines<T extends { milestones: { tasks: { deadline: string | null }[] }[] }>(
  plan: T,
  today: Date,
  projectDeadline: Date | null,
): T {
  const min = isoDay(today);
  const max = projectDeadline ? isoDay(projectDeadline) : null;
  const clamp = (value: string | null) => {
    if (!value) return max;
    if (value < min) return max && max < min ? max : min;
    return max && value > max ? max : value;
  };
  return {
    ...plan,
    milestones: plan.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) => ({
        ...task,
        deadline: clamp(task.deadline),
      })),
    })),
  };
}

// Дедлайн етапу — найпізніший дедлайн його завдань
export function milestoneDeadline(milestone: { tasks: { deadline: string | null }[] }) {
  const dates = milestone.tasks.map((task) => task.deadline).filter(Boolean) as string[];
  return dates.length ? toDate(dates.sort().at(-1)!) : null;
}

export function planDescription(description: string, acceptanceCriteria: string[], amount?: number) {
  const cost = amount === undefined ? '' : `\n\nВартість: ${amount} грн`;
  return `${description}${cost}\n\nКритерії приймання:\n${acceptanceCriteria.map((item) => `• ${item}`).join('\n')}`;
}
