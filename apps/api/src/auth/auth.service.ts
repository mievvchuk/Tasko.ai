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

const duplicateEmailMessage = 'Ця електронна пошта вже зареєстрована.';

@Injectable()
export class AuthService {
  private readonly sessionLifetime = 60 * 60 * 1000;
  private readonly resetTokenLifetime = 30 * 60 * 1000;

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

  // Реєструє користувача; за потреби надсилає лист підтвердження пошти.
  async register(data: RegisterDto) {
    const verificationRequired = this.config.emailVerificationRequired;
    if (verificationRequired && !this.mail.configured())
      throw new ServiceUnavailableException(
        'Надсилання листів підтвердження ще не налаштовано.',
      );
    if (await this.users.findByEmail(data.email))
      throw new ConflictException(duplicateEmailMessage);

    try {
      const user = await this.users.create({
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        emailVerifiedAt: verificationRequired ? null : new Date(),
      });
      if (!verificationRequired) {
        return { ...this.publicUser(user), requiresEmailVerification: false };
      }
      const emailSent = await this.trySendVerification(user);
      return {
        ...this.publicUser(user),
        requiresEmailVerification: true,
        emailSent,
      };
    } catch (error) {
      // 23505 — інший запит встиг зареєструвати цю пошту одночасно з нами.
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException(duplicateEmailMessage);
      throw error;
    }
  }

  // Перевіряє пароль (і код 2FA, якщо увімкнено) та видає JWT нового сеансу.
  async login(data: LoginDto, metadata: LoginMetadata = {}) {
    const user = await this.users.findByEmail(data.email);
    if (!user || !(await verifyPassword(data.password, user.passwordHash)))
      throw new UnauthorizedException('Неправильна пошта або пароль.');
    this.ensureActive(user);
    if (user.emailVerifiedAt === null)
      throw new ForbiddenException(
        'Спочатку підтвердьте електронну пошту. Ви можете повторно надіслати лист підтвердження.',
      );

    if (user.twoFactorEnabled) {
      // Без коду просимо клієнт показати поле для коду 2FA.
      if (!data.twoFactorCode) return { requiresTwoFactor: true };
      if (!this.isValidTotp(user.twoFactorSecret, data.twoFactorCode))
        throw new UnauthorizedException(
          'Неправильний код двофакторного входу.',
        );
    }

    const sessionId = await this.createSession(user.id, metadata);
    return {
      requiresTwoFactor: false,
      accessToken: await this.jwt.signAsync({ sub: user.id, sid: sessionId }),
      tokenType: 'Bearer',
      expiresIn: this.sessionLifetime / 1000,
      user: this.publicUser(user),
    };
  }

  // Перевіряє сеанс і актуальний стан користувача для кожного запиту з JWT.
  async authenticate(id: string, sessionId: string): Promise<CurrentUser> {
    const session = await this.db.AuthSession.where({
      id: sessionId,
      userId: id,
    }).first();
    if (!session || session.revokedAt || this.isExpired(session.expiresAt))
      throw new UnauthorizedException('Сеанс завершено. Увійдіть ще раз.');

    const user = await this.users.findById(id);
    if (!user) throw new UnauthorizedException('Користувача не знайдено.');
    this.ensureActive(user);
    if (user.emailVerifiedAt === null)
      throw new ForbiddenException('Спочатку підтвердьте електронну пошту.');
    return { ...this.publicUser(user), sessionId };
  }

  // Завершує поточний сеанс користувача.
  async logout(user: CurrentUser) {
    await this.db.AuthSession.where({
      id: user.sessionId,
      userId: user.id,
    }).update({
      revokedAt: new Date(),
    });
    return { message: 'Сеанс завершено.' };
  }

