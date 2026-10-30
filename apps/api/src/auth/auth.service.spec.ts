import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';
import type { MailService } from './mail.service.js';

describe('authentication', () => {
  const jwt = new JwtService({
    secret: 'a'.repeat(64),
    signOptions: { expiresIn: 3600 },
  });
  const users = { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn() };
  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    userId: '',
    userAgent: 'test',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
  };
  const sessionQuery = {
    first: vi.fn(),
    update: vi.fn(),
    all: vi.fn(),
    orderBy: vi.fn(),
  };
  sessionQuery.orderBy.mockReturnValue(sessionQuery);
  const passwordResetQuery = { first: vi.fn(), update: vi.fn(), all: vi.fn() };
  const db = {
    AuthSession: {
      create: vi.fn(),
      where: vi.fn(() => sessionQuery),
    },
    PasswordResetToken: {
      create: vi.fn(),
      where: vi.fn(() => passwordResetQuery),
    },
    User: { where: vi.fn(() => ({ update: vi.fn() })) },
  };
  const prisma = { client: { orm: { public: db } } };
  const config: AppConfig = {
    databaseUrl: 'postgresql://localhost/test',
    jwtSecret: 'a'.repeat(64),
    port: 3000,
    webOrigin: 'http://localhost:5173',
  };
  const mail = { configured: vi.fn(() => false), sendReset: vi.fn() };
  const auth = new AuthService(
    users as unknown as UsersService,
    jwt,
    prisma as unknown as PrismaService,
    config,
    mail as unknown as MailService,
  );
  const credentials = {
    email: 'client@example.com',
    password: 'Coursework-test-123',
  };
  let user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    passwordHash: string;
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    emailVerifiedAt: Date | null;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mail.configured.mockReturnValue(false);
    sessionQuery.orderBy.mockReturnValue(sessionQuery);
    user = {
      id: randomUUID(),
      name: 'Client',
      email: credentials.email,
      role: 'CLIENT',
      status: 'ACTIVE',
      passwordHash: await hashPassword(credentials.password),
      twoFactorEnabled: false,
      twoFactorSecret: null,
      emailVerifiedAt: new Date(),
    };
    session.userId = user.id;
    session.expiresAt = new Date(Date.now() + 60_000);
    session.revokedAt = null;
    sessionQuery.first.mockResolvedValue(session);
    sessionQuery.all.mockResolvedValue([session]);
  });

  it('registers a user without returning the password hash', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user);
    const result = await auth.register({
      ...credentials,
      name: 'Client',
      role: 'CLIENT',
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(users.create.mock.calls[0][0].passwordHash).not.toBe(
      credentials.password,
    );
  });

  it('rejects a duplicate email', async () => {
    users.findByEmail.mockResolvedValue(user);
    await expect(
      auth.register({ ...credentials, name: 'Client', role: 'CLIENT' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('signs in accounts registered before email confirmation was removed', async () => {
    users.findByEmail.mockResolvedValueOnce({ ...user, emailVerifiedAt: null });
    await expect(auth.login(credentials)).resolves.toMatchObject({
      requiresTwoFactor: false,
    });
  });

  it('handles a duplicate created concurrently', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockRejectedValue({ cause: { code: '23505' } });
    await expect(
      auth.register({ ...credentials, name: 'Client', role: 'CLIENT' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a session and issues an expiring token', async () => {
    users.findByEmail.mockResolvedValue(user);
    const result = await auth.login(credentials);
    expect(result).toHaveProperty('accessToken');
    if (typeof result.accessToken !== 'string')
      throw new Error('JWT was not issued');
    const payload = await jwt.verifyAsync<{
      sub: string;
      sid: string;
      exp: number;
      iat: number;
    }>(result.accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.sid).toBeTruthy();
    expect(payload.exp - payload.iat).toBe(3600);
    expect(db.AuthSession.create).toHaveBeenCalledOnce();
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects the wrong password', async () => {
    users.findByEmail.mockResolvedValue(user);
    await expect(
      auth.login({ ...credentials, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects blocked accounts even with an active session', async () => {
    users.findById.mockResolvedValue({ ...user, status: 'BLOCKED' });
    await expect(auth.authenticate(user.id, sessionId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('uses the current database role', async () => {
    users.findById.mockResolvedValue({ ...user, role: 'FREELANCER' });
    expect((await auth.authenticate(user.id, sessionId)).role).toBe(
      'FREELANCER',
    );
  });

  it('rejects a revoked session', async () => {
    sessionQuery.first.mockResolvedValue({ ...session, revokedAt: new Date() });
    await expect(auth.authenticate(user.id, sessionId)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lists active sessions and marks the current one', async () => {
    sessionQuery.all.mockResolvedValue([
      session,
      {
        ...session,
        id: randomUUID(),
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]);

    const result = await auth.sessions({
      ...user,
      role: 'CLIENT',
      sessionId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: sessionId, current: true });
  });

  it('revokes logout and selected sessions', async () => {
    const current = { ...user, role: 'CLIENT' as const, sessionId };
    await expect(auth.logout(current)).resolves.toEqual({
      message: 'Сеанс завершено.',
    });
    await expect(auth.revokeSession(current, sessionId)).resolves.toEqual({
      message: 'Сеанс завершено.',
    });
    expect(sessionQuery.update).toHaveBeenCalled();

    sessionQuery.first.mockResolvedValue(null);
    await expect(
      auth.revokeSession(current, randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects password reset email when a provider is not configured', async () => {
    await expect(auth.forgotPassword(user.email)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects an invalid password reset token', async () => {
    passwordResetQuery.first.mockResolvedValue(null);
    await expect(
      auth.resetPassword({
        token: 'invalid-token',
        newPassword: 'New-pass-123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a 2FA secret and rejects an invalid activation code', async () => {
    const current = { ...user, role: 'CLIENT' as const, sessionId };
    const setup = await auth.setupTwoFactor(current);
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.qrCode).toMatch(/^data:image\/png;base64,/);

    users.findById.mockResolvedValue({
      ...user,
      twoFactorSecret: setup.secret,
    });
    await expect(
      auth.enableTwoFactor(current, { code: '000000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propagates database failures', async () => {
    users.findByEmail.mockRejectedValue(new Error('database unavailable'));
    await expect(auth.login(credentials)).rejects.toThrow(
      'database unavailable',
    );
  });
});
