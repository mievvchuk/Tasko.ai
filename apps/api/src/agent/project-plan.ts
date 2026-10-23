import { BadGatewayException } from '@nestjs/common';
import { z } from 'zod';

const text = (max: number) => z.string().trim().min(2).max(max);
const criteria = z.array(text(400)).min(1).max(6);
const taskSchema = z
  .object({
    title: text(200),
    description: text(3000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
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

export function planDescription(
  description: string,
  acceptanceCriteria: string[],
) {
  return `${description}\n\nКритерії приймання:\n${acceptanceCriteria.map((item) => `• ${item}`).join('\n')}`;
}
