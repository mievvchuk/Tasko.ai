import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AgentService } from './agent.service.js';
import { McpService } from './mcp.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

function planResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
  );
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
  const mcp = new McpService(
    projects as unknown as ProjectsService,
    analytics as unknown as AnalyticsService,
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
    expect(projects.list).toHaveBeenCalledWith(user, { page: 1, limit: 20 });
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(
      secondBody.messages.some(
        (message: { role: string; content: string }) =>
          message.role === 'tool' && message.content.includes('Own project'),
      ),
    ).toBe(true);
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
      .mockResolvedValueOnce(new Response('{}'))
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    } finally {
      await client.close();
      await server.close();
    }
  });
});
