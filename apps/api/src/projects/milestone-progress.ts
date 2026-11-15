import { randomUUID } from 'node:crypto';
import { announce } from '../notifications/notification-events.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService['client']['orm']['public'];
type MilestoneStatus = 'PLANNED' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';

// Етап — це оплата частинами за його завдання, тож статус етапу випливає із завдань:
// жодне не почате → «Заплановано», щось у роботі → «У процесі»,
// усі виконані → «На перевірці» (замовник приймає етап і позначає оплату).
// Прийнятий етап («Завершено») більше не змінюється.
export function milestoneStatusFor(
  current: string,
  taskStatuses: string[],
): MilestoneStatus {
  if (current === 'COMPLETED') return 'COMPLETED';
  if (taskStatuses.length && taskStatuses.every((status) => status === 'DONE'))
    return 'REVIEW';
  if (taskStatuses.some((status) => status !== 'TODO')) return 'IN_PROGRESS';
  return 'PLANNED';
}

// Перераховує статус етапів після зміни їхніх завдань. Коли етап стає готовим
// до приймання, замовник отримує сповіщення.
export async function syncMilestones(
  db: Db,
  milestoneIds: (string | null | undefined)[],
) {
  for (const id of new Set(milestoneIds.filter(Boolean) as string[])) {
    const milestone = await db.ProjectMilestone.where({ id }).first();
    if (!milestone) continue;
    const tasks = await db.Task.where({ milestoneId: id }).all();
    const next = milestoneStatusFor(
      milestone.status,
      tasks.map((task) => task.status),
    );
    if (next === milestone.status) continue;
    // Умова на попередній статус: паралельна зміна не перезапише нову
    const updated = await db.ProjectMilestone.where({
      id,
      status: milestone.status,
    }).update({ status: next, updatedAt: new Date() });
    if (!updated || next !== 'REVIEW') continue;
    const project = await db.Project.where({ id: milestone.projectId }).first();
    if (!project) continue;
    announce(project.clientId);
    await db.Notification.create({
      id: randomUUID(),
      userId: project.clientId,
      type: 'MILESTONE_UPDATED',
      message: `Усі завдання етапу «${milestone.title}» виконано — перевірте й прийміть етап.`,
      projectId: project.id,
      taskId: null,
      applicationId: null,
      readAt: null,
      createdAt: new Date(),
    });
  }
}
