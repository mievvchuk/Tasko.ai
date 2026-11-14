import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HitCounter } from '../common/hit-counter.js';

// На одну пошту з одного IP — 10 спроб (перебір пароля чи коду 2FA).
// З одного IP загалом: реєстрацій — 10, входів — 100, щоб уся аудиторія за одним NAT могла увійти
const perEmail = 10;
const perIp = (handler: string) => (handler === 'login' ? 100 : 10);

@Injectable()
export class AuthEmailRateLimitGuard implements CanActivate {
  private readonly counter = new HitCounter(15 * 60 * 1000);

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const handler = context.getHandler().name;
    const ipKey = `${request.ip || request.socket.remoteAddress}:${handler}`;
    // Guard працює до ValidationPipe, тож тіло ще сире: беремо лише рядок допустимої довжини
    const raw: unknown = (request.body as { email?: unknown } | undefined)
      ?.email;
    const email =
      typeof raw === 'string' && raw.length <= 254
        ? raw.trim().toLowerCase()
        : '';
    const keys: [string, number][] = [[ipKey, perIp(handler)]];
    if (email) keys.push([`${ipKey}:${email}`, perEmail]);
    this.counter.hit(keys, http.getResponse<Response>());
    return true;
  }
}
