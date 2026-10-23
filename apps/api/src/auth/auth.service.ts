import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.js';
import { hasDatabaseCode } from '../prisma/database-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  UsersService,
  type CurrentUser,
  type PublicUser,
  type UserRole,
} from '../users/users.service.js';
import type {
  ChangePasswordDto,
  DisableTwoFactorDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TwoFactorCodeDto,
} from './auth.dto.js';
import { hashPassword, verifyPassword } from './password.js';
import { createTotpSecret, createTotpUri, verifyTotp } from './totp.js';
import { MailService } from './mail.service.js';
import { EmailVerificationService } from './email-verification.service.js';

interface LoginMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly sessionLifetime = 60 * 60 * 1000;

  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(EmailVerificationService)
    private readonly verification: EmailVerificationService,
  ) {}

  private get db() {
    return this.prisma.client.orm.public;
  }

  async register(data: RegisterDto) {
    if (this.config.emailVerificationRequired && !this.mail.configured())
      throw new ServiceUnavailableException(
        'Надсилання листів підтвердження ще не налаштовано.',
      );
    if (await this.users.findByEmail(data.email))
      throw new ConflictException('Ця електронна пошта вже зареєстрована.');
    try {
      const user = await this.users.create({
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        emailVerifiedAt: this.config.emailVerificationRequired
          ? null
          : new Date(),
      });
      if (this.config.emailVerificationRequired) {
        let emailSent = true;
        try {
          await this.verification.issue(user);
        } catch (error) {
          if (!(error instanceof ServiceUnavailableException)) throw error;
          emailSent = false;
        }
        return {
          ...this.publicUser(user),
          requiresEmailVerification: true,
          emailSent,
        };
      }
      return { ...this.publicUser(user), requiresEmailVerification: false };
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException('Ця електронна пошта вже зареєстрована.');
      throw error;
    }
  }

  async login(data: LoginDto, metadata: LoginMetadata = {}) {
    const user = await this.users.findByEmail(data.email);
    if (!user || !(await verifyPassword(data.password, user.passwordHash)))
      throw new UnauthorizedException('Неправильна пошта або пароль.');
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('Обліковий запис заблоковано.');

    if (user.emailVerifiedAt === null)
      throw new ForbiddenException(
        'Спочатку підтвердьте електронну пошту. Ви можете повторно надіслати лист підтвердження.',
      );

    if (user.twoFactorEnabled) {
      if (!data.twoFactorCode) return { requiresTwoFactor: true };
      if (
        !user.twoFactorSecret ||
        !verifyTotp(user.twoFactorSecret, data.twoFactorCode)
      ) {
        throw new UnauthorizedException(
          'Неправильний код двофакторного входу.',
        );
      }
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionLifetime);
    await this.db.AuthSession.create({
      id: sessionId,
      userId: user.id,
      userAgent: metadata.userAgent?.slice(0, 500) || null,
      ipAddress: metadata.ipAddress?.slice(0, 100) || null,
      createdAt: new Date(),
      expiresAt,
      revokedAt: null,
    });
    return {
      requiresTwoFactor: false,
      accessToken: await this.jwt.signAsync({ sub: user.id, sid: sessionId }),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: this.publicUser(user),
    };
  }

  async authenticate(id: string, sessionId: string): Promise<CurrentUser> {
    const session = await this.db.AuthSession.where({
      id: sessionId,
      userId: id,
    }).first();
    if (
      !session ||
      session.revokedAt ||
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Сеанс завершено. Увійдіть ще раз.');
    }
    const user = await this.users.findById(id);
    if (!user) throw new UnauthorizedException('Користувача не знайдено.');
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('Обліковий запис заблоковано.');
    if (user.emailVerifiedAt === null)
      throw new ForbiddenException('Спочатку підтвердьте електронну пошту.');
    return { ...this.publicUser(user), sessionId };
  }

  async logout(user: CurrentUser) {
    await this.db.AuthSession.where({
      id: user.sessionId,
      userId: user.id,
    }).update({
      revokedAt: new Date(),
    });
    return { message: 'Сеанс завершено.' };
  }

  async sessions(user: CurrentUser) {
    const now = Date.now();
    const sessions = await this.db.AuthSession.where({ userId: user.id })
      .orderBy((session) => session.createdAt.desc())
      .all();
    return sessions
      .filter(
        (session) =>
          !session.revokedAt && new Date(session.expiresAt).getTime() > now,
      )
      .map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: session.id === user.sessionId,
      }));
  }

  async revokeSession(user: CurrentUser, sessionId: string) {
    const session = await this.db.AuthSession.where({
      id: sessionId,
      userId: user.id,
    }).first();
    if (!session) throw new NotFoundException('Сеанс не знайдено.');
    if (!session.revokedAt) {
      await this.db.AuthSession.where({ id: session.id }).update({
        revokedAt: new Date(),
      });
    }
    return { message: 'Сеанс завершено.' };
  }

  async changePassword(user: CurrentUser, data: ChangePasswordDto) {
    const account = await this.users.findById(user.id);
    if (
      !account ||
      !(await verifyPassword(data.currentPassword, account.passwordHash))
    ) {
      throw new UnauthorizedException('Поточний пароль неправильний.');
    }
    if (data.currentPassword === data.newPassword)
      throw new BadRequestException(
        'Новий пароль має відрізнятися від поточного.',
      );
    await this.db.User.where({ id: user.id }).update({
      passwordHash: await hashPassword(data.newPassword),
      updatedAt: new Date(),
    });
    await this.revokeOtherSessions(user);
    return { message: 'Пароль змінено.' };
  }

  async setupTwoFactor(user: CurrentUser) {
    const secret = createTotpSecret();
    const uri = createTotpUri(user.email, secret);
    await this.db.User.where({ id: user.id }).update({
      twoFactorSecret: secret,
      twoFactorEnabled: false,
      updatedAt: new Date(),
    });
    return {
      secret,
      qrCode: await QRCode.toDataURL(uri, { width: 240, margin: 1 }),
    };
  }

  async enableTwoFactor(user: CurrentUser, data: TwoFactorCodeDto) {
    const account = await this.users.findById(user.id);
    if (
      !account?.twoFactorSecret ||
      !verifyTotp(account.twoFactorSecret, data.code)
    ) {
      throw new BadRequestException('Код 2FA неправильний або прострочений.');
    }
    await this.db.User.where({ id: user.id }).update({
      twoFactorEnabled: true,
      updatedAt: new Date(),
    });
    return { message: 'Двофакторний вхід увімкнено.' };
  }

  async disableTwoFactor(user: CurrentUser, data: DisableTwoFactorDto) {
    const account = await this.users.findById(user.id);
    if (
      !account ||
      !(await verifyPassword(data.password, account.passwordHash))
    )
      throw new UnauthorizedException('Пароль неправильний.');
    if (
      !account.twoFactorSecret ||
      !verifyTotp(account.twoFactorSecret, data.code)
    ) {
      throw new BadRequestException('Код 2FA неправильний або прострочений.');
    }
    await this.db.User.where({ id: user.id }).update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      updatedAt: new Date(),
    });
    return { message: 'Двофакторний вхід вимкнено.' };
  }

  async forgotPassword(email: string) {
    if (
      !this.mail.configured() &&
      (!this.config.emailApiKey || !this.config.emailFrom)
    ) {
      throw new ServiceUnavailableException(
        'Надсилання листів ще не налаштовано адміністратором.',
      );
    }
    const user = await this.users.findByEmail(email);
    if (!user) return this.resetRequestedMessage();

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    await this.expireResetTokens(user.id);
    const reset = await this.db.PasswordResetToken.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: null,
    });
    try {
      await this.sendResetEmail(user.email, token);
    } catch (error) {
      await this.db.PasswordResetToken.where({ id: reset.id }).update({
        usedAt: new Date(),
      });
      throw error;
    }
    return this.resetRequestedMessage();
  }

  async resetPassword(data: ResetPasswordDto) {
    const reset = await this.db.PasswordResetToken.where({
      tokenHash: this.hashToken(data.token),
    }).first();
    if (
      !reset ||
      reset.usedAt ||
      new Date(reset.expiresAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'Посилання для відновлення некоректне або прострочене.',
      );
    }
    await this.db.User.where({ id: reset.userId }).update({
      passwordHash: await hashPassword(data.newPassword),
      updatedAt: new Date(),
    });
    await this.db.PasswordResetToken.where({ id: reset.id }).update({
      usedAt: new Date(),
    });
    await this.revokeAllSessions(reset.userId);
    return { message: 'Пароль відновлено. Увійдіть із новим паролем.' };
  }

  private async revokeOtherSessions(user: CurrentUser) {
    const sessions = await this.db.AuthSession.where({ userId: user.id }).all();
    for (const session of sessions) {
      if (session.id !== user.sessionId && !session.revokedAt) {
        await this.db.AuthSession.where({ id: session.id }).update({
          revokedAt: new Date(),
        });
      }
    }
  }

  private async revokeAllSessions(userId: string) {
    const sessions = await this.db.AuthSession.where({ userId }).all();
    for (const session of sessions) {
      if (!session.revokedAt) {
        await this.db.AuthSession.where({ id: session.id }).update({
          revokedAt: new Date(),
        });
      }
    }
  }

  private async expireResetTokens(userId: string) {
    const tokens = await this.db.PasswordResetToken.where({ userId }).all();
    for (const token of tokens) {
      if (!token.usedAt) {
        await this.db.PasswordResetToken.where({ id: token.id }).update({
          usedAt: new Date(),
        });
      }
    }
  }

  private async sendResetEmail(email: string, token: string) {
    if (this.mail.configured()) return this.mail.sendReset(email, token);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.emailFrom,
        to: [email],
        subject: 'Відновлення пароля Tasko.ai',
        html: `<p>Щоб встановити новий пароль, відкрийте посилання:</p><p><a href="${this.config.webOrigin}/reset-password?token=${encodeURIComponent(token)}">Відновити пароль</a></p><p>Посилання діє 30 хвилин.</p>`,
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Не вдалося надіслати лист. Спробуйте пізніше.',
      );
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async resendVerification(email: string) {
    const message = {
      message:
        'Якщо ця пошта очікує підтвердження, на неї надіслано лист. Повторне надсилання доступне не частіше ніж раз на хвилину.',
    };
    if (!this.mail.configured())
      throw new ServiceUnavailableException(
        'Надсилання листів SMTP ще не налаштовано.',
      );
    const user = await this.users.findByEmail(email);
    if (user?.emailVerifiedAt === null && user.status === 'ACTIVE') {
      try {
        await this.verification.issue(user);
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
      }
    }
    return message;
  }

  private resetRequestedMessage() {
    return {
      message: 'Якщо така пошта зареєстрована, на неї надіслано посилання.',
    };
  }

  private publicUser(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    twoFactorEnabled: boolean;
  }): PublicUser {
    if (!['CLIENT', 'FREELANCER', 'ADMIN'].includes(user.role))
      throw new ForbiddenException('Роль користувача некоректна.');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