  // Повертає активні сеанси користувача й позначає поточний.
  async sessions(user: CurrentUser) {
    const now = Date.now();
    const sessions = await this.db.AuthSession.where({ userId: user.id })
      .orderBy((session) => session.createdAt.desc())
      .all();
    return sessions
      .filter(
        (session) =>
          !session.revokedAt && !this.isExpired(session.expiresAt, now),
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

  // Завершує вибраний сеанс користувача (наприклад, на іншому пристрої).
  async revokeSession(user: CurrentUser, sessionId: string) {
    const session = await this.db.AuthSession.where({
      id: sessionId,
      userId: user.id,
    }).first();
    if (!session) throw new NotFoundException('Сеанс не знайдено.');
    if (!session.revokedAt) await this.markSessionRevoked(session.id);
    return { message: 'Сеанс завершено.' };
  }

  // Змінює пароль і завершує всі інші сеанси користувача.
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
    await this.revokeSessions(user.id, user.sessionId);
    return { message: 'Пароль змінено.' };
  }

  // Генерує новий секрет 2FA і QR-код; 2FA вмикається лише після enableTwoFactor.
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

  // Вмикає 2FA, якщо користувач ввів правильний код із застосунку.
  async enableTwoFactor(user: CurrentUser, data: TwoFactorCodeDto) {
    const account = await this.users.findById(user.id);
    if (!this.isValidTotp(account?.twoFactorSecret, data.code))
      throw new BadRequestException('Код 2FA неправильний або прострочений.');
    await this.db.User.where({ id: user.id }).update({
      twoFactorEnabled: true,
      updatedAt: new Date(),
    });
    return { message: 'Двофакторний вхід увімкнено.' };
  }

  // Вимикає 2FA після перевірки пароля та поточного коду.
  async disableTwoFactor(user: CurrentUser, data: DisableTwoFactorDto) {
    const account = await this.users.findById(user.id);
    if (
      !account ||
      !(await verifyPassword(data.password, account.passwordHash))
    )
      throw new UnauthorizedException('Пароль неправильний.');
    if (!this.isValidTotp(account.twoFactorSecret, data.code))
      throw new BadRequestException('Код 2FA неправильний або прострочений.');
    await this.db.User.where({ id: user.id }).update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      updatedAt: new Date(),
    });
    return { message: 'Двофакторний вхід вимкнено.' };
  }

  // Надсилає лист із посиланням для відновлення пароля.
  // Відповідь однакова для наявної й відсутньої пошти, щоб не розкривати акаунти.
  async forgotPassword(email: string) {
    if (!this.canSendResetEmail())
      throw new ServiceUnavailableException(
        'Надсилання листів ще не налаштовано адміністратором.',
      );
    const user = await this.users.findByEmail(email);
    if (!user) return this.resetRequestedMessage();

    const { token, resetId } = await this.createResetToken(user.id);
    try {
      await this.sendResetEmail(user.email, token);
    } catch (error) {
      // Лист не дійшов — токен робимо недійсним, щоб ним не можна було скористатися.
      await this.markResetTokenUsed(resetId);
      throw error;
    }
    return this.resetRequestedMessage();
  }

  // Встановлює новий пароль за токеном із листа й завершує всі сеанси.
  async resetPassword(data: ResetPasswordDto) {
    const reset = await this.db.PasswordResetToken.where({
      tokenHash: this.hashToken(data.token),
    }).first();
    if (!reset || reset.usedAt || this.isExpired(reset.expiresAt))
      throw new BadRequestException(
        'Посилання для відновлення некоректне або прострочене.',
      );

    await this.db.User.where({ id: reset.userId }).update({
      passwordHash: await hashPassword(data.newPassword),
      updatedAt: new Date(),
    });
    await this.markResetTokenUsed(reset.id);
    await this.revokeSessions(reset.userId);
    return { message: 'Пароль відновлено. Увійдіть із новим паролем.' };
  }

  // Повторно надсилає лист підтвердження пошти.
  // Відповідь однакова для будь-якої пошти, щоб не розкривати акаунти.
  async resendVerification(email: string) {
    if (!this.mail.configured())
      throw new ServiceUnavailableException(
        'Надсилання листів SMTP ще не налаштовано.',
      );
    const user = await this.users.findByEmail(email);
    if (user?.emailVerifiedAt === null && user.status === 'ACTIVE') {
      await this.trySendVerification(user);
    }
    return {
      message:
        'Якщо ця пошта очікує підтвердження, на неї надіслано лист. Повторне надсилання доступне не частіше ніж раз на хвилину.',
    };
  }

  private ensureActive(user: { status: string }) {
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('Обліковий запис заблоковано.');
  }

  private isExpired(expiresAt: Date, now = Date.now()) {
    return new Date(expiresAt).getTime() <= now;
  }

  private isValidTotp(secret: string | null | undefined, code: string) {
    if (!secret) return false;
    return verifyTotp(secret, code);
  }

  private async createSession(userId: string, metadata: LoginMetadata) {
    const sessionId = randomUUID();
    await this.db.AuthSession.create({
      id: sessionId,
      userId,
      // Обрізаємо довгі значення, щоб вони вмістилися в колонки БД.
      userAgent: metadata.userAgent?.slice(0, 500) || null,
      ipAddress: metadata.ipAddress?.slice(0, 100) || null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionLifetime),
      revokedAt: null,
    });
    return sessionId;
  }

  private markSessionRevoked(sessionId: string) {
    return this.db.AuthSession.where({ id: sessionId }).update({
      revokedAt: new Date(),
    });
  }

  // Завершує всі активні сеанси користувача, крім keepSessionId (якщо його передано).
  private async revokeSessions(userId: string, keepSessionId?: string) {
    const sessions = await this.db.AuthSession.where({ userId }).all();
    for (const session of sessions) {
      if (session.id !== keepSessionId && !session.revokedAt) {
        await this.markSessionRevoked(session.id);
      }
    }
  }

  // Повертає false, якщо лист зараз не вдалося надіслати; інші помилки прокидаємо далі.
  private async trySendVerification(user: { id: string; email: string }) {
    try {
      await this.verification.issue(user);
      return true;
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      return false;
    }
  }

  private canSendResetEmail() {
    if (this.mail.configured()) return true;
    return Boolean(this.config.emailApiKey && this.config.emailFrom);
  }

  // У БД зберігаємо лише хеш токена, а сам токен іде користувачу в листі.
  private async createResetToken(userId: string) {
    const token = randomBytes(32).toString('base64url');
    await this.expireResetTokens(userId);
    const reset = await this.db.PasswordResetToken.create({
      id: randomUUID(),
      userId,
      tokenHash: this.hashToken(token),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.resetTokenLifetime),
      usedAt: null,
    });
    return { token, resetId: reset.id };
  }

  private markResetTokenUsed(resetId: string) {
    return this.db.PasswordResetToken.where({ id: resetId }).update({
      usedAt: new Date(),
    });
  }

  private async expireResetTokens(userId: string) {
    const tokens = await this.db.PasswordResetToken.where({ userId }).all();
    for (const token of tokens) {
      if (!token.usedAt) await this.markResetTokenUsed(token.id);
    }
  }

  // Якщо SMTP не налаштовано, надсилаємо лист через HTTP API Resend.
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
        html: this.buildResetEmailHtml(token),
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Не вдалося надіслати лист. Спробуйте пізніше.',
      );
  }

  private buildResetEmailHtml(token: string) {
    const link = `${this.config.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
    return `<p>Щоб встановити новий пароль, відкрийте посилання:</p><p><a href="${link}">Відновити пароль</a></p><p>Посилання діє 30 хвилин.</p>`;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
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
