import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AgentService, offTopicAnswer } from './agent.service.js';
import { McpService } from './mcp.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import type { TasksService } from '../tasks/tasks.service.js';
import type { CollaborationService } from '../collaboration/collaboration.service.js';
import type { MilestonesService } from '../projects/milestones.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
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
  const mcp = new McpService(
    projects as unknown as ProjectsService,
    analytics as unknown as AnalyticsService,
    tasks as unknown as TasksService,
    collaboration as unknown as CollaborationService,
    milestones as unknown as MilestonesService,
    notifications as unknown as NotificationsService,
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
      answer: offTopicAnswer,
      toolsUsed: [],
      offTopic: true,
    });
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
