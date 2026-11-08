import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ProjectsService,
  validateBudget,
} from '../projects/projects.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { MilestonesService } from '../projects/milestones.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { CollaborationService } from '../collaboration/collaboration.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AdminService } from '../admin/admin.service.js';
import type { CurrentUser } from '../users/users.service.js';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(CollaborationService)
    private readonly collaboration: CollaborationService,
    @Inject(MilestonesService) private readonly milestones: MilestonesService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}

  createServer(user: CurrentUser) {
    const server = new McpServer({ name: 'aifreelance', version: '1.0.0' });
    const result = async (run: () => Promise<unknown>) => {
      try {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(await run()) },
          ],
        };
      } catch (error) {
        if (!(error instanceof HttpException))
          this.logger.error('Не вдалося виконати інструмент MCP.');
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                error instanceof HttpException
                  ? error.message
                  : 'Не вдалося отримати дані.',
            },
          ],
        };
      }
    };
    const annotations = { readOnlyHint: true, destructiveHint: false };
    const pagination = {
      page: z.number().int().min(1).max(10000).default(1),
      limit: z.number().int().min(1).max(50).default(20),
    };
    server.registerTool(
      'list_projects',
      {
        description: 'Проєкти, доступні поточному користувачу.',
        inputSchema: z.object(pagination).strict(),
        annotations,
      },
      async (page) => result(() => this.projects.list(user, page)),
    );
    server.registerTool(
      'list_tasks',
      {
        description:
          'Доступні завдання зі статусами, пріоритетами та дедлайнами.',
        inputSchema: z
          .object({
            projectId: z.string().uuid().optional(),
            status: z
              .enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
              .optional(),
            ...pagination,
          })
          .strict(),
        annotations,
      },
      async (args) =>
        result(async () => {
          if (args.projectId)
            await this.projects.requireAccess(user, args.projectId, false);
          const tasks = await this.analytics.visibleTasks(user);
          const titles = new Map(
            (await this.analytics.visibleProjects(user)).map((project) => [
              project.id,
              project.title,
            ]),
          );
          return tasks
            .filter(
              (task) =>
                (!args.projectId || task.projectId === args.projectId) &&
                (!args.status || task.status === args.status),
            )
            .slice((args.page - 1) * args.limit, args.page * args.limit)
            .map((task) => ({
              ...task,
              projectTitle: titles.get(task.projectId) ?? null,
            }));
        }),
    );
    server.registerTool(
      'get_project_summary',
      {
        description: 'Прогрес проєкту та ризикові завдання.',
        inputSchema: z.object({ projectId: z.string().uuid() }).strict(),
        annotations,
      },
      async ({ projectId }) =>
        result(() => this.analytics.summary(user, projectId)),
    );
    server.registerTool(
      'get_upcoming_deadlines',
      {
        description: 'Найближчі та прострочені дедлайни доступних завдань.',
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => result(() => this.analytics.deadlines(user)),
    );
    server.registerTool(
      'get_workload',
      {
        description: 'Завантаженість виконавців у доступних проєктах.',
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => result(() => this.analytics.workload(user)),
    );
    // Нижче — додаткові інструменти. Кожен викликає звичайний сервіс,
    // тож перевірки ролей і доступу ті самі, що й у REST API.
    server.registerTool(
      'get_dashboard',
      {
        description:
          'Загальна статистика користувача: кількість проєктів, завдань за статусами, прострочення.',
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => result(() => this.analytics.dashboard(user)),
    );
    server.registerTool(
      'get_task_details',
      {
        description:
          'Повна інформація про завдання: опис, критерії приймання та здані роботи з коментарями перевірки.',
        inputSchema: z.object({ taskId: z.string().uuid() }).strict(),
        annotations,
      },
      async ({ taskId }) =>
        result(async () => ({
          task: await this.tasks.find(user, taskId),
          submissions: await this.collaboration.submissions(user, taskId, {
            page: 1,
            limit: 10,
          }),
        })),
    );
    server.registerTool(
      'list_milestones',
      {
        description: 'Етапи проєкту з описами, статусами та порядком.',
        inputSchema: z.object({ projectId: z.string().uuid() }).strict(),
        annotations,
      },
      async ({ projectId }) =>
        result(() => this.milestones.list(user, projectId)),
    );
    server.registerTool(
      'list_project_messages',
      {
        description:
          'Останні повідомлення в чаті проєкту (від нових до старих).',
        inputSchema: z
          .object({ projectId: z.string().uuid(), ...pagination })
          .strict(),
        annotations,
      },
      async ({ projectId, ...page }) =>
        result(() => this.collaboration.messages(user, projectId, page)),
    );
    server.registerTool(
      'list_project_applications',
      {
        description:
          'Заявки фрілансерів на проєкт клієнта: бюджет, строки, AI-оцінка. Лише для власника проєкту.',
        inputSchema: z
          .object({ projectId: z.string().uuid(), ...pagination })
          .strict(),
        annotations,
      },
      async ({ projectId, ...page }) =>
        result(() => this.projects.applications(user, projectId, page)),
    );
    server.registerTool(
      'list_notifications',
      {
        description:
          'Останні сповіщення користувача та кількість непрочитаних.',
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => result(() => this.notifications.list(user.id, 1, 20)),
    );
    server.registerTool(
      'search_open_projects',
      {
        description:
          'Відкриті проєкти на біржі (статус PLANNING) з бюджетом і навичками. Для фрілансерів.',
        inputSchema: z
          .object({
            search: z.string().min(1).max(200).optional(),
            minBudget: z.number().int().min(0).max(10000000).optional(),
            maxBudget: z.number().int().min(0).max(10000000).optional(),
            ...pagination,
          })
          .strict(),
        annotations,
      },
      async (query) => result(() => this.projects.marketplace(user, query)),
    );
    server.registerTool(
      'list_freelancers',
      {
        description: 'Активні фрілансери платформи. Для клієнтів.',
        inputSchema: z.object(pagination).strict(),
        annotations,
      },
      async (page) =>
        result(async () => await this.projects.directory(user, page)),
    );
    server.registerTool(
      'get_freelancer_profile',
      {
        description:
          'Профіль фрілансера: навички, ставка, доступність, портфоліо та відгуки.',
        inputSchema: z.object({ userId: z.string().uuid() }).strict(),
        annotations,
      },
      async ({ userId }) =>
        result(() => this.projects.freelancerProfile(user, userId)),
    );
    // Нічого не записує: повертає чернетку, а створює проєкт сам клієнт кнопкою
    // через звичайний POST /projects з тією ж валідацією, що й у формі.
    if (user.role === 'CLIENT')
      server.registerTool(
        'draft_project',
        {
          description:
            'Готує чернетку нового проєкту клієнта для підтвердження. Викликай лише тоді, коли користувач назвав назву, опис, бюджет і дедлайн. Проєкт НЕ створюється: користувач підтвердить його кнопкою.',
          inputSchema: z
            .object({
              title: z.string().trim().min(2).max(200),
              description: z.string().min(1).max(10000),
              budgetMin: z.number().int().min(0).max(10000000).optional(),
              budgetMax: z.number().int().min(0).max(10000000).optional(),
              deadline: z.string().datetime({ offset: true }).optional(),
            })
            .strict(),
          annotations,
        },
        async (draft) =>
          result(async () => {
            validateBudget(draft.budgetMin, draft.budgetMax);
            if (
              draft.deadline &&
              new Date(draft.deadline).getTime() <= Date.now()
            )
              throw new BadRequestException(
                'Дедлайн проєкту має бути в майбутньому.',
              );
            return draft;
          }),
      );
    // Інструменти адміністратора: ті самі запити, що й адмін-панель (AdminService сам перевіряє роль)
    if (user.role === 'ADMIN') {
      server.registerTool(
        'search_users',
        {
          description:
            "Пошук користувачів платформи за ім'ям або email, роллю (CLIENT, FREELANCER, ADMIN) і станом (ACTIVE, BLOCKED). Лише для адміністратора.",
          inputSchema: z
            .object({
              search: z.string().trim().max(100).optional(),
              role: z.enum(['CLIENT', 'FREELANCER', 'ADMIN']).optional(),
              status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
              ...pagination,
            })
            .strict(),
          annotations,
        },
        async (filters) =>
          result(async () => await this.admin.list(user, filters)),
      );
      server.registerTool(
        'platform_report',
        {
          description:
            'Повна статистика платформи: користувачі за ролями й станами, проєкти й завдання за статусами, прострочені завдання, скарги, заявки, активність за 7 днів, зростання за 6 місяців, середні часи. Лише для адміністратора.',
          inputSchema: z.object({}).strict(),
          annotations,
        },
        async () => result(() => this.admin.report(user)),
      );
    }
    return server;
  }
}
