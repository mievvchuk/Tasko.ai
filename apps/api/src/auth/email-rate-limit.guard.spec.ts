import type { ExecutionContext } from '@nestjs/common';
import { AuthEmailRateLimitGuard } from './email-rate-limit.guard.js';

describe('email request rate limit', () => {
  afterEach(() => vi.useRealTimers());
  it('limits repeated requests from one IP and permits requests after the window', () => {
    vi.useFakeTimers();
    const header = vi.fn();
    const context = {
      getHandler: () => function forgotPassword() {},
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          path: '/auth/forgot-password',
        }),
        getResponse: () => ({ setHeader: header }),
      }),
    } as unknown as ExecutionContext;
    const guard = new AuthEmailRateLimitGuard();
    for (let i = 0; i < 10; i++) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow();
    expect(header).toHaveBeenCalledWith('Retry-After', 900);
    vi.advanceTimersByTime(900001);
    expect(guard.canActivate(context)).toBe(true);
  });
  it('shares the same IP limit across casing and trailing-slash variants of a handler', () => {
    const guard = new AuthEmailRateLimitGuard();
    let path = '/auth/register';
    const context = {
      getHandler: () => function register() {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', path }),
        getResponse: () => ({ setHeader: vi.fn() }),
      }),
    } as unknown as ExecutionContext;
    for (let i = 0; i < 10; i++) guard.canActivate(context);
    path = '/AUTH/Register/';
    expect(() => guard.canActivate(context)).toThrow();
  });
});
