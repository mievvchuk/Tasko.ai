import {
  Injectable,
  HttpException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request, Response } from 'express';

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
    const key = `${request.ip || request.socket.remoteAddress}:${context.getHandler().name}`;
    const entry = this.requests.get(key);
    if (entry && entry.count >= 10) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      throw new HttpException('Забагато спроб. Спробуйте пізніше.', 429);
    }
    if (entry) entry.count++;
    else {
      if (this.requests.size >= 10000)
        throw new HttpException('Забагато запитів. Спробуйте пізніше.', 429);
      this.requests.set(key, { count: 1, until: now + 15 * 60 * 1000 });
    }
    return true;
  }
}
