import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { CurrentUser } from '../users/users.service.js';

export type AuthenticatedRequest = Request & { user: CurrentUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match) throw new UnauthorizedException('Потрібен JWT Bearer токен.');
    let payload: { sub?: unknown; sid?: unknown };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: unknown; sid?: unknown }>(
        match[1],
        {
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Токен некоректний або прострочений.');
    }
    if (
      typeof payload.sub !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(payload.sub) ||
      typeof payload.sid !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(payload.sid)
    )
      throw new UnauthorizedException('Токен некоректний.');
    request.user = await this.auth.authenticate(payload.sub, payload.sid);
    return true;
  }
}
