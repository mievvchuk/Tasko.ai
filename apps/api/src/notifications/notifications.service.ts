import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { announce } from './notification-events.js';

// Сповіщення про листування рахуємо окремо: їхній лічильник стоїть біля «Повідомлень», а не «Сповіщень»
export const messageTypes = ['NEW_MESSAGE', 'APPLICATION_MESSAGE'];

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    recipientId: string,
    actorId: string,
    event: {
      type: string;
      message: string;
      projectId?: string;
      taskId?: string;
    },
  ) {
    if (recipientId === actorId) return null;
    announce(recipientId);
    return this.prisma.client.orm.public.Notification.create({
      id: randomUUID(),
      userId: recipientId,
      type: event.type,
      message: event.message,
      projectId: event.projectId ?? null,
      taskId: event.taskId ?? null,
      readAt: null,
      createdAt: new Date(),
    });
  }

  async list(userId: string, page: number, limit: number) {
    const all = await this.prisma.client.orm.public.Notification.where({
      userId,
    })
      .orderBy((item) => item.createdAt.desc())
      .all();
    const items = all.slice((page - 1) * limit, page * limit);
    // Назви проєкту й завдання — щоб у списку було видно, про що подія
    const ids = (key: 'projectId' | 'taskId') => [
      ...new Set(items.flatMap((item) => (item[key] ? [item[key]] : []))),
    ];
    const projectIds = ids('projectId');
    const taskIds = ids('taskId');
    const projects = projectIds.length
      ? await this.prisma.client.orm.public.Project.where((project) =>
          project.id.in(projectIds),
        )
          .select('id', 'title')
          .all()
      : [];
    const tasks = taskIds.length
      ? await this.prisma.client.orm.public.Task.where((task) =>
          task.id.in(taskIds),
        )
          .select('id', 'title')
          .all()
      : [];
    return {
      items: items.map((item) => ({
        ...item,
        projectTitle:
          projects.find((project) => project.id === item.projectId)?.title ??
          null,
        taskTitle: tasks.find((task) => task.id === item.taskId)?.title ?? null,
      })),
      unreadCount: all.filter((item) => !item.readAt).length,
      unreadMessages: all.filter(
        (item) => !item.readAt && messageTypes.includes(item.type),
      ).length,
    };
  }

  async read(userId: string, id: string) {
    const item = await this.prisma.client.orm.public.Notification.where({
      id,
    }).first();
    if (!item || item.userId !== userId)
      throw new NotFoundException('Сповіщення не знайдено.');
    return this.prisma.client.orm.public.Notification.where({ id }).update({
      readAt: item.readAt ?? new Date(),
    });
  }

  // Непрочитані повідомлення по розмовах: id проєкту / заявки → кількість (лічильники в списку чатів)
  async unreadChats(userId: string) {
    const unread = (
      await this.prisma.client.orm.public.Notification.where({ userId }).all()
    ).filter((item) => !item.readAt && messageTypes.includes(item.type));
    const projects: Record<string, number> = {};
    const applications: Record<string, number> = {};
    for (const item of unread) {
      if (item.type === 'APPLICATION_MESSAGE' && item.applicationId)
        applications[item.applicationId] =
          (applications[item.applicationId] ?? 0) + 1;
      else if (item.type === 'NEW_MESSAGE' && item.projectId)
        projects[item.projectId] = (projects[item.projectId] ?? 0) + 1;
    }
    return { projects, applications };
  }

  // Прочитано лише відкриту розмову; без розмови — усі повідомлення (як раніше)
  async readChat(
    userId: string,
    chat: { projectId?: string; applicationId?: string },
  ) {
    const items = (
      await this.prisma.client.orm.public.Notification.where({ userId }).all()
    ).filter(
      (item) =>
        !item.readAt &&
        messageTypes.includes(item.type) &&
        (chat.applicationId
          ? item.type === 'APPLICATION_MESSAGE' &&
            item.applicationId === chat.applicationId
          : !chat.projectId ||
            (item.type === 'NEW_MESSAGE' && item.projectId === chat.projectId)),
    );
    const readAt = new Date();
    for (const item of items)
      await this.prisma.client.orm.public.Notification.where({
        id: item.id,
      }).update({ readAt });
    return { updated: items.length };
  }

  async readAll(userId: string, types?: string[]) {
    const items = (
      await this.prisma.client.orm.public.Notification.where({
        userId,
      }).all()
    ).filter((item) => !item.readAt && (!types || types.includes(item.type)));
    const readAt = new Date();
    for (const item of items)
      await this.prisma.client.orm.public.Notification.where({
        id: item.id,
      }).update({ readAt });
    return { updated: items.length };
  }
}
