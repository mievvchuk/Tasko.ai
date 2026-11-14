import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  AgentService,
  compactSchema,
  offTopicAnswer,
  roleRules,
} from '../../../src/agent/agent.service.js';

describe('Ada per role', () => {
  it('describes only the abilities of the current role', () => {
    expect(roleRules.CLIENT).toContain('чернетку нового проєкту');
    expect(roleRules.FREELANCER).not.toContain('чернетку нового проєкту');
    expect(roleRules.FREELANCER).toContain('відкриті проєкти на біржі');
    expect(roleRules.ADMIN).toContain('статистику платформи');
    expect(roleRules.CLIENT).not.toContain('статистику платформи');
    expect(offTopicAnswer('FREELANCER')).not.toContain('заявки фрілансерів');
  });
});
import { McpService, withoutNoise } from '../../../src/agent/mcp.service.js';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { AnalyticsService } from '../../../src/analytics/analytics.service.js';
import type { TasksService } from '../../../src/tasks/tasks.service.js';
import type { CollaborationService } from '../../../src/collaboration/collaboration.service.js';
import type { MilestonesService } from '../../../src/projects/milestones.service.js';
import type { NotificationsService } from '../../../src/notifications/notifications.service.js';
import type { AdminService } from '../../../src/admin/admin.service.js';
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

function planResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
  );
}

// Відповідь фільтра тем, який чат викликає перед основним запитом
function topicResponse(allowed: boolean) {
  return planResponse(JSON.stringify({ allowed }));
}

