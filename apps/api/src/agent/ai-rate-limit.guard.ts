import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Response } from 'express';
import { HitCounter } from '../common/hit-counter.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';

// Кожен запит до AI коштує грошей: не більше 30 на користувача за годину на всі AI-дії разом
export const aiRequestsPerHour = 30;

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly counter = new HitCounter(60 * 60 * 1000);

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    // Стоїть після JwtAuthGuard контролера, тож користувач уже відомий
    const { user } = http.getRequest<AuthenticatedRequest>();
    this.counter.hit(
      [[`ai:${user.id}`, aiRequestsPerHour]],
      http.getResponse<Response>(),
    );
    return true;
  }
}
