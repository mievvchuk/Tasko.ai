import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import { AgentService } from './agent.service.js';
import { planDescription, projectPlanSchema } from './project-plan.js';
import { hasDatabaseCode } from '../prisma/database-error.js';

@Injectable()
export class ProjectPlanningService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(AgentService) private readonly agent: AgentService,
  ) {}

  async generate(user: CurrentUser, projectId: string, instructions?: string) {
    const project = await this.projects.requireOwner(user, projectId);
    this.projects.ensureWritable(project);
    // Send only the selected project's brief, never credentials or private files.
    return this.agent.generateProjectPlan({
      title: project.title,
      description: project.description,
      deadline: project.deadline,
      instructions: instructions || '',
    });
  }

  async apply(
    user: CurrentUser,
    projectId: string,
    requestId: string,
    input: unknown,
  ) {
    const parsed = projectPlanSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException(
        'Перевірте назви, описи, пріоритети та критерії приймання плану.',
      );
    const project = await this.projects.requireOwner(user, projectId);
    const client = this.projects.prisma.client;
    const previous = await client.orm.public.ActivityLog.where({
      id: requestId,
    }).first();
    if (previous) {
      if (
        previous.projectId !== projectId ||
        previous.actorId !== user.id ||
        previous.type !== 'AI_PLAN_APPLIED'
      ) {
        throw new ConflictException(
          'Ідентифікатор підтвердження вже використано.',
        );
      }
      return { applied: true, alreadyApplied: true };
    }
    this.projects.ensureWritable(project);
    try {
      return await client.transaction(async (tx) => {
        const now = new Date();
        // Lock the project row so simultaneous plans append milestone positions safely.
        await tx.orm.public.Project.where({ id: projectId }).update({
          updatedAt: now,
        });
        const current = await tx.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!current || (user.role !== 'ADMIN' && current.clientId !== user.id))
          throw new ConflictException('Проєкт змінився. Оновіть сторінку.');
        this.projects.ensureWritable(current);
        // A unique activity ID makes retries safe, including a lost HTTP response.
        await tx.orm.public.ActivityLog.create({
          id: requestId,
          projectId,
          actorId: user.id,
          type: 'AI_PLAN_APPLIED',
          message: 'Власник підтвердив і додав AI-план проєкту.',
          createdAt: now,
        });
        const existing = await tx.orm.public.ProjectMilestone.where({
          projectId,
        }).all();
        let position = existing.reduce(
          (max, item) => Math.max(max, item.position),
          0,
        );
        for (const milestone of parsed.data.milestones) {
          position++;
          await tx.orm.public.ProjectMilestone.create({
            id: randomUUID(),
            projectId,
            title: milestone.title,
            description: planDescription(
              milestone.description,
              milestone.acceptanceCriteria,
            ),
            position,
            deadline: null,
            amount: 0,
            status: 'PLANNED',
            paymentStatus: 'UNPAID',
            createdAt: now,
            updatedAt: now,
          });
          for (const task of milestone.tasks) {
            await tx.orm.public.Task.create({
              id: randomUUID(),
              projectId,
              title: task.title,
              description: planDescription(
                `Етап: ${milestone.title}\n\n${task.description}`,
                task.acceptanceCriteria,
              ),
              assigneeId: null,
              priority: task.priority,
              status: 'TODO',
              deadline: null,
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
        if (
          saved?.projectId === projectId &&
          saved.actorId === user.id &&
          saved.type === 'AI_PLAN_APPLIED'
        )
          return { applied: true, alreadyApplied: true };
      }
      throw error;
    }
  }
}
