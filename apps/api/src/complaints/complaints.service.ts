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
      category: data.category ?? 'OTHER',
      status: 'OPEN',
      adminNote: null,
      action: null,
      restrictDays: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  // На кого можна поскаржитися: проєкти користувача та люди з них (клієнти й учасники), без нього самого
  async targets(user: CurrentUser) {
    const db = this.prisma.client.orm.public;
    const memberOf = await db.ProjectMember.where({ userId: user.id }).all();
    const ids = new Set(memberOf.map((member) => member.projectId));
    for (const project of await db.Project.where({ clientId: user.id })
      .select('id')
      .all())
      ids.add(project.id);
    if (!ids.size) return { projects: [], users: [] };
    const projectIds = [...ids];
    const projects = await db.Project.where((project) =>
      project.id.in(projectIds),
    )
      .select('id', 'title', 'clientId')
      .all();
    const members = await db.ProjectMember.where((member) =>
      member.projectId.in(projectIds),
    ).all();
    const titles = new Map(
      projects.map((project) => [project.id, project.title]),
    );
    const userProjects = new Map<string, Set<string>>();
    const link = (userId: string, projectId: string) => {
      if (userId === user.id) return;
      if (!userProjects.has(userId)) userProjects.set(userId, new Set());
      userProjects.get(userId)!.add(projectId);
    };
    for (const project of projects) link(project.clientId, project.id);
    for (const member of members) link(member.userId, member.projectId);
    const userIds = [...userProjects.keys()];
    const users = userIds.length
      ? await db.User.where((row) => row.id.in(userIds))
          .select('id', 'name', 'role')
          .all()
      : [];
    return {
      projects: projects
        .map(({ id, title }) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title)),
      users: users
        .map((row) => {
          const ids = [...userProjects.get(row.id)!];
          // projectIds — щоб форма скарги одразу підставила спільний проєкт
          return {
            ...row,
            projects: ids.map((id) => titles.get(id) ?? ''),
            projectIds: ids,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
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
              .select('id', 'name', 'role', 'status', 'restrictedUntil')
              .first()
          : null,
        // Попередні підтверджені скарги на цю ж людину — від них залежить суворість санкції
        targetHistory: item.targetUserId
          ? await this.history(item.targetUserId, item.id)
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
  private async history(targetUserId: string, exceptId: string) {
    const rows = (
      await this.prisma.client.orm.public.Complaint.where({
        targetUserId,
      }).all()
    ).filter((row) => row.id !== exceptId);
    return {
      total: rows.length,
      confirmed: rows.filter((row) => row.status === 'RESOLVED').length,
      warnings: rows.filter((row) => row.action === 'WARNING').length,
      restrictions: rows.filter((row) => row.action === 'RESTRICT').length,
    };
  }

  // Рішення по скарзі: статус, пояснення обом сторонам і, за потреби, санкція до порушника
  async decide(user: CurrentUser, id: string, data: DecideComplaintDto) {
    this.requireAdmin(user);
    const db = this.prisma.client.orm.public;
    const item = await db.Complaint.where({ id }).first();
    if (!item) throw new NotFoundException('Скаргу не знайдено.');
    if (item.status !== 'OPEN')
      throw new ConflictException('Скаргу вже розглянуто.');
    const action =
      data.status === 'RESOLVED' ? (data.action ?? 'NONE') : 'NONE';
    const note = data.adminNote.trim();
    const target = item.targetUserId
      ? await db.User.where({ id: item.targetUserId }).first()
      : null;
    if (action !== 'NONE' && !target)
      throw new BadRequestException(
        'Санкцію можна застосувати лише до користувача, на якого скаржаться.',
      );
    if (action !== 'NONE' && target?.role === 'ADMIN')
      throw new ForbiddenException('Адміністратора обмежити не можна.');
    const now = new Date();
    const updated = await this.prisma.client.transaction(async (tx) => {
      // Спершу закриваємо скаргу: друге одночасне рішення не застосує санкцію ще раз
      const [decided] = await tx.orm.public.Complaint.where({
        id,
        status: 'OPEN',
      }).updateAll({
        status: data.status,
        adminNote: note,
        action,
        restrictDays: action === 'RESTRICT' ? data.restrictDays! : null,
        updatedAt: now,
      });
      if (!decided) throw new ConflictException('Скаргу вже розглянуто.');
      const users = tx.orm.public.User;
      if (target && action === 'RESTRICT')
        await users.where({ id: target.id }).update({
          restrictedUntil: new Date(
            now.getTime() + data.restrictDays! * 86400000,
          ),
          restrictionReason: note,
          updatedAt: now,
        });
      if (target && action === 'BLOCK')
        await users.where({ id: target.id }).update({
          status: 'BLOCKED',
          blockReason: note,
          updatedAt: now,
        });
      return decided;
    });
    // Автор скарги дізнається про рішення, порушник — про санкцію і її причину
    await this.projects.notify(
      item.reporterId,
      user.id,
      'COMPLAINT_DECIDED',
      data.status === 'RESOLVED'
        ? `Скаргу «${item.reason}» розглянуто й підтверджено: ${note}`
        : `Скаргу «${item.reason}» відхилено: ${note}`,
      item.projectId ?? undefined,
    );
    const sanctions: Record<string, string> = {
      WARNING: `Попередження від адміністратора: ${note}`,
      RESTRICT: `Акаунт обмежено на ${data.restrictDays} дн.: не можна публікувати проєкти, подавати заявки й писати повідомлення. Причина: ${note}`,
    };
    if (target && sanctions[action])
      await this.projects.notify(
        target.id,
        user.id,
        `COMPLAINT_${action}`,
        sanctions[action],
        item.projectId ?? undefined,
      );
    return updated;
  }
}
