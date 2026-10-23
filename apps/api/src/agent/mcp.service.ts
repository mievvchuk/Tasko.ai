import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ProjectsService } from '../projects/projects.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import type { CurrentUser } from '../users/users.service.js';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
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
            await this.projects.requireAccess(user, args.projectId);
          const tasks = await this.analytics.visibleTasks(user);
          return tasks
            .filter(
              (task) =>
                (!args.projectId || task.projectId === args.projectId) &&
                (!args.status || task.status === args.status),
            )
            .slice((args.page - 1) * args.limit, args.page * args.limit);
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
    return server;
  }
}
