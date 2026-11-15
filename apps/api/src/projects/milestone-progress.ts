import { randomUUID } from 'node:crypto';
import { announce } from '../notifications/notification-events.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService['client']['orm']['public'];
type MilestoneStatus = 'PLANNED' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';

// Етап — це оплата частинами за його завдання, тож статус етапу випливає із завдань:
// жодне не почате → «Заплановано», щось у роботі → «У процесі»,
// усі прийняті замовником → «Завершено» (і етап вважається оплаченим).
// Завершений етап більше не змінюється.
export function milestoneStatusFor(
  current: string,
  taskStatuses: string[],
): MilestoneStatus {
  if (current === 'COMPLETED') return 'COMPLETED';
  if (taskStatuses.length && taskStatuses.every((status) => status === 'DONE'))
    return 'COMPLETED';
  if (taskStatuses.some((status) => status !== 'TODO')) return 'IN_PROGRESS';
  return 'PLANNED';
}

// Проєкт виконано, коли є завдання, усі вони прийняті й усі етапи завершено
export function projectIsDone(
  taskStatuses: string[],
  milestoneStatuses: string[],
) {
  return (
    taskStatuses.length > 0 &&
    taskStatuses.every((status) => status === 'DONE') &&
    milestoneStatuses.every((status) => status === 'COMPLETED')
  );
}

async function notify(
  db: Db,
  userIds: Iterable<string>,
  type: string,
  message: string,
  projectId: string,
) {
  for (const userId of new Set(userIds)) {
    announce(userId);
    await db.Notification.create({
      id: randomUUID(),
      userId,
      type,
      message,
      projectId,
      taskId: null,
      applicationId: null,
      readAt: null,
      createdAt: new Date(),
    });
  }
}

// Перераховує статус етапів після зміни їхніх завдань. Платіжної системи немає,
// тож етап, усі завдання якого прийнято, одразу позначається оплаченим.
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
    // (updateAll, бо update() у Prisma 8 оновлює лише за id)
    const [updated] = await db.ProjectMilestone.where({
      id,
      status: milestone.status,
    }).updateAll({
      status: next,
      ...(next === 'COMPLETED' ? { paymentStatus: 'PAID' } : {}),
      updatedAt: new Date(),
    });
    if (!updated || next !== 'COMPLETED') continue;
    const project = await db.Project.where({ id: milestone.projectId }).first();
    if (!project) continue;
    await notify(
      db,
      [
        project.clientId,
        ...(tasks.map((task) => task.assigneeId).filter(Boolean) as string[]),
      ],
      'MILESTONE_UPDATED',
      `Етап «${milestone.title}» виконано й оплачено.`,
      project.id,
    );
  }
}

// Завершує активний проєкт, коли всю роботу прийнято, і пропонує учасникам
// залишити відгуки одне про одного.
export async function completeProjectIfDone(
  db: Db,
  projectId: string,
  actorId: string,
) {
  const project = await db.Project.where({ id: projectId }).first();
  if (!project || project.status !== 'ACTIVE') return false;
  const [tasks, milestones] = await Promise.all([
    db.Task.where({ projectId }).all(),
    db.ProjectMilestone.where({ projectId }).all(),
  ]);
  if (
    !projectIsDone(
      tasks.map((task) => task.status),
      milestones.map((item) => item.status),
    )
  )
    return false;
  const now = new Date();
  const [completed] = await db.Project.where({
    id: projectId,
    status: 'ACTIVE',
  }).updateAll({ status: 'COMPLETED', hiringOpen: false, updatedAt: now });
  if (!completed) return false;
  // Закритий проєкт доступний лише для читання, тож відкриті угоди закриваємо разом із ним
  for (const open of ['PENDING', 'IN_PROGRESS'])
    await db.Order.where({ projectId, status: open }).updateAll({
      status: 'COMPLETED',
      updatedAt: now,
    });
  await db.ActivityLog.create({
    id: randomUUID(),
    projectId,
    actorId,
    type: 'PROJECT_COMPLETED',
    message: 'Усі завдання й етапи виконано — проєкт завершено автоматично.',
    createdAt: now,
  });
  const members = await db.ProjectMember.where({ projectId }).all();
  await notify(
    db,
    [project.clientId],
    'PROJECT_COMPLETED',
    `Проєкт «${project.title}» завершено. Оцініть роботу фрілансерів.`,
    projectId,
  );
  await notify(
    db,
    members.map((member) => member.userId),
    'PROJECT_COMPLETED',
    `Проєкт «${project.title}» завершено. Оцініть співпрацю із замовником.`,
    projectId,
  );
  return true;
}

// Після зміни завдань: перерахувати етапи, а потім, можливо, завершити проєкт
export async function syncProgress(
  db: Db,
  projectId: string,
  milestoneIds: (string | null | undefined)[],
  actorId: string,
) {
  await syncMilestones(db, milestoneIds);
  return completeProjectIfDone(db, projectId, actorId);
}
