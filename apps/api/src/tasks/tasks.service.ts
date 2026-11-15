import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  syncMilestones,
  syncProgress,
} from '../projects/milestone-progress.js';
import { moveRule, type MoveActor, type TaskStatus } from './task-workflow.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type { PageDto } from '../projects/projects.dto.js';
import type {
  CreateTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from './tasks.dto.js';

const maxBoardColumns = 8;

// Назви етапів для журналу дій
const statusTitles: Record<TaskStatus, string> = {
  TODO: 'До виконання',
  IN_PROGRESS: 'У роботі',
  REVIEW: 'На перевірці',
  REVISION: 'На доопрацюванні',
  DONE: 'Завершено',
};

// Черга вільних завдань: спершу з найближчим дедлайном (без дедлайну — у кінці),
// далі вищий пріоритет, далі давніше створені
const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
export function compareQueue(
  a: { deadline: Date | null; priority: string; createdAt: Date },
  b: { deadline: Date | null; priority: string; createdAt: Date },
) {
  const due = (task: { deadline: Date | null }) =>
    task.deadline?.getTime() ?? Infinity;
  return (
    due(a) - due(b) ||
    (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3) ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

// Місце колонки на дошці. Стандартні «До виконання» й «У процесі» стоять на 1000 і 2000,
// власні колонки — між ними за позицією; усе до 2000 належить етапу «До виконання».
// Старі колонки «У процесі» мали малі позиції, тож їх зсуваємо за 2000.
export function columnKey(column: { status: string; position: number }) {
  return column.status === 'IN_PROGRESS' && column.position < 2000
    ? 2000 + column.position
    : column.position;
}

// Нова колонка стає в кінець свого етапу: «До виконання» — перед стандартною колонкою,
// «У процесі» — після неї. Позиція не має збігатися з наявними (унікальна в проєкті).
function nextPosition(
  columns: { status: string; position: number }[],
  status: 'TODO' | 'IN_PROGRESS',
) {
  const keys = columns.map(columnKey);
  const [low, high] = status === 'TODO' ? [0, 1000] : [2000, 3000];
  const inStage = keys.filter((key) => key >= low && key < high);
  let position = Math.max(low + 90, ...inStage) + 10;
  const taken = new Set(columns.map((column) => column.position));
  while (taken.has(position)) position += 1;
  return position;
}

// Новий порядок дошки → позиція й етап кожної власної колонки.
// order — id власних колонок і стандартні 'TODO', 'IN_PROGRESS' у потрібному порядку.
export function planColumnOrder(order: string[], columnIds: string[]) {
  const expected = new Set([...columnIds, 'TODO', 'IN_PROGRESS']);
  if (
    order.length !== expected.size ||
    new Set(order).size !== order.length ||
    order.some((key) => !expected.has(key))
  )
    throw new BadRequestException('Порядок має містити всі колонки дошки.');
  if (order.indexOf('TODO') > order.indexOf('IN_PROGRESS'))
    throw new BadRequestException(
      '«До виконання» має стояти перед «У процесі».',
    );
  const bases = [100, 1100, 2100];
  const counts = [0, 0, 0];
  let segment = 0;
  const plan: {
    id: string;
    position: number;
    status: 'TODO' | 'IN_PROGRESS';
  }[] = [];
  for (const key of order) {
    if (key === 'TODO') segment = 1;
    else if (key === 'IN_PROGRESS') segment = 2;
    else
      plan.push({
        id: key,
        position: bases[segment] + 10 * counts[segment]++,
        status: segment < 2 ? 'TODO' : 'IN_PROGRESS',
      });
  }
  return plan;
}

@Injectable()
export class TasksService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private get db() {
    return this.projects.prisma.client.orm.public;
  }

  async find(user: CurrentUser, id: string) {
    const task = await this.db.Task.where({ id }).first();
    if (!task) throw new NotFoundException('Завдання не знайдено.');
    await this.projects.requireAccess(user, task.projectId);
    return task;
  }

  async list(user: CurrentUser, projectId: string, filters: TaskQueryDto) {
    await this.projects.requireAccess(user, projectId);
    let query = this.db.Task.where({ projectId });
    if (filters.status) query = query.where({ status: filters.status });
    if (filters.priority) query = query.where({ priority: filters.priority });
    if (filters.assigneeId)
      query = query.where({ assigneeId: filters.assigneeId });
    if (filters.milestoneId)
      query = query.where({ milestoneId: filters.milestoneId });
    if (filters.search) {
      // Символи LIKE у введеному тексті шукаємо буквально.
      const search = filters.search.replace(/[\\%_]/g, '\\$&');
      query = query.where((task) => task.title.ilike(`%${search}%`));
    }
    if (filters.overdue)
      query = query
        .where((task) => task.deadline.lt(new Date()))
        .where((task) => task.status.neq('DONE'));
    return query
      .orderBy((task) => task.createdAt.desc())
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .all();
  }

  private checkDeadline(
    deadline: string | undefined,
    projectDeadline: Date | null,
  ) {
    if (deadline && projectDeadline && new Date(deadline) > projectDeadline)
      throw new BadRequestException(
        'Дедлайн завдання не може бути пізнішим за дедлайн проєкту.',
      );
  }

  // Етап має бути з цього ж проєкту й ще не прийнятий
  private async checkMilestone(projectId: string, milestoneId?: string | null) {
    if (!milestoneId) return;
    const milestone = await this.db.ProjectMilestone.where({
      id: milestoneId,
    }).first();
    if (milestone?.projectId !== projectId)
      throw new BadRequestException('Етап не знайдено в цьому проєкті.');
    if (milestone.status === 'COMPLETED')
      throw new ConflictException(
        'Етап уже прийнято, додати до нього завдання не можна.',
      );
  }

  async create(user: CurrentUser, projectId: string, data: CreateTaskDto) {
    const project = await this.projects.requireOwner(user, projectId);
    this.projects.ensureWritable(project);
    if (data.assigneeId)
      await this.projects.requireAssignee(projectId, data.assigneeId);
    this.checkDeadline(data.deadline, project.deadline);
    await this.checkMilestone(projectId, data.milestoneId);
    const now = new Date();
    const task = await this.db.Task.create({
      id: randomUUID(),
      projectId,
      title: data.title,
      description: data.description ?? null,
      assigneeId: data.assigneeId ?? null,
      priority: data.priority ?? 'MEDIUM',
      rating: data.rating ?? null,
      status: 'TODO',
      deadline: data.deadline ? new Date(data.deadline) : null,
      milestoneId: data.milestoneId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    // Нове невиконане завдання повертає етап «На перевірці» в роботу
    await syncMilestones(this.db, [task.milestoneId]);
    if (data.assigneeId)
      await this.projects.notify(
        data.assigneeId,
        user.id,
        'TASK_ASSIGNED',
        `Вам призначено завдання «${data.title}».`,
        projectId,
        task.id,
      );
    await this.projects.logActivity(
      user.id,
      projectId,
      'TASK_CREATED',
      `Створено завдання «${data.title}».`,
    );
    return task;
  }

  async update(user: CurrentUser, id: string, data: UpdateTaskDto) {
    const task = await this.find(user, id);
    const project = await this.projects.requireOwner(user, task.projectId);
    this.projects.ensureWritable(project);
    if (['REVIEW', 'DONE'].includes(task.status))
      throw new ConflictException(
        'Не можна редагувати здане або завершене завдання.',
      );
    if (data.assigneeId)
      await this.projects.requireAssignee(task.projectId, data.assigneeId);
    if (
      ['IN_PROGRESS', 'REVISION'].includes(task.status) &&
      data.assigneeId !== undefined &&
      data.assigneeId !== task.assigneeId
    )
      throw new ConflictException(
        'Не можна змінювати виконавця під час виконання.',
      );
    this.checkDeadline(data.deadline, project.deadline);
    if (data.milestoneId !== undefined)
      await this.checkMilestone(task.projectId, data.milestoneId);
    const [updated] = await this.db.Task.where({
      id,
      status: task.status,
    }).updateAll({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.deadline !== undefined
        ? { deadline: data.deadline ? new Date(data.deadline) : null }
        : {}),
      ...(data.milestoneId !== undefined
        ? { milestoneId: data.milestoneId }
        : {}),
      updatedAt: new Date(),
    });
    if (!updated) throw new ConflictException('Стан завдання вже змінився.');
    // Завдання могло перейти в інший етап: перераховуємо обидва
    if (data.milestoneId !== undefined)
      await syncMilestones(this.db, [task.milestoneId, data.milestoneId]);
    return updated;
  }

  // Хто рухає картку відносно завдання і чи можна взагалі працювати з дошкою
  async moveContext(user: CurrentUser, id: string) {
    const task = await this.find(user, id);
    // Без винятку для адміністратора: чужі дошки він лише переглядає
    const project = await this.projects.requireAccess(
      user,
      task.projectId,
      false,
    );
    if (project.status !== 'ACTIVE')
      throw new ConflictException(
        'Працювати із завданнями можна лише в активному проєкті.',
      );
    const member =
      user.role === 'FREELANCER'
        ? await this.db.ProjectMember.where({
            projectId: task.projectId,
            userId: user.id,
          }).first()
        : null;
    const actor: MoveActor = {
      isOwner: project.clientId === user.id,
      isAssignee: Boolean(task.assigneeId) && task.assigneeId === user.id,
      isMember: Boolean(member),
    };
    return { task, project, actor };
  }

  // Переміщення картки, крім здачі на перевірку та самої перевірки
  // (їх веде CollaborationService.submit/review, бо там створюється запис здачі).
  // Правила переходів — у task-workflow.ts; кожне оновлення умовне на попередній стан,
  // тож одночасна зміна іншим користувачем дає 409, а не зіпсований стан.
  async transition(
    user: CurrentUser,
    id: string,
    to: TaskStatus,
    options: { columnId?: string; reason?: string } = {},
  ) {
    const { task, project, actor } = await this.moveContext(user, id);
    const from = task.status as TaskStatus;
    const rule = moveRule(task, to, actor);
    if (!rule.allowed) throw new ForbiddenException(rule.reason);
    if (from === 'REVIEW' || to === 'REVIEW')
      throw new BadRequestException(
        'Здача й перевірка роботи проходять через результат роботи.',
      );
    const reason = options.reason?.trim();
    if (rule.needs === 'reason' && !reason)
      throw new BadRequestException('Вкажіть причину повернення.');
    const working = to === 'TODO' || to === 'IN_PROGRESS';
    // Власна колонка — лише етапів «До виконання» й «У процесі», того ж статусу й проєкту
    if (options.columnId) {
      const column = await this.db.BoardColumn.where({
        id: options.columnId,
      }).first();
      if (
        !working ||
        column?.status !== to ||
        column.projectId !== task.projectId
      )
        throw new BadRequestException('Колонку не знайдено в цьому проєкті.');
    }
    if (from === 'DONE' && task.milestoneId) {
      const milestone = await this.db.ProjectMilestone.where({
        id: task.milestoneId,
      }).first();
      if (milestone?.status === 'COMPLETED')
        throw new ConflictException(
          'Етап цього завдання вже прийнято — повернути завдання не можна.',
        );
    }
    if (rule.takes) {
      // Вільне завдання бере фрілансер — те саме правило, що й «Взяти наступне»
      const unfinished = await this.db.Task.where({
        projectId: task.projectId,
        assigneeId: user.id,
      }).all();
      const busy = unfinished.find((item) =>
        ['TODO', 'IN_PROGRESS', 'REVISION'].includes(item.status),
      );
      if (busy)
        throw new ConflictException(
          `Спершу завершіть або передайте на перевірку «${busy.title}».`,
        );
    }
    // updateAll, бо update() у Prisma 8 оновлює рядок лише за id і пропустив би умову на стан
    const [updated] = await this.db.Task.where({
      id,
      status: from,
      ...(rule.takes ? { assigneeId: null } : {}),
    }).updateAll({
      status: to,
      columnId: working ? (options.columnId ?? null) : null,
      ...(rule.takes ? { assigneeId: user.id } : {}),
      updatedAt: new Date(),
    });
    if (!updated)
      throw new ConflictException('Стан завдання вже змінився. Оновіть дошку.');
    // Прийняте завдання може завершити етап, а з ним і весь проєкт
    if (to === 'DONE')
      await syncProgress(this.db, task.projectId, [task.milestoneId], user.id);
    else await syncMilestones(this.db, [task.milestoneId]);
    // Аудит: хто, коли й який перехід виконав
    await this.projects.logActivity(
      user.id,
      task.projectId,
      'TASK_MOVED',
      `«${task.title}»: ${statusTitles[from]} → ${statusTitles[to]}` +
        (reason ? `. Причина: ${reason}` : '.'),
    );
    if (rule.takes)
      await this.projects.notify(
        project.clientId,
        user.id,
        'TASK_TAKEN',
        `${user.name} узяв завдання «${task.title}».`,
        task.projectId,
        task.id,
      );
    if (to === 'REVISION' && task.assigneeId)
      await this.projects.notify(
        task.assigneeId,
        user.id,
        'WORK_REVIEWED',
        `Завдання «${task.title}» повернуто на доопрацювання. Причина: ${reason}`,
        task.projectId,
        task.id,
      );
    return updated;
  }

  // Фрілансер-учасник бере наступне вільне завдання з черги проєкту.
  // Поки в нього є незавершене завдання (до виконання чи в роботі), нове взяти не можна.
  async takeNext(user: CurrentUser, projectId: string) {
    if (user.role !== 'FREELANCER')
      throw new ForbiddenException('Брати завдання з черги може фрілансер.');
    const project = await this.projects.requireAccess(user, projectId, false);
    if (project.status !== 'ACTIVE')
      throw new ConflictException(
        'Працювати із завданнями можна лише в активному проєкті.',
      );
    await this.projects.requireAssignee(projectId, user.id);
    const tasks = await this.db.Task.where({ projectId }).all();
    const unfinished = tasks.find(
      (task) =>
        task.assigneeId === user.id &&
        ['TODO', 'IN_PROGRESS', 'REVISION'].includes(task.status),
    );
    if (unfinished)
      throw new ConflictException(
        `Спершу завершіть або передайте на перевірку «${unfinished.title}».`,
      );
    const queue = tasks
      .filter((task) => task.status === 'TODO' && !task.assigneeId)
      .sort(compareQueue);
    // Інший фрілансер міг узяти завдання одночасно: беремо наступне в черзі
    for (const task of queue) {
      const [taken] = await this.db.Task.where({
        id: task.id,
        assigneeId: null,
        status: 'TODO',
      }).updateAll({ assigneeId: user.id, updatedAt: new Date() });
      if (!taken) continue;
      // Паралельний запит того ж фрілансера міг щойно взяти інше завдання: тоді віддаємо це назад
      const mine = await this.db.Task.where({ projectId, assigneeId: user.id })
        .where((row) => row.status.in(['TODO', 'IN_PROGRESS']))
        .all();
      if (mine.length > 1) {
        await this.db.Task.where({
          id: task.id,
          assigneeId: user.id,
          status: 'TODO',
        }).updateAll({ assigneeId: null, updatedAt: new Date() });
        throw new ConflictException(
          'Ви вже взяли завдання з черги. Спершу завершіть його.',
        );
      }
      await this.projects.logActivity(
        user.id,
        projectId,
        'TASK_TAKEN',
        `${user.name} узяв завдання «${task.title}» з черги.`,
      );
      await this.projects.notify(
        project.clientId,
        user.id,
        'TASK_TAKEN',
        `${user.name} узяв завдання «${task.title}».`,
        projectId,
        task.id,
      );
      return taken;
    }
    throw new NotFoundException('Вільних завдань у черзі немає.');
  }

  // Власні колонки канбану проєкту в порядку на дошці
  async columns(user: CurrentUser, projectId: string) {
    await this.projects.requireAccess(user, projectId);
    const columns = await this.db.BoardColumn.where({ projectId })
      .orderBy((column) => column.position.asc())
      .all();
    return columns.sort((a, b) => columnKey(a) - columnKey(b));
  }

  // Перетягування колонок: зберігаємо новий порядок. Якщо колонка перейшла в інший етап,
  // її завдання отримують статус цього етапу.
  async reorderColumns(user: CurrentUser, projectId: string, order: string[]) {
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, projectId),
    );
    const columns = await this.db.BoardColumn.where({ projectId }).all();
    const plan = planColumnOrder(
      order,
      columns.map((column) => column.id),
    );
    const before = new Map(columns.map((column) => [column.id, column.status]));
    await this.projects.prisma.client.transaction(async (tx) => {
      // Спершу тимчасові від'ємні позиції, бо позиція в проєкті унікальна
      for (const [index, item] of plan.entries())
        await tx.orm.public.BoardColumn.where({ id: item.id }).update({
          position: -(index + 1),
        });
      for (const item of plan) {
        await tx.orm.public.BoardColumn.where({ id: item.id }).update({
          position: item.position,
          status: item.status,
        });
        if (before.get(item.id) === item.status) continue;
        // Здані й прийняті завдання лишаються у своєму статусі (перевірку не обходимо),
        // але виходять із колонки, щоб після доопрацювання не зникнути з дошки
        await tx.orm.public.Task.where({ columnId: item.id })
          .where((task) => task.status.in(['TODO', 'IN_PROGRESS']))
          .updateAll({ status: item.status, updatedAt: new Date() });
        await tx.orm.public.Task.where({ columnId: item.id })
          .where((task) => task.status.in(['REVIEW', 'DONE']))
          .updateAll({ columnId: null });
      }
    });
    return this.columns(user, projectId);
  }

  async addColumn(
    user: CurrentUser,
    projectId: string,
    title: string,
    status: 'TODO' | 'IN_PROGRESS' = 'IN_PROGRESS',
  ) {
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, projectId),
    );
    const columns = await this.columns(user, projectId);
    if (columns.length >= maxBoardColumns)
      throw new ConflictException(
        `Можна додати не більше ${maxBoardColumns} колонок.`,
      );
    return this.db.BoardColumn.create({
      id: randomUUID(),
      projectId,
      title,
      status,
      position: nextPosition(columns, status),
      createdAt: new Date(),
    });
  }

  // Назву власної колонки можна змінити, не чіпаючи її етапу
  async renameColumn(user: CurrentUser, columnId: string, title: string) {
    const column = await this.db.BoardColumn.where({ id: columnId }).first();
    if (!column) throw new NotFoundException('Колонку не знайдено.');
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, column.projectId),
    );
    const updated = await this.db.BoardColumn.where({ id: columnId }).update({
      title,
    });
    await this.projects.logActivity(
      user.id,
      column.projectId,
      'COLUMN_RENAMED',
      `Колонку «${column.title}» перейменовано на «${title}».`,
    );
    return updated;
  }

  // Картки з видаленої колонки переходять у вибрану колонку того самого етапу
  // (moveTo — id власної колонки) або в стандартну колонку свого статусу.
  // Стандартні колонки не зберігаються в базі, тож останню колонку етапу видалити неможливо.
  async deleteColumn(user: CurrentUser, columnId: string, moveTo?: string) {
    const column = await this.db.BoardColumn.where({ id: columnId }).first();
    if (!column) throw new NotFoundException('Колонку не знайдено.');
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, column.projectId),
    );
    if (moveTo) {
      const target = await this.db.BoardColumn.where({ id: moveTo }).first();
      if (
        !target ||
        target.id === columnId ||
        target.projectId !== column.projectId ||
        target.status !== column.status
      )
        throw new BadRequestException(
          'Картки можна перенести лише в колонку того самого етапу.',
        );
    }
    return this.projects.prisma.client.transaction(async (tx) => {
      const tasks = await tx.orm.public.Task.where({ columnId }).all();
      for (const task of tasks)
        await tx.orm.public.Task.where({ id: task.id }).update({
          columnId: moveTo ?? null,
        });
      await tx.orm.public.BoardColumn.where({ id: columnId }).delete();
      await tx.orm.public.ActivityLog.create({
        id: randomUUID(),
        actorId: user.id,
        projectId: column.projectId,
        type: 'COLUMN_DELETED',
        message: `Видалено колонку «${column.title}»; карток перенесено: ${tasks.length}.`,
        createdAt: new Date(),
      });
      return { id: columnId, moved: tasks.length };
    });
  }

  // Замовлення створюються лише під час прийняття заявки (ProjectsService.acceptApplication)
  async orders(user: CurrentUser, projectId: string, page: PageDto) {
    await this.projects.requireAccess(user, projectId);
    const orders = await this.db.Order.where({ projectId })
      .orderBy((order) => order.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
    return Promise.all(
      orders.map(async (order) => ({
        ...order,
        freelancer: order.freelancerId
          ? await this.db.User.where({ id: order.freelancerId })
              .select('id', 'name', 'avatarUrl')
              .first()
          : null,
      })),
    );
  }

  async updateOrder(user: CurrentUser, id: string, status: string) {
    const order = await this.db.Order.where({ id }).first();
    if (!order) throw new NotFoundException('Замовлення не знайдено.');
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, order.projectId),
    );
    const transitions: Record<string, string[]> = {
      PENDING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };
    if (!transitions[order.status]?.includes(status))
      throw new ConflictException('Недозволена зміна статусу замовлення.');
    if (status === 'COMPLETED') {
      // Угода з виконавцем закривається, коли прийнято всі його завдання;
      // старі замовлення без виконавця — коли прийнято всі завдання проєкту.
      const tasks = await this.db.Task.where(
        order.freelancerId
          ? { projectId: order.projectId, assigneeId: order.freelancerId }
          : { projectId: order.projectId },
      )
        .select('status')
        .all();
      if (tasks.some((task) => task.status !== 'DONE'))
        throw new ConflictException(
          order.freelancerId
            ? 'Спочатку прийміть усі завдання цього виконавця.'
            : 'Спочатку завершіть завдання проєкту.',
        );
    }
    const [updated] = await this.db.Order.where({
      id,
      status: order.status,
    }).updateAll({
      status,
      updatedAt: new Date(),
    });
    if (!updated)
      throw new ConflictException('Статус замовлення вже змінився.');
    return updated;
  }
}
