import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import { AgentService } from './agent.service.js';
import {
  fitPlanDeadlines,
  fitPlanToBudget,
  milestoneAmount,
  milestoneDeadline,
  toDate,
  planDescription,
  planTotal,
  projectPlanSchema,
} from './project-plan.js';
import { hasDatabaseCode } from '../prisma/database-error.js';

type Db = ProjectsService['prisma']['client']['orm']['public'];

// Етап, який ще не почали й не оплачували, план може замінити
const replaceable = (milestone: { status: string; paymentStatus: string }) =>
  milestone.status === 'PLANNED' && milestone.paymentStatus === 'UNPAID';

// Завдання цього етапу, яке ще ніхто не взяв у роботу. Старі плани (до зв'язку
// завдання з етапом) позначали етап лише першим рядком опису «Етап: …».
const planTaskOf =
  (milestone: { id: string; title: string }) =>
  (task: { milestoneId: string | null; description: string | null; status: string; assigneeId: string | null }) =>
    task.status === 'TODO' &&
    !task.assigneeId &&
    (task.milestoneId === milestone.id || (!task.milestoneId && Boolean(task.description?.startsWith(`Етап: ${milestone.title}\n\n`))));

@Injectable()
export class ProjectPlanningService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(AgentService) private readonly agent: AgentService,
  ) {}

  // Бюджет для плану: ціна прийнятих пропозицій фрілансерів (на неї вже погодились),
  // інакше — бюджет проєкту. Наявні етапи вже забирають частину цієї суми.
  private async budgetOf(db: Db, project: { id: string; budgetMin: number | null; budgetMax: number | null }) {
    const accepted = await db.ProjectApplication.where({
      projectId: project.id,
      status: 'ACCEPTED',
    }).all();
    const limit = accepted.length
      ? accepted.reduce((sum, item) => sum + item.proposedBudget, 0)
      : (project.budgetMax ?? project.budgetMin ?? null);
    const milestones = await db.ProjectMilestone.where({
      projectId: project.id,
    }).all();
    const kept = milestones.filter((item) => !replaceable(item));
    const sum = (items: { amount: number }[]) => items.reduce((total, item) => total + item.amount, 0);
    return {
      limit,
      source: accepted.length ? 'BID' : limit === null ? null : 'PROJECT',
      milestones: milestones.length,
      replaceableMilestones: milestones.length - kept.length,
      // Скільки вже розподілено в наявних етапах і скільки лишиться після заміни
      committed: sum(milestones),
      committedAfterReplace: sum(kept),
    } as const;
  }

  private available(budget: Awaited<ReturnType<ProjectPlanningService['budgetOf']>>, replace: boolean) {
    if (budget.limit === null) return null;
    const used = replace ? budget.committedAfterReplace : budget.committed;
    return Math.max(0, budget.limit - used);
  }

  // Що показати власнику перед генерацією: бюджет і чи є етапи, які план замінить
  async context(user: CurrentUser, projectId: string) {
    const project = await this.projects.requireOwner(user, projectId);
    return this.budgetOf(this.projects.prisma.client.orm.public, project);
  }

  async generate(user: CurrentUser, projectId: string, instructions?: string, replace = false) {
    const project = await this.projects.requireOwner(user, projectId);
    this.projects.ensureWritable(project);
    const budget = this.available(await this.budgetOf(this.projects.prisma.client.orm.public, project), replace);
    // Send only the selected project's brief, never credentials or private files.
    const plan = await this.agent.generateProjectPlan({
      title: project.title,
      description: project.description,
      deadline: project.deadline,
      instructions: instructions || '',
      budget,
      today: new Date().toISOString().slice(0, 10),
    });
    return fitPlanDeadlines(fitPlanToBudget(plan, budget), new Date(), project.deadline);
  }

  async apply(user: CurrentUser, projectId: string, requestId: string, input: unknown, replace = false) {
    const parsed = projectPlanSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('Перевірте назви, описи, пріоритети, рейтинги, суми, дедлайни та критерії приймання плану.');
    const project = await this.projects.requireOwner(user, projectId);
    const late = parsed.data.milestones
      .flatMap((milestone) => milestone.tasks)
      .find((task) => task.deadline && project.deadline && toDate(task.deadline) > project.deadline);
    if (late) throw new BadRequestException(`Дедлайн завдання «${late.title}» пізніший за дедлайн проєкту.`);
    const client = this.projects.prisma.client;
    const previous = await client.orm.public.ActivityLog.where({
      id: requestId,
    }).first();
    if (previous) {
      if (previous.projectId !== projectId || previous.actorId !== user.id || previous.type !== 'AI_PLAN_APPLIED') {
        throw new ConflictException('Ідентифікатор підтвердження вже використано.');
      }
      return { applied: true, alreadyApplied: true };
    }
    this.projects.ensureWritable(project);
    try {
      return await client.transaction(async (tx) => {
        const db = tx.orm.public;
        const now = new Date();
        // Lock the project row so simultaneous plans append milestone positions safely.
        await db.Project.where({ id: projectId }).update({ updatedAt: now });
        const current = await db.Project.where({ id: projectId }).first();
        if (!current || current.clientId !== user.id) throw new ConflictException('Проєкт змінився. Оновіть сторінку.');
        this.projects.ensureWritable(current);
        // Сума плану не може перевищити бюджет (з урахуванням етапів, що лишаються)
        const budget = this.available(await this.budgetOf(db, current), replace);
        const total = planTotal(parsed.data);
        if (budget !== null && total > budget)
          throw new BadRequestException(`Сума плану ${total} грн перевищує доступний бюджет ${budget} грн. Зменште вартість завдань.`);
        // A unique activity ID makes retries safe, including a lost HTTP response.
        await db.ActivityLog.create({
          id: requestId,
          projectId,
          actorId: user.id,
          type: 'AI_PLAN_APPLIED',
          message: replace ? 'Власник замінив попередні етапи новим AI-планом.' : 'Власник підтвердив і додав AI-план проєкту.',
          createdAt: now,
        });
        let existing = await db.ProjectMilestone.where({ projectId }).all();
        if (replace) {
          const tasks = await db.Task.where({ projectId }).all();
          for (const milestone of existing.filter(replaceable)) {
            for (const task of tasks.filter(planTaskOf(milestone))) {
              // Невзяте в роботу завдання не має здач, лише можливі сповіщення
              if (await db.WorkSubmission.where({ taskId: task.id }).first()) continue;
              await db.Notification.where({ taskId: task.id }).deleteAll();
              await db.Task.where({ id: task.id }).delete();
            }
            // Завдання, які вже комусь призначено, лишаються — лише без етапу
            await db.Task.where({ milestoneId: milestone.id }).updateAll({
              milestoneId: null,
            });
            await db.ProjectMilestone.where({ id: milestone.id }).delete();
          }
          existing = existing.filter((item) => !replaceable(item));
        }
        let position = existing.reduce((max, item) => Math.max(max, item.position), 0);
        for (const milestone of parsed.data.milestones) {
          position++;
          const milestoneId = randomUUID();
          await db.ProjectMilestone.create({
            id: milestoneId,
            projectId,
            title: milestone.title,
            description: planDescription(milestone.description, milestone.acceptanceCriteria),
            position,
            deadline: milestoneDeadline(milestone),
            amount: milestoneAmount(milestone),
            status: 'PLANNED',
            paymentStatus: 'UNPAID',
            createdAt: now,
            updatedAt: now,
          });
          for (const task of milestone.tasks) {
            await db.Task.create({
              id: randomUUID(),
              projectId,
              title: task.title,
              description: planDescription(task.description, task.acceptanceCriteria, task.amount),
              assigneeId: null,
              priority: task.priority,
              rating: task.rating,
              status: 'TODO',
              deadline: task.deadline ? toDate(task.deadline) : null,
              // Завдання належить своєму етапу: етап закривається, коли виконано всі його завдання
              milestoneId,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
        return { applied: true, alreadyApplied: false };
      });
    } catch (error) {
      if (hasDatabaseCode(error, '23505')) {
        const saved = await client.orm.public.ActivityLog.where({
          id: requestId,
        }).first();
        if (saved?.projectId === projectId && saved.actorId === user.id && saved.type === 'AI_PLAN_APPLIED')
          return { applied: true, alreadyApplied: true };
      }
      throw error;
    }
  }
}
