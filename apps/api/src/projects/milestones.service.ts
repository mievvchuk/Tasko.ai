import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../users/users.service.js';
import type {
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from './milestones.dto.js';
import { ProjectsService } from './projects.service.js';

export function checkMilestoneTransition(from: string, to: string) {
  if (from === to) return;
  const allowed: Record<string, string[]> = {
    PLANNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['REVIEW'],
    REVIEW: ['IN_PROGRESS', 'COMPLETED'],
  };
  if (!allowed[from]?.includes(to))
    throw new ConflictException('Недозволена зміна статусу етапу.');
}

@Injectable()
export class MilestonesService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private get db() {
    return this.projects.prisma.client.orm.public;
  }

  async list(user: CurrentUser, projectId: string) {
    await this.projects.requireAccess(user, projectId);
    return this.db.ProjectMilestone.where({ projectId })
      .orderBy((item) => item.position.asc())
      .all();
  }

  async create(user: CurrentUser, projectId: string, data: CreateMilestoneDto) {
    const project = await this.projects.requireOwner(user, projectId);
    this.projects.ensureWritable(project);
    const now = new Date();
    const item = await this.db.ProjectMilestone.create({
      id: randomUUID(),
      projectId,
      title: data.title,
      description: data.description ?? null,
      position: data.position,
      deadline: data.deadline ? new Date(data.deadline) : null,
      amount: data.amount,
      status: 'PLANNED',
      paymentStatus: 'UNPAID',
      createdAt: now,
      updatedAt: now,
    });
    await this.projects.logActivity(
      user.id,
      projectId,
      'MILESTONE_CREATED',
      `Створено етап «${data.title}».`,
    );
    const members = await this.db.ProjectMember.where({ projectId }).all();
    for (const member of members)
      await this.projects.notify(
        member.userId,
        user.id,
        'MILESTONE_CREATED',
        `Створено етап «${data.title}».`,
        projectId,
      );
    return item;
  }

  async update(user: CurrentUser, id: string, data: UpdateMilestoneDto) {
    const item = await this.db.ProjectMilestone.where({ id }).first();
    if (!item) throw new NotFoundException('Етап не знайдено.');
    const project = await this.projects.requireAccess(user, item.projectId);
    this.projects.ensureWritable(project);
    const owner = user.role === 'ADMIN' || project.clientId === user.id;
    if (
      !owner &&
      (data.title !== undefined ||
        data.description !== undefined ||
        data.deadline !== undefined ||
        data.amount !== undefined ||
        data.position !== undefined ||
        data.paymentStatus !== undefined)
    )
      throw new ForbiddenException('Ці поля змінює власник проєкту.');
    if (data.status) {
      checkMilestoneTransition(item.status, data.status);
      if (
        !owner &&
        !(
          (item.status === 'PLANNED' && data.status === 'IN_PROGRESS') ||
          (item.status === 'IN_PROGRESS' && data.status === 'REVIEW')
        )
      )
        throw new ForbiddenException('Цей перехід виконує власник проєкту.');
    }
    const updated = await this.db.ProjectMilestone.where({
      id,
      status: item.status,
    }).update({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description || null }
        : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      ...(data.deadline !== undefined
        ? { deadline: data.deadline ? new Date(data.deadline) : null }
        : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.paymentStatus !== undefined
        ? { paymentStatus: data.paymentStatus }
        : {}),
      updatedAt: new Date(),
    });
    await this.projects.logActivity(
      user.id,
      item.projectId,
      'MILESTONE_UPDATED',
      `Оновлено етап «${item.title}».`,
    );
    const recipientId = owner
      ? (
          await this.db.ProjectMember.where({
            projectId: item.projectId,
          }).first()
        )?.userId
      : project.clientId;
    if (recipientId)
      await this.projects.notify(
        recipientId,
        user.id,
        'MILESTONE_UPDATED',
        `Оновлено етап «${item.title}».`,
        item.projectId,
      );
    return updated;
  }
}
