import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreatePortfolioItemDto,
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
}

export interface CurrentUser extends PublicUser {
  sessionId: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
