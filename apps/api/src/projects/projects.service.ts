import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type {
  CreateProjectDto,
  CreateApplicationDto,
  CreateFreelancerReviewDto,
  UpdateProjectDto,
  PageDto,
  ProjectQueryDto,
  MarketplaceQueryDto,
} from './projects.dto.js';
import { hasDatabaseCode } from '../prisma/database-error.js';

// Статуси, після яких проєкт або замовлення вважається закритим.
const closedStatuses = ['COMPLETED', 'CANCELLED'];

// Поля проєкту, які можна змінити через update.
type ProjectChanges = {
  title?: string;
  description?: string;
  deadline?: Date | null;
  status?: string;
  budgetMin?: number;
  budgetMax?: number;
  categoryId?: string;
  updatedAt: Date;
};

export function validateBudget(budgetMin?: number, budgetMax?: number) {
  if (
    budgetMin !== undefined &&
    budgetMax !== undefined &&
    budgetMax < budgetMin
  )
    throw new BadRequestException(
      'Максимальний бюджет не може бути меншим за мінімальний.',
    );
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client.orm.public;
  }

  async requireAccess(user: CurrentUser, id: string) {
    const project = await this.prisma.client.orm.public.Project.where({
      id,
    }).first();
    if (!project) throw new NotFoundException('Проєкт не знайдено.');
    if (user.role === 'ADMIN' || project.clientId === user.id) return project;
    const member = await this.prisma.client.orm.public.ProjectMember.where({
      projectId: id,
      userId: user.id,
    }).first();
    if (!member)
      throw new ForbiddenException('Немає доступу до цього проєкту.');
    return project;
  }

  async requireOwner(user: CurrentUser, id: string) {
    const project = await this.requireAccess(user, id);
    if (user.role !== 'ADMIN' && project.clientId !== user.id)
      throw new ForbiddenException('Операція доступна власнику проєкту.');
    return project;
  }

  ensureWritable(project: { status: string }) {
    if (closedStatuses.includes(project.status))
      throw new ConflictException('Проєкт уже закрито.');
  }

  private validateDeadline(deadline?: string | null) {
    if (!deadline) return;
    const timestamp = new Date(deadline).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw new BadRequestException('Дедлайн проєкту має бути в майбутньому.');
    }
  }

  private getProgress(tasks: { status: string }[]) {
    const completedTasks = tasks.filter(
      (task) => task.status === 'DONE',
    ).length;
    return {
      totalTasks: tasks.length,
      completedTasks,
      progress: tasks.length
        ? Math.round((completedTasks / tasks.length) * 100)
        : 0,
    };
  }

  // Повертає сторінку проєктів, доступних користувачу, разом із прогресом.
  async list(user: CurrentUser, page: ProjectQueryDto) {
    let query = this.db.Project;
    if (page.status) query = query.where({ status: page.status });
    if (user.role === 'CLIENT') query = query.where({ clientId: user.id });
    if (user.role === 'FREELANCER') {
      const projectIds = await this.findMemberProjectIds(user.id);
      // Фрилансер бачить лише проєкти, у яких він є учасником.
      if (!projectIds.length) return [];
      query = query.where((project) => project.id.in(projectIds));
    }

    const projects = await query
      .orderBy((project) => project.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
    if (!projects.length) return [];

    const projectIds = projects.map((project) => project.id);
    const tasks = await this.findTaskStatuses(projectIds);
    return projects.map((project) => {
      const projectTasks = tasks.filter(
        (task) => task.projectId === project.id,
      );
      return { ...project, ...this.getProgress(projectTasks) };
    });
  }

  // Створює новий проєкт клієнта зі статусом PLANNING.
  async create(user: CurrentUser, data: CreateProjectDto) {
    if (user.role !== 'CLIENT')
      throw new ForbiddenException('Проєкти створює клієнт.');
    this.validateDeadline(data.deadline);
    validateBudget(data.budgetMin, data.budgetMax);
    await this.ensureCategoryExists(data.categoryId);

    const now = new Date();
    const project = await this.db.Project.create({
      id: randomUUID(),
      clientId: user.id,
      title: data.title,
      description: data.description ?? null,
      deadline: this.toDateOrNull(data.deadline),
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      categoryId: data.categoryId ?? null,
      status: 'PLANNING',
      createdAt: now,
      updatedAt: now,
    });
    if (data.skillIds?.length) {
      await this.replaceProjectSkills(project.id, data.skillIds);
    }
    return project;
  }

  // Повертає проєкт із прогресом, навичками та категорією.
  async detail(user: CurrentUser, id: string) {
    const project = await this.requireAccess(user, id);
    const tasks = await this.db.Task.where({ projectId: id })
      .select('status')
      .all();
    return {
      ...project,
      ...this.getProgress(tasks),
      skills: await this.getProjectSkills(id),
      category: await this.findCategory(project.categoryId),
    };
  }

  // Змінює проєкт; доступно лише власнику або адміністратору.
  async update(user: CurrentUser, id: string, data: UpdateProjectDto) {
    const project = await this.requireOwner(user, id);
    this.ensureWritable(project);
    this.validateDeadline(data.deadline);
    // Якщо передано лише одну межу бюджету, другу беремо зі збереженого проєкту.
    validateBudget(
      data.budgetMin ?? project.budgetMin ?? undefined,
      data.budgetMax ?? project.budgetMax ?? undefined,
    );
    if (data.deadline) {
      await this.ensureDeadlineCoversTasks(id, new Date(data.deadline));
    }
    if (data.status === 'COMPLETED') {
      await this.ensureProjectCanBeCompleted(id);
    }

    const updated = await this.db.Project.where({ id }).update(
      this.buildProjectChanges(data),
    );
    if (data.skillIds !== undefined)
      await this.replaceProjectSkills(id, data.skillIds);
    return updated;
  }

  private async findMemberProjectIds(userId: string) {
    const members = await this.db.ProjectMember.where({ userId }).all();
    return members.map((member) => member.projectId);
  }

  private findTaskStatuses(projectIds: string[]) {
    return this.db.Task.where((task) => task.projectId.in(projectIds))
      .select('projectId', 'status')
      .all();
  }

  private async findCategory(categoryId?: string | null) {
    if (!categoryId) return null;
    return this.db.ProjectCategory.where({ id: categoryId }).first();
  }

  private async ensureCategoryExists(categoryId?: string) {
    if (!categoryId) return;
    const category = await this.findCategory(categoryId);
    if (!category) throw new BadRequestException('Категорію не знайдено.');
  }

  private toDateOrNull(value?: string | null) {
    return value ? new Date(value) : null;
  }

  // Новий дедлайн проєкту не може бути раніше за дедлайн будь-якого завдання.
  private async ensureDeadlineCoversTasks(projectId: string, deadline: Date) {
    const tasks = await this.db.Task.where({ projectId })
      .select('deadline')
      .all();
    const hasLaterTask = tasks.some(
      (task) => task.deadline && task.deadline > deadline,
    );
    if (hasLaterTask) {
      throw new BadRequestException(
        'Дедлайн проєкту не може бути раніше дедлайнів його завдань.',
      );
    }
  }

  // Завершити проєкт можна, лише коли всі завдання й замовлення закриті.
  private async ensureProjectCanBeCompleted(projectId: string) {
    const tasks = await this.db.Task.where({ projectId })
      .select('status')
      .all();
    const orders = await this.db.Order.where({ projectId })
      .select('status')
      .all();
    const hasOpenTasks = tasks.some((task) => task.status !== 'DONE');
    const hasOpenOrders = orders.some(
      (order) => !closedStatuses.includes(order.status),
    );
    if (hasOpenTasks || hasOpenOrders) {
      throw new ConflictException('Спочатку завершіть завдання та замовлення.');
    }
  }

  // Записуємо лише ті поля, які клієнт справді передав у запиті.
  private buildProjectChanges(data: UpdateProjectDto) {
    const changes: ProjectChanges = { updatedAt: new Date() };
    if (data.title !== undefined) changes.title = data.title;
    if (data.description !== undefined) changes.description = data.description;
    if (data.deadline !== undefined)
      changes.deadline = this.toDateOrNull(data.deadline);
    if (data.status !== undefined) changes.status = data.status;
    if (data.budgetMin !== undefined) changes.budgetMin = data.budgetMin;
    if (data.budgetMax !== undefined) changes.budgetMax = data.budgetMax;
    if (data.categoryId !== undefined) changes.categoryId = data.categoryId;
    return changes;
  }

  private async replaceProjectSkills(projectId: string, skillIds: string[]) {
    const current = await this.prisma.client.orm.public.ProjectSkill.where({
      projectId,
    }).all();
    for (const link of current) {
      await this.prisma.client.orm.public.ProjectSkill.where({
        projectId,
        skillId: link.skillId,
      }).delete();
    }
    for (const skillId of new Set(skillIds)) {
      const skill = await this.prisma.client.orm.public.Skill.where({
        id: skillId,
      }).first();
      if (!skill) throw new BadRequestException('Одну з навичок не знайдено.');
      await this.prisma.client.orm.public.ProjectSkill.create({
        projectId,
        skillId,
      });
    }
  }

  async members(user: CurrentUser, id: string) {
    await this.requireAccess(user, id);
    const members = await this.prisma.client.orm.public.ProjectMember.where({
      projectId: id,
    }).all();
    return Promise.all(
      members.map(async (member) => ({
        ...member,
        user: await this.prisma.client.orm.public.User.where({
          id: member.userId,
        })
          .select('id', 'name', 'email', 'role')
          .first(),
      })),
    );
  }

  async addMember(user: CurrentUser, projectId: string, userId: string) {
    this.ensureWritable(await this.requireOwner(user, projectId));
    const freelancer = await this.prisma.client.orm.public.User.where({
      id: userId,
    }).first();
    if (
      !freelancer ||
      freelancer.role !== 'FREELANCER' ||
      freelancer.status !== 'ACTIVE'
    )
      throw new BadRequestException('Потрібен активний фрилансер.');
    try {
      const member = await this.prisma.client.orm.public.ProjectMember.create({
        id: randomUUID(),
        projectId,
        userId,
        role: 'MEMBER',
        joinedAt: new Date(),
      });
      await this.notify(
        userId,
        user.id,
        'PROJECT_MEMBER',
        'Вас додано до команди проєкту.',
        projectId,
      );
      await this.logActivity(
        user.id,
        projectId,
        'MEMBER_ADDED',
        'До команди додано виконавця.',
      );
      return member;
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException('Фрилансер уже є учасником проєкту.');
      throw error;
    }
  }

  async requireAssignee(projectId: string, userId: string) {
    const member = await this.prisma.client.orm.public.ProjectMember.where({
      projectId,
      userId,
    }).first();
    const user = await this.prisma.client.orm.public.User.where({
      id: userId,
    }).first();
    if (
      !member ||
      !user ||
      user.role !== 'FREELANCER' ||
      user.status !== 'ACTIVE'
    )
      throw new BadRequestException(
        'Виконавець має бути активним фрилансером у цьому проєкті.',
      );
  }

  directory(user: CurrentUser, page: PageDto) {
    if (user.role === 'FREELANCER')
      throw new ForbiddenException('Пошук виконавців доступний клієнту.');
    return this.prisma.client.orm.public.User.where({
      role: 'FREELANCER',
      status: 'ACTIVE',
    })
      .select('id', 'name', 'email')
      .orderBy((person) => person.name.asc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
  }

  async marketplace(user: CurrentUser, page: MarketplaceQueryDto) {
    if (user.role === 'CLIENT')
      throw new ForbiddenException(
        'Біржа проєктів призначена для фрилансерів.',
      );
    let projects = await this.prisma.client.orm.public.Project.where({
      status: 'PLANNING',
    })
      .orderBy((project) => project.createdAt.desc())
      .all();
    const allLinks = await this.prisma.client.orm.public.ProjectSkill.all();
    const favorites =
      user.role === 'FREELANCER'
        ? await this.prisma.client.orm.public.FavoriteProject.where({
            userId: user.id,
          }).all()
        : [];
    if (page.search) {
      const search = page.search.toLowerCase();
      projects = projects.filter((project) =>
        `${project.title} ${project.description ?? ''}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (page.categoryId)
      projects = projects.filter(
        (project) => project.categoryId === page.categoryId,
      );
    if (page.skillId)
      projects = projects.filter((project) =>
        allLinks.some(
          (link) =>
            link.projectId === project.id && link.skillId === page.skillId,
        ),
      );
    if (page.minBudget !== undefined)
      projects = projects.filter(
        (project) => (project.budgetMax ?? 0) >= page.minBudget!,
      );
    if (page.maxBudget !== undefined)
      projects = projects.filter(
        (project) => (project.budgetMin ?? 0) <= page.maxBudget!,
      );
    if (page.favoritesOnly)
      projects = projects.filter((project) =>
        favorites.some((favorite) => favorite.projectId === project.id),
      );
    projects = projects.slice(
      (page.page - 1) * page.limit,
      page.page * page.limit,
    );
    const applications =
      user.role === 'FREELANCER'
        ? await this.prisma.client.orm.public.ProjectApplication.where({
            freelancerId: user.id,
          }).all()
        : [];
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        client: await this.prisma.client.orm.public.User.where({
          id: project.clientId,
        })
          .select('id', 'name')
          .first(),
        applicationStatus:
          applications.find(
            (application) => application.projectId === project.id,
          )?.status ?? null,
        isFavorite: favorites.some(
          (favorite) => favorite.projectId === project.id,
        ),
        skills: await this.getProjectSkills(project.id),
        category: project.categoryId
          ? await this.prisma.client.orm.public.ProjectCategory.where({
              id: project.categoryId,
            }).first()
          : null,
      })),
    );
  }

  private async getProjectSkills(projectId: string) {
    const links = await this.prisma.client.orm.public.ProjectSkill.where({
      projectId,
    }).all();
    if (!links.length) return [];
    return this.prisma.client.orm.public.Skill.where((skill) =>
      skill.id.in(links.map((link) => link.skillId)),
    ).all();
  }

  async favorite(user: CurrentUser, projectId: string) {
    if (user.role !== 'FREELANCER')
      throw new ForbiddenException('Обране доступне фрилансеру.');
    const project = await this.prisma.client.orm.public.Project.where({
      id: projectId,
    }).first();
    if (!project) throw new NotFoundException('Проєкт не знайдено.');
    const current = await this.prisma.client.orm.public.FavoriteProject.where({
      userId: user.id,
      projectId,
    }).first();
    if (current) return current;
    return this.prisma.client.orm.public.FavoriteProject.create({
      userId: user.id,
      projectId,
      createdAt: new Date(),
    });
  }

  async unfavorite(user: CurrentUser, projectId: string) {
    if (user.role !== 'FREELANCER')
      throw new ForbiddenException('Обране доступне фрилансеру.');
    const current = await this.prisma.client.orm.public.FavoriteProject.where({
      userId: user.id,
      projectId,
    }).first();
    if (current)
      await this.prisma.client.orm.public.FavoriteProject.where({
        userId: user.id,
        projectId,
      }).delete();
    return { deleted: Boolean(current) };
  }

  async apply(
    user: CurrentUser,
    projectId: string,
    data: CreateApplicationDto,
  ) {
    if (user.role !== 'FREELANCER')
      throw new ForbiddenException('Заявку залишає фрилансер.');
    const project = await this.prisma.client.orm.public.Project.where({
      id: projectId,
    }).first();
    if (!project) throw new NotFoundException('Проєкт не знайдено.');
    if (project.status !== 'PLANNING')
      throw new ConflictException('Прийом заявок уже завершено.');
    if (data.portfolioItemId) {
      const portfolio = await this.prisma.client.orm.public.PortfolioItem.where(
        { id: data.portfolioItemId },
      ).first();
      if (!portfolio || portfolio.userId !== user.id)
        throw new BadRequestException('Оберіть власну роботу з портфоліо.');
    }
    const now = new Date();
    try {
      const application =
        await this.prisma.client.orm.public.ProjectApplication.create({
          id: randomUUID(),
          projectId,
          freelancerId: user.id,
          message: data.message,
          proposedBudget: data.proposedBudget,
          proposedDays: data.proposedDays,
          portfolioItemId: data.portfolioItemId ?? null,
          aiScore: null,
          aiReason: null,
          aiRankedAt: null,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });
      await this.notify(
        project.clientId,
        user.id,
        'NEW_APPLICATION',
        'На проєкт надійшла нова заявка.',
        projectId,
      );
      await this.logActivity(
        user.id,
        projectId,
        'APPLICATION_CREATED',
        'Фрилансер залишив заявку.',
      );
      return application;
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException('Ви вже залишили заявку на цей проєкт.');
      throw error;
    }
  }

  async applications(user: CurrentUser, projectId: string, page: PageDto) {
    await this.requireOwner(user, projectId);
    const applications =
      await this.prisma.client.orm.public.ProjectApplication.where({
        projectId,
      })
        .orderBy((application) => application.createdAt.desc())
        .offset((page.page - 1) * page.limit)
        .limit(page.limit)
        .all();
    return Promise.all(
      applications.map(async (application) => ({
        ...application,
        freelancer: await this.freelancerProfile(
          user,
          application.freelancerId,
        ),
      })),
    );
  }

  async acceptApplication(user: CurrentUser, id: string) {
    const application =
      await this.prisma.client.orm.public.ProjectApplication.where({
        id,
      }).first();
    if (!application) throw new NotFoundException('Заявку не знайдено.');
    const project = await this.requireOwner(user, application.projectId);
    if (project.status !== 'PLANNING')
      throw new ConflictException('Виконавця для проєкту вже обрано.');
    if (application.status !== 'PENDING')
      throw new ConflictException('Цю заявку вже опрацьовано.');
    return this.prisma.client.transaction(async (tx) => {
      const current = await tx.orm.public.ProjectApplication.where({
        id,
      }).first();
      if (!current || current.status !== 'PENDING')
        throw new ConflictException('Цю заявку вже опрацьовано.');
      await tx.orm.public.ProjectMember.create({
        id: randomUUID(),
        projectId: current.projectId,
        userId: current.freelancerId,
        role: 'MEMBER',
        joinedAt: new Date(),
      });
      await tx.orm.public.ProjectApplication.where({ id }).update({
        status: 'ACCEPTED',
        updatedAt: new Date(),
      });
      const otherApplications = await tx.orm.public.ProjectApplication.where({
        projectId: current.projectId,
        status: 'PENDING',
      }).all();
      for (const other of otherApplications) {
        await tx.orm.public.ProjectApplication.where({ id: other.id }).update({
          status: 'REJECTED',
          updatedAt: new Date(),
        });
      }
      await tx.orm.public.Project.where({ id: current.projectId }).update({
        status: 'ACTIVE',
        updatedAt: new Date(),
      });
      await tx.orm.public.Notification.create({
        id: randomUUID(),
        userId: current.freelancerId,
        type: 'APPLICATION_ACCEPTED',
        message: 'Вашу заявку прийнято.',
        projectId: current.projectId,
        taskId: null,
        readAt: null,
        createdAt: new Date(),
      });
      await tx.orm.public.ActivityLog.create({
        id: randomUUID(),
        actorId: user.id,
        projectId: current.projectId,
        type: 'APPLICATION_ACCEPTED',
        message: 'Клієнт обрав виконавця.',
        createdAt: new Date(),
      });
      return {
        projectId: current.projectId,
        freelancerId: current.freelancerId,
      };
    });
  }

  async freelancerProfile(_user: CurrentUser, id: string) {
    const freelancer = await this.prisma.client.orm.public.User.where({ id })
      .select('id', 'name', 'email', 'role', 'status', 'createdAt')
      .first();
    if (!freelancer || freelancer.role !== 'FREELANCER')
      throw new NotFoundException('Фрилансера не знайдено.');
    const memberships = await this.prisma.client.orm.public.ProjectMember.where(
      { userId: id },
    ).all();
    const projects = memberships.length
      ? await this.prisma.client.orm.public.Project.where((project) =>
          project.id.in(memberships.map((member) => member.projectId)),
        ).all()
      : [];
    const completed = projects.filter(
      (project) => project.status === 'COMPLETED',
    );
    const durations = completed.map((project) => {
      const joinedAt = memberships.find(
        (member) => member.projectId === project.id,
      )?.joinedAt;
      if (!joinedAt) return 0;
      return Math.max(
        1,
        Math.ceil(
          (project.updatedAt.getTime() - joinedAt.getTime()) / 86400000,
        ),
      );
    });
    const reviews = await this.prisma.client.orm.public.FreelancerReview.where({
      freelancerId: id,
    })
      .orderBy((review) => review.createdAt.desc())
      .all();
    const [profile, skillLinks, portfolio, assignedTasks] = await Promise.all([
      this.prisma.client.orm.public.FreelancerProfile.where({
        userId: id,
      }).first(),
      this.prisma.client.orm.public.FreelancerSkill.where({ userId: id }).all(),
      this.prisma.client.orm.public.PortfolioItem.where({ userId: id })
        .orderBy((item) => item.createdAt.desc())
        .all(),
      this.prisma.client.orm.public.Task.where({ assigneeId: id }).all(),
    ]);
    const skills = skillLinks.length
      ? await this.prisma.client.orm.public.Skill.where((skill) =>
          skill.id.in(skillLinks.map((link) => link.skillId)),
        ).all()
      : [];
    const completedTasks = assignedTasks.filter(
      (task) => task.status === 'DONE' && task.deadline,
    );
    const onTimeTasks = completedTasks.filter(
      (task) => task.deadline && task.updatedAt <= task.deadline,
    );
    const reviewDetails = await Promise.all(
      reviews.map(async (review) => ({
        ...review,
        project: await this.prisma.client.orm.public.Project.where({
          id: review.projectId,
        })
          .select('id', 'title')
          .first(),
        client: await this.prisma.client.orm.public.User.where({
          id: review.clientId,
        })
          .select('id', 'name')
          .first(),
      })),
    );
    return {
      ...freelancer,
      completedProjects: completed.length,
      averageCompletionDays: durations.length
        ? Math.round(
            durations.reduce((total, duration) => total + duration, 0) /
              durations.length,
          )
        : null,
      averageRating: reviews.length
        ? Number(
            (
              reviews.reduce((total, review) => total + review.rating, 0) /
              reviews.length
            ).toFixed(1),
          )
        : null,
      reviewCount: reviews.length,
      reviews: reviewDetails,
      profile: {
        bio: profile?.bio ?? '',
        hourlyRate: profile?.hourlyRate ?? null,
        availability: profile?.availability ?? 'AVAILABLE',
      },
      skills,
      portfolio,
      activeWorkload: assignedTasks.filter((task) => task.status !== 'DONE')
        .length,
      onTimePercentage: completedTasks.length
        ? Math.round((onTimeTasks.length / completedTasks.length) * 100)
        : null,
    };
  }

  async createReview(
    user: CurrentUser,
    projectId: string,
    data: CreateFreelancerReviewDto,
  ) {
    const project = await this.requireOwner(user, projectId);
    if (project.clientId !== user.id)
      throw new ForbiddenException('Відгук залишає клієнт проєкту.');
    if (project.status !== 'COMPLETED')
      throw new ConflictException(
        'Відгук можна залишити після завершення проєкту.',
      );
    const member = await this.prisma.client.orm.public.ProjectMember.where({
      projectId,
      userId: data.freelancerId,
    }).first();
    if (!member)
      throw new BadRequestException(
        'Фрилансер не був учасником цього проєкту.',
      );
    try {
      return await this.prisma.client.orm.public.FreelancerReview.create({
        id: randomUUID(),
        projectId,
        clientId: user.id,
        freelancerId: data.freelancerId,
        rating: data.rating,
        comment: data.comment || null,
        createdAt: new Date(),
      });
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException(
          'Відгук для цього фрилансера вже залишено.',
        );
      throw error;
    }
  }

  logActivity(
    actorId: string,
    projectId: string,
    type: string,
    message: string,
  ) {
    return this.prisma.client.orm.public.ActivityLog.create({
      id: randomUUID(),
      actorId,
      projectId,
      type,
      message,
      createdAt: new Date(),
    });
  }

  notify(
    userId: string,
    actorId: string,
    type: string,
    message: string,
    projectId?: string,
    taskId?: string,
  ) {
    if (userId === actorId) return null;
    return this.prisma.client.orm.public.Notification.create({
      id: randomUUID(),
      userId,
      type,
      message,
      projectId: projectId ?? null,
      taskId: taskId ?? null,
      readAt: null,
      createdAt: new Date(),
    });
  }

  async activity(user: CurrentUser, projectId: string, page: PageDto) {
    await this.requireAccess(user, projectId);
    const items = await this.prisma.client.orm.public.ActivityLog.where({
      projectId,
    })
      .orderBy((item) => item.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        actor: await this.prisma.client.orm.public.User.where({
          id: item.actorId,
        })
          .select('id', 'name')
          .first(),
      })),
    );
  }
}
