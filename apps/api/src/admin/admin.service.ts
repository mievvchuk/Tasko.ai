import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake';
import { fileURLToPath } from 'node:url';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type { UpdateUserDto, UserQueryDto } from './admin.dto.js';

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
    return query
      .select('id', 'name', 'email', 'role', 'status', 'createdAt')
      .orderBy((person) => person.createdAt.desc())
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .all();
  }
  async update(user: CurrentUser, id: string, data: UpdateUserDto) {
    this.requireAdmin(user);
    if (
      id === user.id &&
      (data.status === 'BLOCKED' || (data.role && data.role !== 'ADMIN'))
    )
      throw new ConflictException(
        'Не можна заблокувати себе або змінити власну роль.',
      );
    return this.prisma.client.transaction(async (tx) => {
      const target = await tx.orm.public.User.where({ id }).first();
      if (!target) throw new NotFoundException('Користувача не знайдено.');
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
  async report(user: CurrentUser) {
    this.requireAdmin(user);
    const users = await this.prisma.client.orm.public.User.select(
      'role',
      'status',
    ).all();
    const projects =
      await this.prisma.client.orm.public.Project.select('status').all();
    const tasks = await this.prisma.client.orm.public.Task.select(
      'status',
      'deadline',
    ).all();
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
    ];
  }

  private csvValue(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
