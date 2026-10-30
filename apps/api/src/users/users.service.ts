import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UploadedFile } from '../collaboration/files.service.js';
import { avatarFilePattern, avatarMime, validateAvatar } from './avatar.js';
import type {
  CreatePortfolioItemDto,
  UpdateAccountDto,
  UpdateFreelancerProfileDto,
  UpdatePortfolioItemDto,
} from './users.dto.js';

export type UserRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  avatarUrl?: string | null;
  createdAt?: Date;
}

export interface CurrentUser extends PublicUser {
  sessionId: string;
}

// Дані користувача, які можна віддати клієнту (без хешу пароля, секрету 2FA тощо)
export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  avatarUrl: string | null;
  createdAt: Date;
}): PublicUser {
  if (!['CLIENT', 'FREELANCER', 'ADMIN'].includes(user.role))
    throw new ForbiddenException('Роль користувача некоректна.');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    twoFactorEnabled: user.twoFactorEnabled,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  // Фото профілів лежать окремо від файлів проєктів: storage/avatars
  private readonly avatarDirectory = fileURLToPath(
    new URL('../../storage/avatars/', import.meta.url),
  );
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async requireUser(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Користувача не знайдено.');
    return user;
  }

  async updateAccount(user: CurrentUser, data: UpdateAccountDto) {
    await this.requireUser(user.id);
    const updated = await this.prisma.client.orm.public.User.where({
      id: user.id,
    }).update({ name: data.name, updatedAt: new Date() });
    return toPublicUser(updated!);
  }

  // Зберігає файл фото на диску, а в БД записує лише посилання на нього
  async setAvatar(user: CurrentUser, file: UploadedFile | undefined) {
    const format = validateAvatar(file);
    const current = await this.requireUser(user.id);
    const fileName = `${randomUUID()}.${format.extension}`;
    await mkdir(this.avatarDirectory, { recursive: true });
    await writeFile(join(this.avatarDirectory, fileName), file!.buffer, {
      flag: 'wx',
    });
    let updated;
    try {
      updated = await this.prisma.client.orm.public.User.where({
        id: user.id,
      }).update({ avatarUrl: `/avatars/${fileName}`, updatedAt: new Date() });
    } catch (error) {
      await this.removeAvatarFile(`/avatars/${fileName}`);
      throw error;
    }
    await this.removeAvatarFile(current.avatarUrl);
    return toPublicUser(updated!);
  }

  async removeAvatar(user: CurrentUser) {
    const current = await this.requireUser(user.id);
    const updated = await this.prisma.client.orm.public.User.where({
      id: user.id,
    }).update({ avatarUrl: null, updatedAt: new Date() });
    await this.removeAvatarFile(current.avatarUrl);
    return toPublicUser(updated!);
  }

  // Шлях до файлу фото для публічної віддачі; ім'я перевіряємо, щоб не вийти за межі папки
  async avatarFile(fileName: string) {
    const mime = avatarMime(fileName);
    if (!avatarFilePattern.test(fileName) || !mime)
      throw new NotFoundException('Фото не знайдено.');
    const path = join(this.avatarDirectory, fileName);
    try {
      await stat(path);
    } catch {
      throw new NotFoundException('Фото не знайдено.');
    }
    return { path, mime };
  }

  private async removeAvatarFile(avatarUrl: string | null) {
    const fileName = avatarUrl?.replace(/^\/avatars\//, '');
    if (!fileName || !avatarFilePattern.test(fileName)) return;
    try {
      await unlink(join(this.avatarDirectory, fileName));
    } catch {
      this.logger.warn('Не вдалося видалити старе фото профілю.');
    }
  }

  findByEmail(email: string) {
    return this.prisma.client.orm.public.User.where({ email }).first();
  }

  findById(id: string) {
    return this.prisma.client.orm.public.User.where({ id }).first();
  }

  create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: 'CLIENT' | 'FREELANCER';
    emailVerifiedAt?: Date | null;
  }) {
    const now = new Date();
    return this.prisma.client.orm.public.User.create({
      ...data,
      id: randomUUID(),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  private requireFreelancer(user: CurrentUser) {
    if (user.role !== 'FREELANCER')
      throw new ForbiddenException('Профіль виконавця доступний фрилансеру.');
  }

  private normalizeSkills(values: string[]) {
    return [
      ...new Set(
        values.map((value) => value.trim().toLowerCase()).filter(Boolean),
      ),
    ];
  }

  async getFreelancerProfile(user: CurrentUser) {
    this.requireFreelancer(user);
    const [profile, links, portfolio] = await Promise.all([
      this.prisma.client.orm.public.FreelancerProfile.where({
        userId: user.id,
      }).first(),
      this.prisma.client.orm.public.FreelancerSkill.where({
        userId: user.id,
      }).all(),
      this.prisma.client.orm.public.PortfolioItem.where({ userId: user.id })
        .orderBy((item) => item.createdAt.desc())
        .all(),
    ]);
    const skills = links.length
      ? await this.prisma.client.orm.public.Skill.where((skill) =>
          skill.id.in(links.map((link) => link.skillId)),
        )
          .orderBy((skill) => skill.name.asc())
          .all()
      : [];
    return {
      bio: profile?.bio ?? '',
      hourlyRate: profile?.hourlyRate ?? null,
      availability: profile?.availability ?? 'AVAILABLE',
      skills,
      portfolio,
    };
  }

  async updateFreelancerProfile(
    user: CurrentUser,
    data: UpdateFreelancerProfileDto,
  ) {
    this.requireFreelancer(user);
    const names = this.normalizeSkills(data.skills);
    await this.prisma.client.transaction(async (tx) => {
      const current = await tx.orm.public.FreelancerProfile.where({
        userId: user.id,
      }).first();
      const profile = {
        bio: data.bio?.trim() || null,
        hourlyRate: data.hourlyRate ?? null,
        availability: data.availability,
        updatedAt: new Date(),
      };
      if (current)
        await tx.orm.public.FreelancerProfile.where({ userId: user.id }).update(
          profile,
        );
      else
        await tx.orm.public.FreelancerProfile.create({
          userId: user.id,
          ...profile,
        });

      const oldLinks = await tx.orm.public.FreelancerSkill.where({
        userId: user.id,
      }).all();
      for (const link of oldLinks) {
        await tx.orm.public.FreelancerSkill.where({
          userId: user.id,
          skillId: link.skillId,
        }).delete();
      }
      for (const name of names) {
        let skill = await tx.orm.public.Skill.where({ name }).first();
        if (!skill)
          skill = await tx.orm.public.Skill.create({ id: randomUUID(), name });
        await tx.orm.public.FreelancerSkill.create({
          userId: user.id,
          skillId: skill.id,
        });
      }
    });
    return this.getFreelancerProfile(user);
  }

  listPortfolio(user: CurrentUser) {
    this.requireFreelancer(user);
    return this.prisma.client.orm.public.PortfolioItem.where({
      userId: user.id,
    })
      .orderBy((item) => item.createdAt.desc())
      .all();
  }

  createPortfolioItem(user: CurrentUser, data: CreatePortfolioItemDto) {
    this.requireFreelancer(user);
    const now = new Date();
    return this.prisma.client.orm.public.PortfolioItem.create({
      id: randomUUID(),
      userId: user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      url: data.url,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updatePortfolioItem(
    user: CurrentUser,
    id: string,
    data: UpdatePortfolioItemDto,
  ) {
    this.requireFreelancer(user);
    const item = await this.prisma.client.orm.public.PortfolioItem.where({
      id,
    }).first();
    if (!item || item.userId !== user.id)
      throw new NotFoundException('Роботу портфоліо не знайдено.');
    return this.prisma.client.orm.public.PortfolioItem.where({ id }).update({
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description.trim() || null }
        : {}),
      ...(data.url !== undefined ? { url: data.url } : {}),
      updatedAt: new Date(),
    });
  }

  async deletePortfolioItem(user: CurrentUser, id: string) {
    this.requireFreelancer(user);
    const item = await this.prisma.client.orm.public.PortfolioItem.where({
      id,
    }).first();
    if (!item || item.userId !== user.id)
      throw new NotFoundException('Роботу портфоліо не знайдено.');
    await this.prisma.client.orm.public.PortfolioItem.where({ id }).delete();
    return { deleted: true };
  }

  listSkills() {
    return this.prisma.client.orm.public.Skill.orderBy((skill) =>
      skill.name.asc(),
    ).all();
  }

  listCategories() {
    return this.prisma.client.orm.public.ProjectCategory.orderBy((category) =>
      category.name.asc(),
    ).all();
  }
}
