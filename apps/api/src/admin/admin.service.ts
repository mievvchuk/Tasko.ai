import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { or } from '@prisma/orm-postgres/orm-client';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { verifyTotp } from '../auth/totp.js';
import {
  moderationStatuses,
  projectStatuses,
} from '../projects/projects.dto.js';
import { ProjectsService } from '../projects/projects.service.js';
import { hasDatabaseCode } from '../prisma/database-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUser } from '../users/users.service.js';
import { buildReportPdf } from './report-pdf.js';
import type {
  CreateAdminDto,
  ModerationDecisionDto,
  UpdateUserDto,
  UserQueryDto,
} from './admin.dto.js';

// Той самий каталог, що у FilesService (вкладення) і UsersService (avatars/)
const storageDirectory = fileURLToPath(
  new URL('../../storage/', import.meta.url),
);

const duplicateEmail = 'Ця електронна пошта вже зареєстрована.';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private requireAdmin(user: CurrentUser) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Потрібні права адміністратора.');
  }

  // Черга модерації: нові й виправлені проєкти, найстаріші першими
  async moderationQueue(user: CurrentUser) {
    this.requireAdmin(user);
    const orm = this.prisma.client.orm.public;
    const projects = await orm.Project.where({ status: 'MODERATION' })
      .orderBy((project) => project.updatedAt.asc())
      .all();
    if (!projects.length) return [];
    const clientIds = [...new Set(projects.map((project) => project.clientId))];
    const clients = await orm.User.where((person) => person.id.in(clientIds))
      .select('id', 'name', 'email', 'avatarUrl')
      .all();
    const categories = await orm.ProjectCategory.all();
    const skills = await orm.Skill.all();
    const links = await orm.ProjectSkill.where((link) =>
      link.projectId.in(projects.map((project) => project.id)),
    ).all();
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        client:
          clients.find((person) => person.id === project.clientId) ?? null,
        category:
          categories.find((category) => category.id === project.categoryId) ??
          null,
        skills: links
          .filter((link) => link.projectId === project.id)
          .flatMap((link) =>
            skills.filter((skill) => skill.id === link.skillId),
          ),
        // Для повторно надісланого проєкту — чому його відхилили минулого разу
        previousRejection: await this.projects.findRejectionReason(project.id),
      })),
    );
  }

  async moderate(user: CurrentUser, id: string, data: ModerationDecisionDto) {
    this.requireAdmin(user);
    const orm = this.prisma.client.orm.public;
    const project = await orm.Project.where({ id }).first();
    if (!project) throw new NotFoundException('Проєкт не знайдено.');
    if (project.status !== 'MODERATION')
      throw new ConflictException('Проєкт уже не очікує модерації.');
    const approved = data.decision === 'APPROVE';
    const reason = data.reason?.trim() ?? '';
    if (!approved && reason.length < 5)
      throw new BadRequestException('Вкажіть причину відхилення.');
    const updated = await orm.Project.where({ id }).update({
      status: approved ? 'PLANNING' : 'REJECTED',
      updatedAt: new Date(),
    });
    await this.projects.logActivity(
      user.id,
      id,
      approved ? 'PROJECT_APPROVED' : 'PROJECT_REJECTED',
      approved ? 'Проєкт схвалено модератором.' : reason,
    );
    await this.projects.notify(
      project.clientId,
      user.id,
      approved ? 'PROJECT_APPROVED' : 'PROJECT_REJECTED',
      approved
        ? `Проєкт «${project.title}» схвалено й опубліковано на біржі.`
        : `Проєкт «${project.title}» відхилено модератором: ${reason}`,
      id,
    );
    return updated;
  }

  list(user: CurrentUser, filters: UserQueryDto) {
    this.requireAdmin(user);
    let query = this.prisma.client.orm.public.User;
    if (filters.role) query = query.where({ role: filters.role });
    if (filters.status) query = query.where({ status: filters.status });
    if (filters.search?.trim()) {
      // Символи LIKE у введеному тексті шукаємо буквально.
      const search = `%${filters.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      query = query.where((person) =>
        or(person.name.ilike(search), person.email.ilike(search)),
      );
    }
    return query
      .select('id', 'name', 'email', 'role', 'status', 'avatarUrl', 'createdAt')
      .orderBy((person) => person.createdAt.desc())
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .all();
  }
  async update(user: CurrentUser, id: string, data: UpdateUserDto) {
    this.requireAdmin(user);
    return this.prisma.client.transaction(async (tx) => {
      const target = await tx.orm.public.User.where({ id }).first();
      if (!target) throw new NotFoundException('Користувача не знайдено.');
      // Адміністратори (і ти сам) не змінюють ролі й статус один одного з панелі
      if (target.role === 'ADMIN')
        throw new ForbiddenException(
          'Роль і статус адміністраторів у панелі змінити не можна.',
        );
      if (data.role && data.role !== target.role) {
        const owned = await tx.orm.public.Project.where({ clientId: id }).all();
        const memberships = await tx.orm.public.ProjectMember.where({
          userId: id,
        }).all();
        if (owned.length || memberships.length)
          throw new ConflictException(
            'Не можна змінити роль користувача, який уже має проєкти або участь у них.',
          );
      }
      return tx.orm.public.User.where({ id })
        .select('id', 'name', 'email', 'role', 'status')
        .update({
          ...(data.role ? { role: data.role } : {}),
          ...(data.status ? { status: data.status } : {}),
          updatedAt: new Date(),
        });
    });
  }
  // Повне видалення: користувач зникає разом з усім своїм — його проєктами (з завданнями, файлами,
  // листуванням), заявками, повідомленнями, відгуками, скаргами. У чужих завданнях лише знімається з виконавця.
  async remove(user: CurrentUser, id: string) {
    this.requireAdmin(user);
    if (id === user.id)
      throw new BadRequestException(
        'Власний обліковий запис видалити не можна.',
      );
    const files: string[] = [];
    const result = await this.prisma.client.transaction(async (tx) => {
      const db = tx.orm.public;
      const target = await db.User.where({ id }).first();
      if (!target) throw new NotFoundException('Користувача не знайдено.');
      if (target.role === 'ADMIN')
        throw new ForbiddenException(
          'Адміністраторів видаляти з панелі не можна.',
        );
      if (target.avatarUrl)
        files.push(`avatars/${target.avatarUrl.split('/').pop()}`);

      // Проєкти, де користувач замовник, — разом з усім вмістом (спершу дочірні записи)
      for (const project of await db.Project.where({ clientId: id }).all()) {
        const projectId = project.id;
        for (const file of await db.FileAttachment.where({ projectId }).all())
          files.push(file.storagePath);
        await db.FileAttachment.where({ projectId }).deleteAll();
        await db.Notification.where({ projectId }).deleteAll();
        for (const task of await db.Task.where({ projectId }).all()) {
          await db.Notification.where({ taskId: task.id }).deleteAll();
          await db.WorkSubmission.where({ taskId: task.id }).deleteAll();
        }
        await db.Task.where({ projectId }).deleteAll();
        await db.BoardColumn.where({ projectId }).deleteAll();
        await db.ActivityLog.where({ projectId }).deleteAll();
        await db.Message.where({ projectId }).deleteAll();
        for (const application of await db.ProjectApplication.where({
          projectId,
        }).all())
          await db.ApplicationMessage.where({
            applicationId: application.id,
          }).deleteAll();
        await db.ProjectApplication.where({ projectId }).deleteAll();
        await db.FreelancerReview.where({ projectId }).deleteAll();
        await db.ProjectMember.where({ projectId }).deleteAll();
        await db.ProjectSkill.where({ projectId }).deleteAll();
        await db.FavoriteProject.where({ projectId }).deleteAll();
        await db.ProjectMilestone.where({ projectId }).deleteAll();
        await db.Order.where({ projectId }).deleteAll();
        await db.Complaint.where({ projectId }).deleteAll();
        await db.Project.where({ id: projectId }).delete();
      }

      // Сліди в чужих проєктах
      for (const submission of await db.WorkSubmission.where({
        submittedBy: id,
      }).all())
        await db.FileAttachment.where({
          submissionId: submission.id,
        }).updateAll({ submissionId: null });
      await db.WorkSubmission.where({ submittedBy: id }).deleteAll();
      await db.WorkSubmission.where({ reviewerId: id }).updateAll({
        reviewerId: null,
      });
      for (const file of await db.FileAttachment.where({
        uploadedBy: id,
      }).all())
        files.push(file.storagePath);
      await db.FileAttachment.where({ uploadedBy: id }).deleteAll();
      await db.Task.where({ assigneeId: id }).updateAll({ assigneeId: null });
      await db.Message.where({ senderId: id }).deleteAll();
      await db.ActivityLog.where({ actorId: id }).deleteAll();
      for (const application of await db.ProjectApplication.where({
        freelancerId: id,
      }).all())
        await db.ApplicationMessage.where({
          applicationId: application.id,
        }).deleteAll();
      await db.ProjectApplication.where({ freelancerId: id }).deleteAll();
      await db.FreelancerReview.where({ clientId: id }).deleteAll();
      await db.FreelancerReview.where({ freelancerId: id }).deleteAll();
      await db.ProjectMember.where({ userId: id }).deleteAll();
      await db.Complaint.where({ reporterId: id }).deleteAll();
      await db.Complaint.where({ targetUserId: id }).deleteAll();

      // Особисті дані
      await db.AuthSession.where({ userId: id }).deleteAll();
      await db.Notification.where({ userId: id }).deleteAll();
      await db.FavoriteProject.where({ userId: id }).deleteAll();
      await db.FreelancerSkill.where({ userId: id }).deleteAll();
      await db.PortfolioItem.where({ userId: id }).deleteAll();
      await db.FreelancerProfile.where({ userId: id }).deleteAll();
      await db.User.where({ id }).delete();
      for (const key of files) await db.StoredFile.where({ id: key }).delete();
      return { id, deleted: true };
    });
    // Файли — лише після успішного коміту; якийсь уже відсутній — не біда
    await Promise.all(
      files.map((file) =>
        unlink(join(storageDirectory, file)).catch(() => undefined),
      ),
    );
    return result;
  }
  // Новий адміністратор — завжди окремий акаунт; той, хто створює, підтверджує дію своїм паролем і кодом 2FA
  async createAdmin(user: CurrentUser, data: CreateAdminDto) {
    this.requireAdmin(user);
    const me = await this.prisma.client.orm.public.User.where({
      id: user.id,
    }).first();
    if (
      !me?.passwordHash ||
      !(await verifyPassword(data.currentPassword, me.passwordHash))
    )
      throw new BadRequestException('Ваш пароль неправильний.');
    if (
      me.twoFactorEnabled &&
      !(
        me.twoFactorSecret &&
        data.twoFactorCode &&
        verifyTotp(me.twoFactorSecret, data.twoFactorCode)
      )
    )
      throw new BadRequestException('Введіть правильний код 2FA.');
    if (
      await this.prisma.client.orm.public.User.where({
        email: data.email,
      }).first()
    )
      throw new ConflictException(duplicateEmail);
    const now = new Date();
    try {
      const created = await this.prisma.client.orm.public.User.create({
        id: randomUUID(),
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
      // Без хешу пароля та секрету 2FA
      const { id, name, email, role, status, createdAt } = created;
      return { id, name, email, role, status, createdAt };
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException(duplicateEmail);
      throw error;
    }
  }
  async report(user: CurrentUser) {
    this.requireAdmin(user);
    const users = await this.prisma.client.orm.public.User.select(
      'role',
      'status',
      'createdAt',
    ).all();
    const projects = await this.prisma.client.orm.public.Project.select(
      'id',
      'status',
      'createdAt',
    ).all();
    const tasks = await this.prisma.client.orm.public.Task.select(
      'status',
      'deadline',
    ).all();
    const complaints = await this.prisma.client.orm.public.Complaint.select(
      'status',
      'createdAt',
      'updatedAt',
    ).all();
    const applications =
      await this.prisma.client.orm.public.ProjectApplication.select(
        'projectId',
        'status',
        'createdAt',
        'updatedAt',
      ).all();
    const days = lastDays(7);
    const weekStart = new Date(`${days[0]}T00:00:00Z`);
    const projectCreated = new Map(projects.map((p) => [p.id, p.createdAt]));
    // Від створення проєкту до першої заявки та до прийнятої заявки
    const firstApplication = new Map<string, Date>();
    for (const application of applications) {
      const seen = firstApplication.get(application.projectId);
      if (!seen || application.createdAt < seen)
        firstApplication.set(application.projectId, application.createdAt);
    }
    const sinceProject = (projectId: string, at: Date) => {
      const created = projectCreated.get(projectId);
      return created ? at.getTime() - created.getTime() : null;
    };
    return {
      users: users.length,
      blockedUsers: users.filter((person) => person.status === 'BLOCKED')
        .length,
      projects: projects.length,
      activeProjects: projects.filter((project) => project.status === 'ACTIVE')
        .length,
      completedProjects: projects.filter(
        (project) => project.status === 'COMPLETED',
      ).length,
      tasks: tasks.length,
      overdueTasks: tasks.filter(
        (task) =>
          task.status !== 'DONE' && task.deadline && task.deadline < new Date(),
      ).length,
      tasksByStatus: Object.fromEntries(
        ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((status) => [
          status,
          tasks.filter((task) => task.status === status).length,
        ]),
      ),
      usersByRole: countBy(['CLIENT', 'FREELANCER', 'ADMIN'], users, 'role'),
      projectsByStatus: countBy(
        [...projectStatuses, ...moderationStatuses],
        projects,
        'status',
      ),
      // Нові користувачі й проєкти за останні 6 місяців (для діаграми)
      growth: lastMonths(6).map((month) => ({
        month,
        users: users.filter((person) => monthOf(person.createdAt) === month)
          .length,
        projects: projects.filter(
          (project) => monthOf(project.createdAt) === month,
        ).length,
      })),
      complaintsByStatus: countBy(
        ['OPEN', 'RESOLVED', 'REJECTED'],
        complaints,
        'status',
      ),
      applicationsByStatus: countBy(
        ['PENDING', 'ACCEPTED', 'REJECTED'],
        applications,
        'status',
      ),
      // Останні 7 днів: підсумки й щоденні ряди для лінійної діаграми
      week: {
        users: users.filter((person) => person.createdAt >= weekStart).length,
        projects: projects.filter((project) => project.createdAt >= weekStart)
          .length,
        complaints: complaints.filter((c) => c.createdAt >= weekStart).length,
        applications: applications.filter((a) => a.createdAt >= weekStart)
          .length,
        days: days.map((day) => ({
          day,
          users: users.filter((person) => dayOf(person.createdAt) === day)
            .length,
          projects: projects.filter(
            (project) => dayOf(project.createdAt) === day,
          ).length,
          complaints: complaints.filter((c) => dayOf(c.createdAt) === day)
            .length,
        })),
      },
      // Середній час у годинах; null — ще немає даних
      averageHours: {
        complaintResolution: averageHours(
          complaints
            .filter((c) => c.status !== 'OPEN')
            .map((c) => c.updatedAt.getTime() - c.createdAt.getTime()),
        ),
        firstApplication: averageHours(
          [...firstApplication].map(([projectId, at]) =>
            sinceProject(projectId, at),
          ),
        ),
        hire: averageHours(
          applications
            .filter((a) => a.status === 'ACCEPTED')
            .map((a) => sinceProject(a.projectId, a.updatedAt)),
        ),
      },
    };
  }

  async exportReport(
    user: CurrentUser,
    format: 'json' | 'csv' | 'xlsx' | 'pdf',
  ) {
    const report = await this.report(user);
    const rows = this.reportRows(report);
    const date = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      return {
        fileName: `tasko-report-${date}.json`,
        contentType: 'application/json; charset=utf-8',
        content: Buffer.from(JSON.stringify(report, null, 2), 'utf8'),
      };
    }

    if (format === 'csv') {
      const csv = [
        ['Показник', 'Значення'],
        ...rows.map((row) => [row.label, String(row.value)]),
      ]
        .map((row) => row.map((value) => this.csvValue(value)).join(','))
        .join('\r\n');
      return {
        fileName: `tasko-report-${date}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: Buffer.from(`\uFEFF${csv}`, 'utf8'),
      };
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Звіт');
      sheet.columns = [
        { header: 'Показник', key: 'label', width: 34 },
        { header: 'Значення', key: 'value', width: 16 },
      ];
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EEF9' },
      };
      const content = await workbook.xlsx.writeBuffer();
      return {
        fileName: `tasko-report-${date}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: Buffer.from(content),
      };
    }

    const content = await buildReportPdf(report);
    return {
      fileName: `tasko-report-${date}.pdf`,
      contentType: 'application/pdf',
      content,
    };
  }

  private reportRows(report: Awaited<ReturnType<AdminService['report']>>) {
    return [
      { label: 'Користувачі', value: report.users },
      { label: 'Заблоковані користувачі', value: report.blockedUsers },
      { label: 'Проєкти', value: report.projects },
      { label: 'Активні проєкти', value: report.activeProjects },
      { label: 'Завершені проєкти', value: report.completedProjects },
      { label: 'Завдання', value: report.tasks },
      { label: 'Прострочені завдання', value: report.overdueTasks },
      { label: 'Завдання: до виконання', value: report.tasksByStatus.TODO },
      {
        label: 'Завдання: у процесі',
        value: report.tasksByStatus.IN_PROGRESS,
      },
      { label: 'Завдання: на перевірці', value: report.tasksByStatus.REVIEW },
      { label: 'Завдання: завершено', value: report.tasksByStatus.DONE },
      { label: 'Замовники', value: report.usersByRole.CLIENT },
      { label: 'Фрілансери', value: report.usersByRole.FREELANCER },
      { label: 'Адміністратори', value: report.usersByRole.ADMIN },
      {
        label: 'Скарги: очікують розгляду',
        value: report.complaintsByStatus.OPEN,
      },
      { label: 'Скарги: вирішено', value: report.complaintsByStatus.RESOLVED },
      { label: 'Скарги: відхилено', value: report.complaintsByStatus.REJECTED },
      { label: 'Нові користувачі за 7 днів', value: report.week.users },
      { label: 'Нові проєкти за 7 днів', value: report.week.projects },
      { label: 'Нові заявки за 7 днів', value: report.week.applications },
    ];
  }

  private csvValue(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }
}

function countBy<
  K extends string,
  T extends Record<F, unknown>,
  F extends string,
>(keys: readonly K[], rows: T[], field: F) {
  return Object.fromEntries(
    keys.map((key) => [key, rows.filter((row) => row[field] === key).length]),
  ) as Record<K, number>;
}

// «2026-10» — місяць дати за UTC
function monthOf(date: Date) {
  return date.toISOString().slice(0, 7);
}

// «2026-11-07» — день дати за UTC
function dayOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Останні n днів, від найстарішого до сьогодні
export function lastDays(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, index) =>
    dayOf(
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - (n - 1 - index),
        ),
      ),
    ),
  );
}

function averageHours(durations: (number | null)[]) {
  const known = durations.filter((ms): ms is number => ms !== null && ms >= 0);
  if (known.length === 0) return null;
  const mean = known.reduce((sum, ms) => sum + ms, 0) / known.length;
  return Math.round((mean / 3_600_000) * 10) / 10;
}

// Останні n місяців, від найстарішого до поточного
export function lastMonths(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, index) =>
    monthOf(
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - index), 1),
      ),
    ),
  );
}
