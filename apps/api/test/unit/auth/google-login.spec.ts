import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../src/config/config.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { UsersService } from '../../../src/users/users.service.js';
import { AuthService, googleName } from '../../../src/auth/auth.service.js';
import { GoogleVerifier } from '../../../src/auth/google.js';
import { hashPassword } from '../../../src/auth/password.js';

const config: AppConfig = {
  databaseUrl: 'postgresql://localhost/test',
  jwtSecret: 'a'.repeat(64),
  port: 3000,
  webOrigin: 'http://localhost:5173',
  googleClientId: 'client-id.apps.googleusercontent.com',
};

describe('sign-in with Google', () => {
  const jwt = new JwtService({ secret: 'a'.repeat(64) });
  const users = { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn() };
  const userQuery = { first: vi.fn(), update: vi.fn() };
  const db = {
    AuthSession: { create: vi.fn() },
    User: { where: vi.fn(() => userQuery) },
  };
  const google = { verify: vi.fn() };
  const auth = new AuthService(
    users as unknown as UsersService,
    jwt,
    { client: { orm: { public: db } } } as unknown as PrismaService,
    config,
    google as unknown as GoogleVerifier,
  );
  const profile = {
    googleId: 'google-123',
    email: 'olena@example.com',
    name: 'Олена Коваль',
  };
  const account = (data: object = {}) => ({
    id: randomUUID(),
    name: 'Олена',
    email: profile.email,
    role: 'CLIENT',
    status: 'ACTIVE',
    passwordHash: null as string | null,
    googleId: null as string | null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    avatarUrl: null,
    createdAt: new Date(),
    ...data,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    google.verify.mockResolvedValue(profile);
    userQuery.first.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
  });

  it('creates a client without a password on first sign-in', async () => {
    const created = account({ googleId: profile.googleId });
    users.create.mockResolvedValue(created);
    const result = await auth.loginWithGoogle({ credential: 'x'.repeat(40) });
    expect(users.create).toHaveBeenCalledWith({
      name: 'Олена Коваль',
      email: profile.email,
      role: 'CLIENT',
      passwordHash: null,
      googleId: profile.googleId,
    });
    expect(result).toMatchObject({ created: true, requiresTwoFactor: false });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({ hasPassword: false });
  });

  it('links Google to an existing account with the same email', async () => {
    const existing = account({
      passwordHash: await hashPassword('Secret-123'),
    });
    users.findByEmail.mockResolvedValue(existing);
    userQuery.update.mockResolvedValue({
      ...existing,
      googleId: profile.googleId,
    });
    const result = await auth.loginWithGoogle({ credential: 'x'.repeat(40) });
    expect(userQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ googleId: profile.googleId }),
    );
    expect(users.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ created: false });
    expect(result.user).toMatchObject({ hasPassword: true });
  });

  it('refuses an email already linked to another Google account', async () => {
    users.findByEmail.mockResolvedValue(account({ googleId: 'google-other' }));
    await expect(
      auth.loginWithGoogle({ credential: 'x'.repeat(40) }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('still asks for the 2FA code', async () => {
    userQuery.first.mockResolvedValue(
      account({
        googleId: profile.googleId,
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      }),
    );
    const result = await auth.loginWithGoogle({ credential: 'x'.repeat(40) });
    expect(result).toMatchObject({ requiresTwoFactor: true });
    expect(db.AuthSession.create).not.toHaveBeenCalled();
  });

  it('rejects password sign-in for an account without a password', async () => {
    users.findByEmail.mockResolvedValue(account());
    await expect(
      auth.login({ email: profile.email, password: 'Anything-123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets a Google account set a password without the current one', async () => {
    users.findById.mockResolvedValue(account());
    const sessions = { all: vi.fn().mockResolvedValue([]) };
    db.User.where.mockReturnValueOnce(userQuery);
    (db.AuthSession as Record<string, unknown>).where = vi.fn(() => sessions);
    await auth.changePassword(
      { ...account(), role: 'CLIENT', sessionId: randomUUID() },
      { newPassword: 'New-password-123' },
    );
    expect(userQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: expect.any(String) }),
    );
  });

  it('builds a valid name from the Google profile', () => {
    expect(googleName('Олена 🌸 Коваль', 'x@example.com')).toBe('Олена Коваль');
    expect(googleName('😀', 'ivan.petrenko@example.com')).toBe('ivan.petrenko');
    expect(googleName(undefined, 'a@example.com')).toBe('Користувач');
  });
});

describe('Google ID token check', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is disabled without GOOGLE_CLIENT_ID', async () => {
    const verifier = new GoogleVerifier({
      ...config,
      googleClientId: undefined,
    });
    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('checks the audience and requires a verified email', async () => {
    const spy = vi
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockResolvedValue({
        getPayload: () => ({
          sub: 'google-1',
          email: 'Olena@Example.com',
          email_verified: false,
        }),
      } as never);
    const verifier = new GoogleVerifier(config);
    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(spy).toHaveBeenCalledWith({
      idToken: 'token',
      audience: config.googleClientId,
    });
  });

  it('returns the profile with a lower-case email', async () => {
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-1',
        email: 'Olena@Example.com',
        email_verified: true,
        name: 'Олена',
      }),
    } as never);
    await expect(new GoogleVerifier(config).verify('token')).resolves.toEqual({
      googleId: 'google-1',
      email: 'olena@example.com',
      name: 'Олена',
    });
  });

  it('turns an invalid token into 401', async () => {
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(
      new Error('Wrong recipient'),
    );
    await expect(
      new GoogleVerifier(config).verify('token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
