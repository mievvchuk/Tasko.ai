import {
  Injectable,
  HttpException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const windowMs = 15 * 60 * 1000;
// На одну пошту з одного IP — 10 спроб (перебір пароля чи коду 2FA).
// З одного IP загалом: реєстрацій — 10, входів — 100, щоб уся аудиторія за одним NAT могла увійти
const perEmail = 10;
const perIp = (handler: string) => (handler === 'login' ? 100 : 10);

@Injectable()
export class AuthEmailRateLimitGuard implements CanActivate {
  private readonly requests = new Map<
    string,
    { count: number; until: number }
  >();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    for (const [key, entry] of this.requests)
      if (entry.until <= now) this.requests.delete(key);
    const handler = context.getHandler().name;
    const ipKey = `${request.ip || request.socket.remoteAddress}:${handler}`;
    const body: unknown = request.body;
    const email =
      body && typeof body === 'object' && 'email' in body
        ? String(body.email).trim().toLowerCase()
        : '';
    const keys: [string, number][] = [[ipKey, perIp(handler)]];
    if (email) keys.push([`${ipKey}:${email}`, perEmail]);
    for (const [key, limit] of keys) {
      const entry = this.requests.get(key);
      if (entry && entry.count >= limit) {
        context
          .switchToHttp()
          .getResponse<Response>()
          .setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
        throw new HttpException('Забагато спроб. Спробуйте пізніше.', 429);
      }
    }
    for (const [key] of keys) {
      const entry = this.requests.get(key);
      if (entry) entry.count++;
      else {
        if (this.requests.size >= 10000)
          throw new HttpException('Забагато запитів. Спробуйте пізніше.', 429);
        this.requests.set(key, { count: 1, until: now + windowMs });
      }
    }
    return true;
  }
}
