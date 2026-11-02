import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type {
  CreateComplaintDto,
  DecideComplaintDto,
} from './complaints.dto.js';

export function validateComplaintTargets(
  reporterId: string,
  targetUserId?: string,
  projectId?: string,
) {
  if (!targetUserId && !projectId)
    throw new BadRequestException('Вкажіть користувача або проєкт.');
  if (targetUserId === reporterId)
    throw new BadRequestException('Не можна скаржитися на себе.');
}

@Injectable()
export class ComplaintsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private requireAdmin(user: CurrentUser) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Потрібні права адміністратора.');
  }
  async create(user: CurrentUser, data: CreateComplaintDto) {
    validateComplaintTargets(user.id, data.targetUserId, data.projectId);
    if (data.targetUserId) {
      const target = await this.prisma.client.orm.public.User.where({
        id: data.targetUserId,
      }).first();
      if (!target) throw new NotFoundException('Користувача не знайдено.');
    }
    if (data.projectId) await this.projects.requireAccess(user, data.projectId);
    const now = new Date();
    return this.prisma.client.orm.public.Complaint.create({
      id: randomUUID(),
      reporterId: user.id,
      targetUserId: data.targetUserId ?? null,
      projectId: data.projectId ?? null,
      reason: data.reason.trim(),
      description: data.description.trim(),
      status: 'OPEN',
      adminNote: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  own(user: CurrentUser, page: number, limit: number) {
    return this.prisma.client.orm.public.Complaint.where({
      reporterId: user.id,
    })
      .orderBy((item) => item.createdAt.desc())
      .offset((page - 1) * limit)
      .limit(limit)
      .all();
  }
  async all(user: CurrentUser, page: number, limit: number, status?: string) {
    this.requireAdmin(user);
    let query = this.prisma.client.orm.public.Complaint;
    if (status) query = query.where({ status });
    const items = await query
      .orderBy((item) => item.createdAt.desc())
      .offset((page - 1) * limit)
      .limit(limit)
      .all();
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        reporter: await this.prisma.client.orm.public.User.where({
          id: item.reporterId,
        })
          .select('id', 'name')
          .first(),
        targetUser: item.targetUserId
          ? await this.prisma.client.orm.public.User.where({
              id: item.targetUserId,
            })
              .select('id', 'name')
              .first()
          : null,
        project: item.projectId
          ? await this.prisma.client.orm.public.Project.where({
              id: item.projectId,
            })
              .select('id', 'title')
              .first()
          : null,
      })),
    );
  }
  async decide(user: CurrentUser, id: string, data: DecideComplaintDto) {
    this.requireAdmin(user);
    const item = await this.prisma.client.orm.public.Complaint.where({
      id,
    }).first();
    if (!item) throw new NotFoundException('Скаргу не знайдено.');
    if (item.status !== 'OPEN')
      throw new ConflictException('Скаргу вже розглянуто.');
    return this.prisma.client.orm.public.Complaint.where({
      id,
      status: 'OPEN',
    }).update({
      status: data.status,
      adminNote: data.adminNote.trim(),
      updatedAt: new Date(),
    });
  }
}
