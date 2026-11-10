import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectsService } from '../projects/projects.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type { PageDto } from '../projects/projects.dto.js';
import type {
  CreateTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from './tasks.dto.js';

const maxBoardColumns = 8;

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

  async create(user: CurrentUser, projectId: string, data: CreateTaskDto) {
    const project = await this.projects.requireOwner(user, projectId);
    this.projects.ensureWritable(project);
    if (data.assigneeId)
      await this.projects.requireAssignee(projectId, data.assigneeId);
    this.checkDeadline(data.deadline, project.deadline);
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
      createdAt: now,
      updatedAt: now,
    });
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
      task.status === 'IN_PROGRESS' &&
      data.assigneeId !== undefined &&
      data.assigneeId !== task.assigneeId
    )
      throw new ConflictException(
        'Не можна змінювати виконавця під час виконання.',
      );
    this.checkDeadline(data.deadline, project.deadline);
    return this.db.Task.where({ id, status: task.status }).update({
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
      updatedAt: new Date(),
    });
  }

  async status(
    user: CurrentUser,
    id: string,
    status: 'TODO' | 'IN_PROGRESS',
    columnId?: string,
  ) {
    const task = await this.find(user, id);
    const project = await this.projects.requireAccess(
      user,
      task.projectId,
      false,
    );
    if (project.status !== 'ACTIVE')
      throw new ConflictException(
        'Працювати із завданнями можна лише в активному проєкті.',
      );
    // Картку пересуває виконавець або власник проєкту (напр. з беклогу в роботу)
    const isOwner = project.clientId === user.id;
    if (task.assigneeId !== user.id && !isOwner)
      throw new ForbiddenException(
        'Статус змінює виконавець або власник проєкту.',
      );
    if (!['TODO', 'IN_PROGRESS'].includes(task.status))
      throw new ConflictException('Завдання вже здане або завершене.');
    // Власна колонка — етап «До виконання» або «У процесі»; статус має збігатися
    if (columnId) {
      const column = await this.db.BoardColumn.where({ id: columnId }).first();
      if (column?.status !== status || column.projectId !== task.projectId)
        throw new BadRequestException('Колонку не знайдено в цьому проєкті.');
    }
    const updated = await this.db.Task.where({
      id,
      status: task.status,
    }).update({
      status,
      columnId: columnId ?? null,
      updatedAt: new Date(),
    });
    await this.projects.logActivity(
      user.id,
      task.projectId,
      'TASK_STATUS',
      `Статус завдання «${task.title}» змінено на ${status}.`,
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
        ['TODO', 'IN_PROGRESS'].includes(task.status),
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
      const taken = await this.db.Task.where({
        id: task.id,
        assigneeId: null,
        status: 'TODO',
      }).update({ assigneeId: user.id, updatedAt: new Date() });
      if (!taken) continue;
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
        if (before.get(item.id) !== item.status)
          for (const task of await tx.orm.public.Task.where({
            columnId: item.id,
          }).all())
            await tx.orm.public.Task.where({ id: task.id }).update({
              status: item.status,
              updatedAt: new Date(),
            });
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

  // Завдання з видаленої колонки повертаються у звичайну колонку свого статусу
  async deleteColumn(user: CurrentUser, columnId: string) {
    const column = await this.db.BoardColumn.where({ id: columnId }).first();
    if (!column) throw new NotFoundException('Колонку не знайдено.');
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, column.projectId),
    );
    return this.projects.prisma.client.transaction(async (tx) => {
      const tasks = await tx.orm.public.Task.where({ columnId }).all();
      for (const task of tasks)
        await tx.orm.public.Task.where({ id: task.id }).update({
          columnId: null,
        });
      await tx.orm.public.BoardColumn.where({ id: columnId }).delete();
      return { id: columnId };
    });
  }

  async orders(user: CurrentUser, projectId: string, page: PageDto) {
    await this.projects.requireAccess(user, projectId);
    return this.db.Order.where({ projectId })
      .orderBy((order) => order.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
  }

  async createOrder(user: CurrentUser, projectId: string) {
    const project = await this.projects.requireOwner(user, projectId);
    this.projects.ensureWritable(project);
    const now = new Date();
    return this.db.Order.create({
      id: randomUUID(),
      projectId,
      clientId: project.clientId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });
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
      const tasks = await this.db.Task.where({ projectId: order.projectId })
        .select('status')
        .all();
      if (tasks.some((task) => task.status !== 'DONE'))
        throw new ConflictException('Спочатку завершіть завдання проєкту.');
    }
    return this.db.Order.where({ id, status: order.status }).update({
      status,
      updatedAt: new Date(),
    });
  }
}
