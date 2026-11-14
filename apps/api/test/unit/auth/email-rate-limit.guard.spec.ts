import type { ExecutionContext } from '@nestjs/common';
import { AuthEmailRateLimitGuard } from '../../../src/auth/email-rate-limit.guard.js';

describe('email request rate limit', () => {
  afterEach(() => vi.useRealTimers());
  it('limits repeated requests from one IP and permits requests after the window', () => {
    vi.useFakeTimers();
    const header = vi.fn();
    const context = {
      getHandler: () => function register() {},
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          path: '/auth/register',
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

describe('login rate limit', () => {
  const contextFor = (email: string) =>
    ({
      getHandler: () => function login() {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '10.0.0.1', body: { email } }),
        getResponse: () => ({ setHeader: vi.fn() }),
      }),
    }) as unknown as ExecutionContext;

  it('stops password guessing on one account but lets others from the same IP sign in', () => {
    const guard = new AuthEmailRateLimitGuard();
    for (let i = 0; i < 10; i++) guard.canActivate(contextFor('victim@example.com'));
    expect(() => guard.canActivate(contextFor(' Victim@Example.com '))).toThrow();
    expect(guard.canActivate(contextFor('classmate@example.com'))).toBe(true);
  });

  it('caps all attempts from one IP', () => {
    const guard = new AuthEmailRateLimitGuard();
    for (let i = 0; i < 100; i++) guard.canActivate(contextFor(`u${i}@example.com`));
    expect(() => guard.canActivate(contextFor('new@example.com'))).toThrow();
  });
});
