import type { ExecutionContext } from '@nestjs/common';
import { AiRateLimitGuard, aiRequestsPerHour } from '../../../src/agent/ai-rate-limit.guard.js';

describe('AI rate limit', () => {
  const contextFor = (userId: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId } }),
        getResponse: () => ({ setHeader: vi.fn() }),
      }),
    }) as unknown as ExecutionContext;

  it('stops one user after the hourly limit without affecting others', () => {
    const guard = new AiRateLimitGuard();
    for (let i = 0; i < aiRequestsPerHour; i++) guard.canActivate(contextFor('a'));
    expect(() => guard.canActivate(contextFor('a'))).toThrow();
    expect(guard.canActivate(contextFor('b'))).toBe(true);
  });
});
