import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.js';
import { UsersService } from '../users/users.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersController } from '../users/users.controller.js';
import { MailService } from './mail.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { AuthEmailRateLimitGuard } from './email-rate-limit.guard.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: {
          expiresIn: 3600,
          algorithm: 'HS256',
          issuer: 'aifreelance-api',
          audience: 'aifreelance-api',
        },
        verifyOptions: {
          issuer: 'aifreelance-api',
          audience: 'aifreelance-api',
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    UsersService,
    AuthService,
    JwtAuthGuard,
    MailService,
    EmailVerificationService,
    AuthEmailRateLimitGuard,
  ],
  exports: [UsersService, AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
