import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.js';
import { hasDatabaseCode } from '../prisma/database-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  UsersService,
  toPublicUser,
  type CurrentUser,
  type PublicUser,
} from '../users/users.service.js';
import type {
  ChangePasswordDto,
  DisableTwoFactorDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  TwoFactorCodeDto,
} from './auth.dto.js';
import { GoogleVerifier } from './google.js';
import { nameWithoutEmoji } from './auth.dto.js';
import { hashPassword, verifyPassword } from './password.js';
import { createTotpSecret, createTotpUri, verifyTotp } from './totp.js';

interface LoginMetadata {
  userAgent?: string;
  ipAddress?: string;
}

const duplicateEmailMessage = 'Ця електронна пошта вже зареєстрована.';

@Injectable()
export class AuthService {
  private readonly sessionLifetime = 60 * 60 * 1000;
  // «Запам'ятати мене»: сеанс на 30 днів
  private readonly rememberedSessionLifetime = 30 * 24 * 60 * 60 * 1000;

  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(GoogleVerifier) private readonly google: GoogleVerifier,
  ) {}

  private get db() {
    return this.prisma.client.orm.public;
  }

  // Реєструє користувача; пошту не підтверджуємо, тож вхід доступний одразу.
  async register(data: RegisterDto) {
    if (await this.users.findByEmail(data.email))
      throw new ConflictException(duplicateEmailMessage);

    try {
      const user = await this.users.create({
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash: await hashPassword(data.password),
      });
      return this.publicUser(user);
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
    // Акаунт без пароля (створений через Google) отримує ту саму відповідь: не підказуємо, які пошти є
    if (
      !user?.passwordHash ||
      !(await verifyPassword(data.password, user.passwordHash))
    )
      throw new UnauthorizedException('Неправильна пошта або пароль.');
    return this.startSession(user, data, metadata);
  }

  // Вхід і реєстрація через Google: знаходить акаунт за Google ID або підтвердженою поштою,
  // інакше створює новий акаунт з роллю, обраною на головній (за замовчуванням — клієнт)
  async loginWithGoogle(data: GoogleLoginDto, metadata: LoginMetadata = {}) {
    const profile = await this.google.verify(data.credential);
    let user =
      (await this.db.User.where({ googleId: profile.googleId }).first()) ??
      (await this.users.findByEmail(profile.email));
    let created = false;
    if (!user) {
      try {
        user = await this.users.create({
          name: googleName(profile.name, profile.email),
          email: profile.email,
          role: data.role ?? 'CLIENT',
          passwordHash: null,
          googleId: profile.googleId,
        });
        created = true;
      } catch (error) {
        if (hasDatabaseCode(error, '23505'))
          throw new ConflictException(
            'Акаунт створюється в іншій вкладці. Спробуйте ще раз.',
          );
        throw error;
      }
    } else if (!user.googleId) {
      // Пошта збігається з наявним акаунтом: прив'язуємо Google до нього
      user =
        (await this.db.User.where({ id: user.id }).update({
          googleId: profile.googleId,
          updatedAt: new Date(),
        })) ?? user;
    } else if (user.googleId !== profile.googleId) {
      throw new ConflictException(
        "Ця пошта вже прив'язана до іншого акаунта Google.",
      );
    }
    return { ...(await this.startSession(user, data, metadata)), created };
  }

  // Спільний кінець входу: блокування, 2FA і новий сеанс
  private async startSession(
    user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>,
    data: { twoFactorCode?: string; rememberMe?: boolean },
    metadata: LoginMetadata,
  ) {
    this.ensureActive(user);

    if (user.twoFactorEnabled) {
      // Без коду просимо клієнт показати поле для коду 2FA.
      if (!data.twoFactorCode) return { requiresTwoFactor: true };
      if (!this.isValidTotp(user.twoFactorSecret, data.twoFactorCode))
        throw new UnauthorizedException(
          'Неправильний код двофакторного входу.',
        );
    }

    const lifetime = data.rememberMe
      ? this.rememberedSessionLifetime
      : this.sessionLifetime;
    const sessionId = await this.createSession(user.id, metadata, lifetime);
    return {
      requiresTwoFactor: false,
      accessToken: await this.jwt.signAsync(
        { sub: user.id, sid: sessionId },
        { expiresIn: lifetime / 1000 },
      ),
      tokenType: 'Bearer',
      expiresIn: lifetime / 1000,
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
    if (!account)
      throw new BadRequestException('Поточний пароль неправильний.');
    // Акаунт із Google без пароля може встановити пароль, не вводячи поточного
    if (
      account.passwordHash &&
      !(await verifyPassword(data.currentPassword ?? '', account.passwordHash))
    ) {
      // 400, а не 401: інакше інтерфейс вважає сеанс завершеним і виходить з акаунта
      throw new BadRequestException('Поточний пароль неправильний.');
    }
    if (account.passwordHash && data.currentPassword === data.newPassword)
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
      (account.passwordHash &&
        !(await verifyPassword(data.password ?? '', account.passwordHash)))
    )
      throw new BadRequestException('Пароль неправильний.');
    if (!this.isValidTotp(account.twoFactorSecret, data.code))
      throw new BadRequestException('Код 2FA неправильний або прострочений.');
    await this.db.User.where({ id: user.id }).update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      updatedAt: new Date(),
    });
    return { message: 'Двофакторний вхід вимкнено.' };
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

  private async createSession(
    userId: string,
    metadata: LoginMetadata,
    lifetime: number,
  ) {
    const sessionId = randomUUID();
    await this.db.AuthSession.create({
      id: sessionId,
      userId,
      // Обрізаємо довгі значення, щоб вони вмістилися в колонки БД.
      userAgent: metadata.userAgent?.slice(0, 500) || null,
      ipAddress: metadata.ipAddress?.slice(0, 100) || null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + lifetime),
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

  private publicUser(user: Parameters<typeof toPublicUser>[0]): PublicUser {
    return toPublicUser(user);
  }
}

// Ім'я з Google може містити емодзі або бути порожнім — тоді беремо початок пошти
export function googleName(name: string | undefined, email: string) {
  const strip = (value: string) =>
    [...value]
      .filter((char) => nameWithoutEmoji.test(char))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  const fromName = strip(name ?? '');
  if (fromName.length >= 2) return fromName;
  const fromEmail = strip(email.split('@')[0]);
  return fromEmail.length >= 2 ? fromEmail : 'Користувач';
}
