import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from './mail.service.js';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const invalid = () =>
  new BadRequestException(
    'Посилання підтвердження некоректне, прострочене або вже використане.',
  );

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async issue(user: { id: string; email: string }) {
    const token = randomBytes(32).toString('base64url');
    const created = await this.prisma.client.transaction(async (tx) => {
      const db = tx.orm.public;
      const now = new Date();
      await db.User.where({ id: user.id }).update({ updatedAt: now });
      const current = await db.User.where({ id: user.id }).first();
      if (!current || current.emailVerifiedAt || current.status !== 'ACTIVE')
        return false;
      const previous = await db.EmailVerificationToken.where({
        userId: user.id,
      }).all();
      if (
        previous.some(
          (item) => now.getTime() - item.createdAt.getTime() < 60000,
        )
      )
        return false;
      for (const item of previous) {
        if (!item.usedAt)
          await db.EmailVerificationToken.where({ id: item.id }).update({
            usedAt: now,
          });
      }
      await db.EmailVerificationToken.create({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hash(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        usedAt: null,
      });
      return true;
    });
    if (created) await this.mail.sendVerification(user.email, token);
    return created;
  }

  async verify(token: string) {
    const tokenHash = hash(token);
    const record =
      await this.prisma.client.orm.public.EmailVerificationToken.where({
        tokenHash,
      }).first();
    if (!record) throw invalid();
    return this.prisma.client.transaction(async (tx) => {
      const db = tx.orm.public;
      const now = new Date();
      await db.User.where({ id: record.userId }).update({ updatedAt: now });
      const current = await db.EmailVerificationToken.where({
        tokenHash,
      }).first();
      const user = await db.User.where({ id: record.userId }).first();
      if (
        !current ||
        current.usedAt ||
        current.expiresAt <= now ||
        !user ||
        user.status !== 'ACTIVE'
      )
        throw invalid();
      await db.EmailVerificationToken.where({ id: current.id }).update({
        usedAt: now,
      });
      await db.User.where({ id: record.userId }).update({
        emailVerifiedAt: now,
        updatedAt: now,
      });
      return { message: 'Пошту підтверджено. Тепер можна увійти до Tasko.ai.' };
    });
  }
}
