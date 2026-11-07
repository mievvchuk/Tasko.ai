import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { or } from '@prisma/orm-postgres/orm-client';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { verifyTotp } from '../auth/totp.js';
import { projectStatuses } from '../projects/projects.dto.js';
import { hasDatabaseCode } from '../prisma/database-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type {
  CreateAdminDto,
  UpdateUserDto,
  UserQueryDto,
} from './admin.dto.js';

const duplicateEmail = 'Ця електронна пошта вже зареєстрована.';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private requireAdmin(user: CurrentUser) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Потрібні права адміністратора.');
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
  // Новий адміністратор — завжди окремий акаунт; той, хто створює, підтверджує дію своїм паролем і кодом 2FA
  async createAdmin(user: CurrentUser, data: CreateAdminDto) {
    this.requireAdmin(user);
    const me = await this.prisma.client.orm.public.User.where({
      id: user.id,
    }).first();
    if (!me || !(await verifyPassword(data.currentPassword, me.passwordHash)))
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
      projectsByStatus: countBy(projectStatuses, projects, 'status'),
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
          projects: projects.filter((project) => dayOf(project.createdAt) === day)
            .length,
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

    const fontDirectory = fileURLToPath(
      new URL(
        '../../node_modules/pdfmake/build/fonts/Roboto/',
        import.meta.url,
      ),
    );
    pdfMake.setUrlAccessPolicy(() => false);
    pdfMake.setLocalAccessPolicy((path) => path.startsWith(fontDirectory));
    pdfMake.addFonts({
      Roboto: {
        normal: `${fontDirectory}Roboto-Regular.ttf`,
        bold: `${fontDirectory}Roboto-Medium.ttf`,
        italics: `${fontDirectory}Roboto-Italic.ttf`,
        bolditalics: `${fontDirectory}Roboto-MediumItalic.ttf`,
      },
    });
    const content = await pdfMake
      .createPdf({
        defaultStyle: { font: 'Roboto', fontSize: 11 },
        content: [
          { text: 'Звіт Tasko.ai', style: 'header' },
          { text: `Сформовано: ${new Date().toLocaleString('uk-UA')}` },
          {
            margin: [0, 14, 0, 0],
            table: {
              headerRows: 1,
              widths: ['*', 100],
              body: [
                [
                  { text: 'Показник', bold: true },
                  { text: 'Значення', bold: true },
                ],
                ...rows.map((row) => [row.label, String(row.value)]),
              ],
            },
          },
        ],
        styles: { header: { fontSize: 20, bold: true, margin: [0, 0, 0, 8] } },
      })
      .getBuffer();
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
      { label: 'Скарги: очікують розгляду', value: report.complaintsByStatus.OPEN },
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
