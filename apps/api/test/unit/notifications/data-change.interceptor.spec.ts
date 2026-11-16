import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { DataChangeInterceptor } from '../../../src/notifications/data-change.interceptor.js';
import { dataEvents } from '../../../src/notifications/data-events.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const projectId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const columnId = '33333333-3333-4333-8333-333333333333';

const prisma = {
  client: {
    orm: {
      public: {
        Task: { where: () => ({ first: async () => ({ projectId }) }) },
        BoardColumn: { where: () => ({ first: async () => ({ projectId }) }) },
      },
    },
  },
} as unknown as PrismaService;

function context(method: string, path: string, id?: string) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method, path, url: path, params: { id } }),
    }),
  } as unknown as ExecutionContext;
}

async function run(method: string, path: string, id?: string, fail = false) {
  const handler: CallHandler = {
    handle: () => (fail ? throwError(() => new Error('boom')) : of({})),
  };
  const result = new DataChangeInterceptor(prisma).intercept(context(method, path, id), handler);
  await lastValueFrom(result).catch(() => undefined);
}

describe('DataChangeInterceptor', () => {
  let events: (string | null)[] = [];
  const subscription = dataEvents.subscribe((event) => events.push(event));
  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
  });
  afterEach(() => vi.useRealTimers());
  afterAll(() => subscription.unsubscribe());

  it('announces a board change once for its project, merging bursts', async () => {
    await run('POST', `/tasks/${taskId}/move`, taskId);
    await run('PATCH', `/columns/${columnId}`, columnId);
    await run('POST', `/projects/${projectId}/tasks`, projectId);
    await vi.advanceTimersByTimeAsync(300);
    expect(events).toEqual([projectId]);
  });

  it('stays quiet for reads, failures, sign-in and notifications', async () => {
    await run('GET', '/projects');
    await run('POST', `/tasks/${taskId}/move`, taskId, true);
    await run('POST', '/auth/login');
    await run('POST', '/notifications/read-all');
    await vi.advanceTimersByTimeAsync(300);
    expect(events).toEqual([]);
  });

  it('announces changes outside a project to everyone', async () => {
    await run('POST', '/auth/register');
    await vi.advanceTimersByTimeAsync(300);
    expect(events).toEqual([null]);
  });
});
