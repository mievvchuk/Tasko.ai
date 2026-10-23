import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

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
    return {
      items: all.slice((page - 1) * limit, page * limit),
      unreadCount: all.filter((item) => !item.readAt).length,
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

  async readAll(userId: string) {
    const items = await this.prisma.client.orm.public.Notification.where({
      userId,
    }).all();
    const readAt = new Date();
    for (const item of items.filter((value) => !value.readAt))
      await this.prisma.client.orm.public.Notification.where({
        id: item.id,
      }).update({ readAt });
    return { updated: items.filter((value) => !value.readAt).length };
  }
}
