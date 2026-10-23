import { randomUUID } from 'node:crypto';
import { EmailVerificationService } from './email-verification.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MailService } from './mail.service.js';

describe('email verification', () => {
  function setup() {
    const user = {
      id: randomUUID(),
      email: 'user@example.com',
      emailVerifiedAt: null as Date | null,
      status: 'ACTIVE',
    };
    let token: Record<string, unknown> | null = null;
    const db = {
      User: {
        where: vi.fn(() => ({
          update: vi.fn(async () => user),
          first: vi.fn(async () => user),
        })),
      },
      EmailVerificationToken: {
        where: vi.fn((query: Record<string, unknown>) => ({
          first: vi.fn(async () =>
            query.tokenHash && query.tokenHash !== token?.tokenHash
              ? null
              : token,
          ),
          all: vi.fn(async () => (token ? [token] : [])),
          update: vi.fn(async (data: Record<string, unknown>) => {
            if (token) Object.assign(token, data);
            return token;
          }),
        })),
        create: vi.fn(async (data: Record<string, unknown>) => {
          token = data;
          return data;
        }),
      },
    };
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ orm: { public: db } }),
    );
    const prisma = { client: { orm: { public: db }, transaction } };
    const mail = {
      sendVerification: vi.fn(
        async (_email: string, _token: string) => undefined,
      ),
    };
    const service = new EmailVerificationService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
    );
    return { service, mail, db, user, getToken: () => token };
  }
  it('stores only a hash and sends a different raw token', async () => {
    const { service, mail, db, user } = setup();
    await service.issue(user);
    const raw = mail.sendVerification.mock.calls[0][1];
    const row = db.EmailVerificationToken.create.mock.calls[0][0];
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('does not send another email during the cooldown', async () => {
    const { service, mail, user } = setup();
    await service.issue(user);
    await service.issue(user);
    expect(mail.sendVerification).toHaveBeenCalledTimes(1);
  });
  it('confirms the email and consumes the token only once', async () => {
    const { service, mail, user, db, getToken } = setup();
    await service.issue(user);
    const raw = mail.sendVerification.mock.calls[0][1];
    await service.verify(raw);
    expect(db.User.where).toHaveBeenCalledWith({ id: user.id });
    expect(getToken()?.usedAt).toBeInstanceOf(Date);
    await expect(service.verify(raw)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects expired and unknown tokens', async () => {
    const { service, mail, user, getToken } = setup();
    await expect(service.verify('x'.repeat(43))).rejects.toMatchObject({
      status: 400,
    });
    await service.issue(user);
    getToken()!.expiresAt = new Date(Date.now() - 1);
    await expect(
      service.verify(mail.sendVerification.mock.calls[0][1]),
    ).rejects.toMatchObject({ status: 400 });
  });
});
