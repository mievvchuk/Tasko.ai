import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../dist/app.module.js';
import { setupApp } from './../dist/setup.js';
import { PrismaService } from './../dist/prisma/prisma.service.js';
import { UsersService } from './../dist/users/users.service.js';
import { hashPassword } from './../dist/auth/password.js';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from './../dist/config/config.module.js';

describe('API authorization (e2e)', () => {
  let app: INestApplication<App>;
  let authSession: Record<string, unknown> | null;
  const users = { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn() };
  const prisma = {
    checkConnection: vi.fn().mockResolvedValue(undefined),
    onModuleDestroy: vi.fn(),
    client: {
      orm: {
        public: {
          AuthSession: {
            create: vi.fn(async (data: Record<string, unknown>) => {
              authSession = data;
              return data;
            }),
            where: vi.fn(() => ({
              first: vi.fn(async () => authSession),
              update: vi.fn(async (data: Record<string, unknown>) => {
                if (authSession) Object.assign(authSession, data);
              }),
            })),
          },
        },
      },
    },
  };

  beforeEach(async () => {
    authSession = null;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue({
        databaseUrl: 'postgresql://localhost/test',
        jwtSecret: 'a'.repeat(64),
        port: 3000,
        webOrigin: 'http://localhost:5173',
      })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(UsersService)
      .useValue(users)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it('rejects registration as ADMIN before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User',
        email: 'user@example.com',
        password: 'Coursework-test-123',
        role: 'ADMIN',
      })
      .expect(400);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rejects extra fields and invalid email', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'invalid',
        password: 'Coursework-test-123',
        status: 'ACTIVE',
      })
      .expect(400);
  });

  it('requires a Bearer token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  it('does not bypass the email rate limit with a differently cased URL', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(503);
    }
    await request(app.getHttpServer())
      .post('/AUTH/Forgot-Password/')
      .send({ email: 'user@example.com' })
      .expect(429);
  });

  it('logs in and retrieves the current user through JWT', async () => {
    const user = {
      id: randomUUID(),
      name: 'Client',
      email: 'client@example.com',
      role: 'CLIENT',
      status: 'ACTIVE',
      passwordHash: await hashPassword('Coursework-test-123'),
      twoFactorEnabled: false,
      twoFactorSecret: null,
    };
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'Coursework-test-123' })
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(response.body).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: false,
    });
    users.findById.mockResolvedValue({ ...user, status: 'BLOCKED' });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('rejects the same JWT after logout', async () => {
    const user = {
      id: randomUUID(),
      name: 'Client',
      email: 'client@example.com',
      role: 'CLIENT',
      status: 'ACTIVE',
      passwordHash: await hashPassword('Coursework-test-123'),
      twoFactorEnabled: false,
      twoFactorSecret: null,
    };
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'Coursework-test-123' })
      .expect(200);
    const authorization = `Bearer ${login.body.accessToken}`;
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', authorization)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', authorization)
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', authorization)
      .expect(401);
  });

  it('documents Bearer authorization and registration fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(response.body.components.securitySchemes.bearer.scheme).toBe(
      'bearer',
    );
    expect(
      response.body.components.schemas.RegisterDto.properties.role.enum,
    ).toEqual(['CLIENT', 'FREELANCER']);
    expect(response.body.paths['/auth/me'].get.security).toEqual([
      { bearer: [] },
    ]);
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
  });
});