describe('AI through MCP', () => {
  const user = {
    id: randomUUID(),
    name: 'Client',
    email: 'client@example.com',
    role: 'CLIENT' as const,
    sessionId: randomUUID(),
    twoFactorEnabled: false,
  };
  const projects = {
    list: vi
      .fn()
      .mockResolvedValue([{ id: randomUUID(), title: 'Own project' }]),
    requireAccess: vi.fn(),
  };
  const analytics = {
    summary: vi.fn(),
    visibleTasks: vi.fn().mockResolvedValue([]),
    deadlines: vi.fn().mockResolvedValue([]),
    workload: vi.fn().mockResolvedValue([]),
  };
  const tasks = { find: vi.fn() };
  const collaboration = { submissions: vi.fn(), messages: vi.fn() };
  const milestones = { list: vi.fn() };
  const notifications = { list: vi.fn() };
  const admin = {
    list: vi.fn().mockResolvedValue([{ name: 'Олена Коваль', role: 'CLIENT' }]),
    report: vi.fn().mockResolvedValue({ users: 56 }),
  };
  const mcp = new McpService(
    projects as unknown as ProjectsService,
    analytics as unknown as AnalyticsService,
    tasks as unknown as TasksService,
    collaboration as unknown as CollaborationService,
    milestones as unknown as MilestonesService,
    notifications as unknown as NotificationsService,
    admin as unknown as AdminService,
  );
  const config = {
    databaseUrl: 'postgresql://localhost/test',
    jwtSecret: 'a'.repeat(64),
    port: 3000,
    webOrigin: 'http://localhost:5173',
    aiApiKey: 'test-only-key',
    aiModel: 'test-only-model',
    aiBaseUrl: 'https://provider.example/v1',
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls a real MCP tool and returns a model answer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(topicResponse(true))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'list_projects', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Ваш доступний проєкт: Own project.',
                },
              },
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).chat(user, 'Покажи мої проєкти');
    expect(result.toolsUsed).toEqual(['list_projects']);
    expect(result.offTopic).toBe(false);
    expect(projects.list).toHaveBeenCalledWith(user, { page: 1, limit: 20 });
    const lastBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(
      lastBody.messages.some(
        (message: { role: string; content: string }) =>
          message.role === 'tool' && message.content.includes('Own project'),
      ),
    ).toBe(true);
    // Результат інструмента — сам JSON даних, без обгортки MCP і екранованих лапок
    const toolMessage = lastBody.messages.find(
      (message: { role: string }) => message.role === 'tool',
    );
    expect(toolMessage.content).not.toContain('\\"');
    expect(() => JSON.parse(toolMessage.content)).not.toThrow();
    // Схеми інструментів без $schema і регулярних виразів UUID
    const tools = JSON.stringify(lastBody.tools);
    expect(tools).not.toContain('$schema');
    expect(tools).not.toContain('"pattern"');
    expect(tools).toContain('"format":"uuid"');
  });

  it('strips heavy schema parts and noisy result fields to save tokens', () => {
    expect(
      compactSchema({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            format: 'uuid',
            pattern: '^[0-9a-f-]+$',
          },
          code: { type: 'string', pattern: '^[A-Z]+$' },
        },
      }),
    ).toEqual({
      type: 'object',
      properties: {
        projectId: { type: 'string', format: 'uuid' },
        code: { type: 'string', pattern: '^[A-Z]+$' },
      },
    });
    expect(
      JSON.parse(
        JSON.stringify(
          [
            {
              id: 'p1',
              title: 'Сайт',
              deadline: null,
              clientId: 'u1',
              updatedAt: '2026-11-10',
              createdAt: '2026-11-01',
            },
          ],
          withoutNoise,
        ),
      ),
    ).toEqual([{ id: 'p1', title: 'Сайт', createdAt: '2026-11-01' }]);
  });
  it('returns a project draft without creating the project', async () => {
    const toolCall = (args: object) =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'draft_project',
                      arguments: JSON.stringify(args),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const draft = {
      title: 'Лендинг кав’ярні',
      description: 'Одна сторінка з меню',
      budgetMin: 5000,
      budgetMax: 8000,
      deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(topicResponse(true))
        .mockResolvedValueOnce(toolCall(draft))
        .mockResolvedValueOnce(planResponse('Перевірте чернетку.')),
    );
    const agent = new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    );
    expect((await agent.chat(user, 'Створи проєкт')).projectDraft).toEqual(
      draft,
    );

    // Бюджет «до» менший за «від» — інструмент повертає помилку, чернетки немає
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(topicResponse(true))
        .mockResolvedValueOnce(toolCall({ ...draft, budgetMax: 100 }))
        .mockResolvedValueOnce(planResponse('Уточніть бюджет.')),
    );
    expect((await agent.chat(user, 'Створи проєкт')).projectDraft).toBeNull();
  });
  it('hides draft_project from non-clients', async () => {
    const server = mcp.createServer({ ...user, role: 'FREELANCER' });
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.some((tool) => tool.name === 'draft_project')).toBe(false);
    await client.close();
    await server.close();
  });
  it('gives admins user search and platform statistics, and only them', async () => {
    async function connect(role: 'ADMIN' | 'CLIENT') {
      const server = mcp.createServer({ ...user, role });
      const client = new Client({ name: 'test', version: '1.0.0' });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      return { server, client };
    }
    const asAdmin = await connect('ADMIN');
    const names = (await asAdmin.client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['search_users', 'platform_report']),
    );
    const found = await asAdmin.client.callTool({
      name: 'search_users',
      arguments: { search: 'Олена', role: 'CLIENT' },
    });
    expect(JSON.stringify(found.content)).toContain('Олена Коваль');
    expect(admin.list).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ADMIN' }),
      expect.objectContaining({ search: 'Олена', role: 'CLIENT', page: 1 }),
    );
    await asAdmin.client.callTool({ name: 'platform_report', arguments: {} });
    expect(admin.report).toHaveBeenCalledOnce();
    await asAdmin.client.close();
    await asAdmin.server.close();

    const asClient = await connect('CLIENT');
    const clientNames = (await asClient.client.listTools()).tools.map(
      (t) => t.name,
    );
    expect(clientNames).not.toContain('search_users');
    expect(clientNames).not.toContain('platform_report');
    await asClient.client.close();
    await asClient.server.close();
  });
  it('refuses off-topic questions without calling tools', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(topicResponse(false));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).chat(user, 'Напиши рецепт борщу');
    expect(result).toEqual({
      answer: offTopicAnswer(user.role),
      toolsUsed: [],
      offTopic: true,
    });
    expect(result.answer).toMatch(/^Вибачте, але з цим я не можу допомогти/);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.response_format.json_schema.name).toBe('topic_check');
  });
  it('keeps answering when the topic filter itself fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(planResponse('Ваші проєкти: Own project.'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).chat(user, 'Мої проєкти');
    expect(result.answer).toBe('Ваші проєкти: Own project.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('sends previous turns so follow-up questions keep context', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(topicResponse(true))
      .mockResolvedValueOnce(planResponse('У проєкті CRM 2 завдання.'));
    vi.stubGlobal('fetch', fetchMock);
    const history = [
      { role: 'user' as const, content: 'Які в мене проєкти?' },
      { role: 'assistant' as const, content: 'Сайт і CRM.' },
    ];
    await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).chat(user, 'А скільки завдань у другому?', history);
    const topicBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(topicBody.messages[1].content).toContain('Сайт і CRM.');
    const chatBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(chatBody.messages.map((m: { role: string }) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
  });
  it('tells the model that an admin does not create projects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(topicResponse(true))
      .mockResolvedValueOnce(
        planResponse(
          'Проєкти створюють клієнти, а адміністратор керує платформою.',
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).chat({ ...user, role: 'ADMIN' }, 'Хочу створити месенджер KOLO');
    const chatBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(chatBody.messages[0].content).toContain(
      'Користувач — адміністратор',
    );
    // Інструмента чернетки проєкту в адміністратора немає
    expect(
      chatBody.tools.map(
        (tool: { function: { name: string } }) => tool.function.name,
      ),
    ).not.toContain('draft_project');
  });
  it('preserves upstream throttling as 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 429 })),
    );
    await expect(
      new AgentService(
        config,
        mcp,
        projects as unknown as ProjectsService,
      ).chat(user, 'Стан проєктів'),
    ).rejects.toMatchObject({ status: 429 });
  });
  it('rejects malformed provider responses and tool names', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(topicResponse(true))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(topicResponse(true))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: '1',
                      type: 'function',
                      function: { name: 'delete_project', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new AgentService(
        config,
        mcp,
        projects as unknown as ProjectsService,
      ).chat(user, 'Стан'),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      new AgentService(
        config,
        mcp,
        projects as unknown as ProjectsService,
      ).chat(user, 'Стан'),
    ).rejects.toMatchObject({ status: 502 });
  });
  it('generates a validated project plan without requesting MCP tools', async () => {
    const draft = {
      milestones: [
        {
          title: 'Підготовка',
          description: 'Погодити вимоги',
          acceptanceCriteria: ['Вимоги погоджено'],
          tasks: [
            {
              title: 'Уточнити вимоги',
              description: 'Описати сценарії',
              priority: 'HIGH',
              acceptanceCriteria: ['Сценарії погоджено'],
            },
          ],
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { role: 'assistant', content: JSON.stringify(draft) },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const brief = {
      title: 'Сайт',
      description: 'Портфоліо',
      deadline: null,
      instructions: 'MVP',
    };
    const result = await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).generateProjectPlan(brief);
    expect(result).toEqual(draft);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(JSON.parse(body.messages[1].content)).toEqual(brief);
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'project_plan', strict: true },
    });
  });

  it('retries once when the model returns a broken plan', async () => {
    const draft = {
      milestones: [
        {
          title: 'Підготовка',
          description: 'Погодити вимоги',
          acceptanceCriteria: ['Вимоги погоджено'],
          tasks: [
            {
              title: 'Уточнити вимоги',
              description: 'Описати сценарії',
              priority: 'MEDIUM',
              acceptanceCriteria: ['Сценарії погоджено'],
            },
          ],
        },
      ],
    };
    const brokenJson = JSON.stringify(draft).slice(0, -3);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(planResponse(brokenJson))
      .mockResolvedValueOnce(planResponse(JSON.stringify(draft)));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).generateProjectPlan({
      title: 'Сайт',
      description: null,
      deadline: null,
      instructions: '',
    });
    expect(result).toEqual(draft);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed AI plans rather than returning an unusable draft', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => planResponse('{"milestones":[]}'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new AgentService(
        config,
        mcp,
        projects as unknown as ProjectsService,
      ).generateProjectPlan({
        title: 'Сайт',
        description: null,
        deadline: null,
        instructions: '',
      }),
    ).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries the plan when the provider rejects output against the schema', async () => {
    const draft = {
      milestones: [
        {
          title: 'Підготовка',
          description: 'Погодити вимоги',
          acceptanceCriteria: ['Вимоги погоджено'],
          tasks: [
            {
              title: 'Уточнити вимоги',
              description: 'Описати сценарії',
              priority: 'LOW',
              acceptanceCriteria: ['Сценарії погоджено'],
            },
          ],
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'json_validate_failed' } }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(planResponse(JSON.stringify(draft)));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AgentService(
      config,
      mcp,
      projects as unknown as ProjectsService,
    ).generateProjectPlan({
      title: 'Сайт',
      description: null,
      deadline: null,
      instructions: '',
    });
    expect(result).toEqual(draft);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry the plan when the key or model is rejected', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { code: 'model_not_found' } }), {
          status: 400,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new AgentService(
        config,
        mcp,
        projects as unknown as ProjectsService,
      ).generateProjectPlan({
        title: 'Сайт',
        description: null,
        deadline: null,
        instructions: '',
      }),
    ).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not retry the plan when the provider is throttled', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      new AgentService(
        config,
        mcp,
        projects as unknown as ProjectsService,
      ).generateProjectPlan({
        title: 'Сайт',
        description: null,
        deadline: null,
        instructions: '',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps project access checks inside MCP tools', async () => {
    analytics.summary.mockRejectedValueOnce(
      new ForbiddenException('Немає доступу.'),
    );
    const server = mcp.createServer(user);
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: 'get_project_summary',
        arguments: { projectId: randomUUID() },
      });
      expect(result.isError).toBe(true);
      const tools = await client.listTools();
      expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(
        true,
      );
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'get_task_details',
          'list_milestones',
          'list_project_applications',
          'list_notifications',
          'search_open_projects',
        ]),
      );
    } finally {
      await client.close();
      await server.close();
    }
  });
});
