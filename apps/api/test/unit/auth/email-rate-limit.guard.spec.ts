import type { ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import { AuthEmailRateLimitGuard } from '../../../src/auth/email-rate-limit.guard.js';
import { HitCounter } from '../../../src/common/hit-counter.js';

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

  it('ignores a non-string or oversized email instead of storing or crashing on it', () => {
    const guard = new AuthEmailRateLimitGuard();
    const odd = (email: unknown) =>
      ({
        getHandler: () => function login() {},
        switchToHttp: () => ({
          getRequest: () => ({ ip: '10.0.0.2', body: { email } }),
          getResponse: () => ({ setHeader: vi.fn() }),
        }),
      }) as unknown as ExecutionContext;
    expect(guard.canActivate(odd({ toString: 0 }))).toBe(true);
    expect(guard.canActivate(odd('x'.repeat(100_000)))).toBe(true);
  });
});

describe('hit counter', () => {
  const response = () => ({ setHeader: vi.fn() }) as unknown as Response;

  it('evicts the oldest key when full instead of rejecting everyone', () => {
    const counter = new HitCounter(60_000, 2);
    counter.hit([['a', 1]], response());
    counter.hit([['b', 1]], response());
    expect(() => counter.hit([['c', 1]], response())).not.toThrow();
    // «a» витіснено, тож новий запит з ним знову проходить; «c» уже вичерпав ліміт
    expect(() => counter.hit([['a', 1]], response())).not.toThrow();
    expect(() => counter.hit([['c', 1]], response())).toThrow();
  });

  it('does not count a rejected request against the other keys', () => {
    const counter = new HitCounter(60_000);
    counter.hit([['email', 1]], response());
    expect(() => counter.hit([['ip', 2], ['email', 1]], response())).toThrow();
    // Відхилений запит не зарахувався: з «ip» ще можна двічі
    counter.hit([['ip', 2]], response());
    counter.hit([['ip', 2]], response());
    expect(() => counter.hit([['ip', 2]], response())).toThrow();
  });
});
