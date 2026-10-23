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
      ...(data.deadline !== undefined
        ? { deadline: data.deadline ? new Date(data.deadline) : null }
        : {}),
      updatedAt: new Date(),
    });
  }

  async status(user: CurrentUser, id: string, status: 'TODO' | 'IN_PROGRESS') {
    const task = await this.find(user, id);
    const project = await this.projects.requireAccess(user, task.projectId);
    if (project.status !== 'ACTIVE')
      throw new ConflictException(
        'Працювати із завданнями можна лише в активному проєкті.',
      );
    if (task.assigneeId !== user.id && user.role !== 'ADMIN')
      throw new ForbiddenException('Статус змінює призначений виконавець.');
    if (!['TODO', 'IN_PROGRESS'].includes(task.status))
      throw new ConflictException('Завдання вже здане або завершене.');
    const updated = await this.db.Task.where({
      id,
      status: task.status,
    }).update({
      status,
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
