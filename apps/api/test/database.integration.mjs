import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import { AppModule } from '../dist/app.module.js';
import { APP_CONFIG } from '../dist/config/config.module.js';
import { loadConfig } from '../dist/config/config.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { FilesService } from '../dist/collaboration/files.service.js';
import { hashPassword } from '../dist/auth/password.js';
import { setupApp } from '../dist/setup.js';
import { ApiExceptionFilter } from '../dist/common/api-exception.filter.js';
import { HttpException } from '@nestjs/common';
import { MailService } from '../dist/auth/mail.service.js';

const require = createRequire(
  import.meta.resolve('@prisma/orm-postgres/runtime'),
);
const { Client } = require('pg');
const configuration = loadConfig();
const liveAi = process.argv.includes('--live-ai');
if (liveAi && (!configuration.aiApiKey || !configuration.aiModel)) {
  throw new Error('Live AI check requires AI_API_KEY and OPENAI_MODEL.');
}
const rawClient = new Client({
  connectionString: configuration.databaseUrl,
  connectionTimeoutMillis: 5000,
});
const db = postgres({ pg: rawClient, contractJson });
const rollback = new Error('INTEGRATION_TEST_ROLLBACK');
const runId = randomUUID();
const storage = fileURLToPath(
  new URL(`../storage/integration-files-${runId}/`, import.meta.url),
);
let app;
let checks = 0;
let createdProjectId;
let storageCreated = false;
let smtpTesting = false;
const verificationEmails = [];

try {
  await rawClient.connect();
  await mkdir(storage, { recursive: true });
  storageCreated = true;
  try {
    await db.transaction(async (tx) => {
      let savepointNumber = 0;
      const prisma = {
        client: {
          orm: tx.orm,
          transaction: async (operation) => {
            const savepoint = `integration_${++savepointNumber}`;
            await rawClient.query(`SAVEPOINT ${savepoint}`);
            try {
              const result = await operation(tx);
              await rawClient.query(`RELEASE SAVEPOINT ${savepoint}`);
              return result;
            } catch (error) {
              await rawClient.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
              await rawClient.query(`RELEASE SAVEPOINT ${savepoint}`);
              throw error;
            }
          },
        },
        checkConnection: async () => {
          await tx.orm.public.User.select('id').limit(1).all();
        },
        onModuleDestroy: async () => {},
      };
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(APP_CONFIG)
        .useValue({
          ...configuration,
          emailVerificationRequired: false,
          jwtSecret: 'integration-only-secret-'.repeat(3),
          ...(liveAi
            ? {}
            : {
                aiApiKey: 'test-only-key',
                aiModel: 'test-only-model',
                aiBaseUrl: 'https://provider.example/v1',
              }),
        })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .overrideProvider(MailService)
        .useValue({
          configured: () => smtpTesting,
          sendVerification: async (email, token) => {
            verificationEmails.push({ email, token });
          },
          sendReset: async () => {},
        })
        .compile();
      app = module.createNestApplication({ logger: false });
      Object.defineProperty(app.get(FilesService), 'directory', {
        value: storage,
      });
      setupApp(app);
      const fallback = new ApiExceptionFilter();
      app.useGlobalFilters({
        catch(error, host) {
          if (!(error instanceof HttpException)) {
            const message = String(error.message)
              .replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted]')
              .replace(/scrypt:[a-f0-9:]+/g, '[redacted]');
            console.error(
              'Integration error:',
              error.code ?? error.name,
              message,
            );
          }
          fallback.catch(error, host);
        },
      });
      await app.init();
      const api = request(app.getHttpServer());
      const call = async (method, path, status, token, data) => {
        const requestSavepoint = `request_${checks + 1}`;
        await rawClient.query(`SAVEPOINT ${requestSavepoint}`);
        const query = api[method](path);
        if (token) query.set('Authorization', `Bearer ${token}`);
        if (data !== undefined) query.send(data);
        const response = await query;
        if (response.status >= 400)
          await rawClient.query(`ROLLBACK TO SAVEPOINT ${requestSavepoint}`);
        await rawClient.query(`RELEASE SAVEPOINT ${requestSavepoint}`);
        assert.equal(
          response.status,
          status,
          `${method.toUpperCase()} ${path}: ${JSON.stringify(response.body)}`,
        );
        checks++;
        return response.body;
      };
      const password = 'Integration-test-2026';
      const account = async (name, role) => {
        const email = `${name.replaceAll(' ', '-')}-${runId}@example.com`;
        const user = await call('post', '/auth/register', 201, null, {
          name,
          role,
          email,
          password,
        });
        assert.equal(user.passwordHash, undefined);
        const login = await call('post', '/auth/login', 200, null, {
          email,
          password,
        });
        await call('get', '/auth/me', 200, login.accessToken);
        return { ...user, token: login.accessToken };
      };
      await call('get', '/health', 200);
      await call('get', '/projects', 401);
      await call('post', '/auth/register', 400, null, {
        name: 'Bad admin',
        role: 'ADMIN',
        email: `bad-${runId}@example.com`,
        password,
      });
      const client = await account('Test client', 'CLIENT');
      const freelancer = await account('Test freelancer', 'FREELANCER');
      const outsider = await account('Test outsider', 'CLIENT');
      const outsiderSecondLogin = await call('post', '/auth/login', 200, null, {
        email: outsider.email,
        password,
      });
      const outsiderSessions = await call(
        'get',
        '/auth/sessions',
        200,
        outsiderSecondLogin.accessToken,
      );
      assert.equal(outsiderSessions.length, 2);
      const outsiderOldSession = outsiderSessions.find(
        (session) => !session.current,
      );
      assert.ok(outsiderOldSession);
      await call(
        'delete',
        `/auth/sessions/${outsiderOldSession.id}`,
        200,
        outsiderSecondLogin.accessToken,
      );
      await call('get', '/auth/me', 401, outsider.token);
      outsider.token = outsiderSecondLogin.accessToken;
      await call('post', '/auth/register', 409, null, {
        name: client.name,
        role: 'CLIENT',
        email: client.email,
        password,
      });
      await call('post', '/auth/login', 401, null, {
        email: client.email,
        password: 'wrong-password',
      });
      const now = new Date();
      const admin = await tx.orm.public.User.create({
        id: randomUUID(),
        name: 'Test admin',
        email: `admin-${runId}@example.com`,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
      const adminLogin = await call('post', '/auth/login', 200, null, {
        email: admin.email,
        password,
      });
      // Reference data belongs to this rollback-only test, not the demo seed.
      if (!(await tx.orm.public.Skill.all()).length)
        await tx.orm.public.Skill.create({
          id: randomUUID(),
          name: 'typescript',
        });
      if (!(await tx.orm.public.ProjectCategory.all()).length)
        await tx.orm.public.ProjectCategory.create({
          id: randomUUID(),
          name: 'Integration category',
        });
      const skills = await call('get', '/skills', 200, freelancer.token);
      const categories = await call(
        'get',
        '/project-categories',
        200,
        client.token,
      );
      assert.ok(skills.length > 0 && categories.length > 0);
      await call('patch', '/profile/freelancer', 200, freelancer.token, {
        bio: 'Інтеграційний профіль фрилансера',
        hourlyRate: 700,
        availability: 'AVAILABLE',
        skills: ['TypeScript', 'NestJS'],
      });
      const portfolio = await call(
        'post',
        '/profile/portfolio',
        201,
        freelancer.token,
        {
          title: 'Інтеграційна робота',
          url: 'https://example.com/integration-work',
        },
      );
      assert.equal(typeof portfolio.id, 'string');
      assert.equal(
        (await call('get', '/profile/freelancer', 200, freelancer.token))
          .portfolio.length,
        1,
      );
      for (const format of ['json', 'csv', 'xlsx', 'pdf']) {
        const exported = await api
          .get(`/admin/report/export?format=${format}`)
          .set('Authorization', `Bearer ${adminLogin.accessToken}`);
        assert.equal(
          exported.status,
          200,
          `Report ${format}: ${JSON.stringify(exported.body)}`,
        );
        assert.match(exported.headers['content-disposition'], /attachment/);
        checks++;
      }
      const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
      await call('post', '/projects', 400, client.token, {
        title: 'Past project deadline',
        deadline: new Date(Date.now() - 86400000).toISOString(),
      });
      await call('post', '/projects', 400, client.token, {
        title: 'Current project deadline',
        deadline: new Date().toISOString(),
      });
      await call('post', '/projects', 403, freelancer.token, {
        title: 'Unauthorized',
      });
      const project = await call('post', '/projects', 201, client.token, {
        title: 'Integration test project',
        description: 'Temporary test data',
        deadline,
      });
      createdProjectId = project.id;
      await call('patch', `/projects/${project.id}`, 200, client.token, {
        budgetMin: 10000,
        budgetMax: 20000,
        categoryId: categories[0].id,
        skillIds: [skills[0].id],
      });
      await call(
        'post',
        `/projects/${project.id}/favorite`,
        201,
        freelancer.token,
      );
      assert.equal(
        (
          await call(
            'get',
            '/marketplace/projects?favoritesOnly=true',
            200,
            freelancer.token,
          )
        )[0].isFavorite,
        true,
      );
      await call(
        'delete',
        `/projects/${project.id}/favorite`,
        200,
        freelancer.token,
      );
      await call('patch', `/projects/${project.id}`, 400, client.token, {
        deadline: new Date(Date.now() - 86400000).toISOString(),
      });
      const unchangedProject = await call(
        'get',
        `/projects/${project.id}`,
        200,
        client.token,
      );
      assert.equal(unchangedProject.deadline, deadline);
      await call('get', `/projects/${project.id}`, 403, outsider.token);
      await call('post', `/projects/${project.id}/members`, 201, client.token, {
        userId: freelancer.id,
      });
      await call('post', `/projects/${project.id}/members`, 409, client.token, {
        userId: freelancer.id,
      });
      const visible = await call('get', '/projects', 200, freelancer.token);
      assert.equal(visible.length, 1);
      await call('patch', `/projects/${project.id}`, 200, client.token, {
        status: 'ACTIVE',
      });
      const milestone = await call(
        'post',
        `/projects/${project.id}/milestones`,
        201,
        client.token,
        {
          title: 'Інтеграційний етап',
          position: 1,
          amount: 5000,
        },
      );
      await call(
        'patch',
        `/milestones/${milestone.id}`,
        200,
        freelancer.token,
        { status: 'IN_PROGRESS' },
      );
      await call(
        'patch',
        `/milestones/${milestone.id}`,
        200,
        freelancer.token,
        { status: 'REVIEW' },
      );
      await call('patch', `/milestones/${milestone.id}`, 200, client.token, {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      });
      await call('get', `/projects/${project.id}/activity`, 200, client.token);
      const notifications = await call(
        'get',
        '/notifications',
        200,
        freelancer.token,
      );
      assert.ok(notifications.unreadCount > 0);
      await call('post', '/notifications/read-all', 200, freelancer.token);
      const teammate = await account('Test teammate', 'FREELANCER');
      await call(
        'post',
        `/projects/${project.id}/members`,
        403,
        freelancer.token,
        {
          userId: teammate.id,
        },
      );
      await call(
        'post',
        `/projects/${project.id}/members`,
        403,
        outsider.token,
        {
          userId: teammate.id,
        },
      );
      await call('post', `/projects/${project.id}/members`, 201, client.token, {
        userId: teammate.id,
      });
      const team = await call(
        'get',
        `/projects/${project.id}/members`,
        200,
        client.token,
      );
      assert.equal(team.length, 2);
      await call('get', `/projects/${project.id}`, 200, teammate.token);
      await call('patch', `/projects/${project.id}`, 400, client.token, {
        status: null,
      });
      await call('get', '/projects?limit=51', 400, client.token);
      await call(
        'post',
        `/projects/${project.id}/tasks`,
        403,
        freelancer.token,
        { title: 'Unauthorized' },
      );
      await call('post', `/projects/${project.id}/tasks`, 400, client.token, {
        title: 'Invalid assignee',
        assigneeId: outsider.id,
      });
      const task = await call(
        'post',
        `/projects/${project.id}/tasks`,
        201,
        client.token,
        {
          title: 'Prepare result 100%_test',
          assigneeId: freelancer.id,
          priority: 'HIGH',
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      );
      const filteredTasks = await call(
        'get',
        `/projects/${project.id}/tasks?search=PREPARE&assigneeId=${freelancer.id}&status=TODO&priority=HIGH`,
        200,
        client.token,
      );
      assert.deepEqual(
        filteredTasks.map((item) => item.id),
        [task.id],
      );
      assert.deepEqual(
        await call(
          'get',
          `/projects/${project.id}/tasks?search=missing`,
          200,
          client.token,
        ),
        [],
      );
      assert.deepEqual(
        await call(
          'get',
          `/projects/${project.id}/tasks?assigneeId=${outsider.id}`,
          200,
          client.token,
        ),
        [],
      );
      await call(
        'get',
        `/projects/${project.id}/tasks?assigneeId=invalid`,
        400,
        client.token,
      );
      await call(
        'get',
        `/projects/${project.id}/tasks?search=Prepare`,
        403,
        outsider.token,
      );
      const workload = await call(
        'get',
        '/analytics/workload',
        200,
        client.token,
      );
      const assignedWork = workload.find(
        (item) => item.user.id === freelancer.id,
      );
      assert.equal(assignedWork.activeTasks, 1);
      assert.equal(assignedWork.nearestDeadline, task.deadline);
      assert.equal(assignedWork.tasks[0].id, task.id);
      for (const search of ['100%_test', '%', '_', "' OR 1=1 --"]) {
        const found = await call(
          'get',
          `/projects/${project.id}/tasks?search=${encodeURIComponent(search)}`,
          200,
          client.token,
        );
        assert.equal(found.length, search.startsWith("'") ? 0 : 1);
      }
      assert.deepEqual(
        await call('get', '/analytics/workload', 200, outsider.token),
        [],
      );
      await call('patch', `/tasks/${task.id}`, 200, client.token, {
        deadline: new Date(Date.now() - 86400000).toISOString(),
      });
      const overdueTasks = await call(
        'get',
        `/projects/${project.id}/tasks?overdue=true`,
        200,
        client.token,
      );
      assert.deepEqual(
        overdueTasks.map((item) => item.id),
        [task.id],
      );
      await call('patch', `/tasks/${task.id}`, 200, client.token, {
        deadline: task.deadline,
      });
      await call('patch', `/tasks/${task.id}`, 400, client.token, {
        priority: null,
      });
      await call('patch', `/projects/${project.id}`, 400, client.token, {
        deadline: new Date().toISOString(),
      });
      await call('patch', `/tasks/${task.id}/status`, 403, client.token, {
        status: 'IN_PROGRESS',
      });
      await call('patch', `/tasks/${task.id}/status`, 200, freelancer.token, {
        status: 'IN_PROGRESS',
      });
      await call('get', '/projects?status=INVALID', 400, client.token);
      const activeProjects = await call(
        'get',
        '/projects?status=ACTIVE',
        200,
        freelancer.token,
      );
      assert.equal(activeProjects.length, 1);
      assert.equal(activeProjects[0].totalTasks, 1);
      assert.equal(activeProjects[0].completedTasks, 0);
      assert.equal(activeProjects[0].progress, 0);
      assert.deepEqual(
        await call('get', '/projects?status=PLANNING', 200, client.token),
        [],
      );
      assert.deepEqual(
        await call('get', '/projects?status=ACTIVE', 200, outsider.token),
        [],
      );
      const dashboardBefore = await call(
        'get',
        '/analytics/dashboard',
        200,
        freelancer.token,
      );
      assert.equal(dashboardBefore.activeProjects, 1);
      assert.equal(dashboardBefore.tasks, 1);
      assert.equal(dashboardBefore.tasksByStatus.IN_PROGRESS, 1);
      assert.equal(dashboardBefore.nearestDeadline, task.deadline);
      await call('patch', `/projects/${project.id}`, 409, client.token, {
        status: 'COMPLETED',
      });
      await call(
        'post',
        `/projects/${project.id}/messages`,
        201,
        freelancer.token,
        { content: 'Ready for review' },
      );
      await call(
        'get',
        `/projects/${project.id}/messages`,
        403,
        outsider.token,
      );
      const upload = await api
        .post(`/projects/${project.id}/files`)
        .set('Authorization', `Bearer ${freelancer.token}`)
        .attach('file', Buffer.from('Temporary test result'), 'результат.txt');
      assert.equal(upload.status, 201, JSON.stringify(upload.body));
      assert.equal(upload.body.fileName, 'результат.txt');
      checks++;
      await call('get', `/files/${upload.body.id}/download`, 200, client.token);
      await call(
        'get',
        `/files/${upload.body.id}/download`,
        403,
        outsider.token,
      );
      await call(
        'post',
        `/tasks/${task.id}/submissions`,
        400,
        freelancer.token,
        { description: 'Missing file', fileIds: [randomUUID()] },
      );
      assert.equal(
        (await call('get', `/tasks/${task.id}`, 200, client.token)).status,
        'IN_PROGRESS',
      );
      const submission = await call(
        'post',
        `/tasks/${task.id}/submissions`,
        201,
        freelancer.token,
        { description: 'First result', fileIds: [upload.body.id] },
      );
      const submissions = await call(
        'get',
        `/tasks/${task.id}/submissions`,
        200,
        client.token,
      );
      assert.equal(submissions[0].files[0].id, upload.body.id);
      await call(
        'post',
        `/submissions/${submission.id}/review`,
        403,
        freelancer.token,
        { decision: 'APPROVE', feedback: 'Self review' },
      );
      await call(
        'post',
        `/submissions/${submission.id}/review`,
        201,
        client.token,
        { decision: 'NEEDS_REVISION', feedback: 'Please improve' },
      );
      const revision = await call(
        'post',
        `/tasks/${task.id}/submissions`,
        201,
        freelancer.token,
        { description: 'Revised result' },
      );
      await call(
        'post',
        `/submissions/${revision.id}/review`,
        201,
        client.token,
        { decision: 'APPROVE', feedback: 'Accepted' },
      );
      await call(
        'post',
        `/submissions/${revision.id}/review`,
        409,
        client.token,
        { decision: 'APPROVE', feedback: 'Repeat' },
      );
      const order = await call(
        'post',
        `/projects/${project.id}/orders`,
        201,
        client.token,
      );
      await call('patch', `/orders/${order.id}`, 200, client.token, {
        status: 'IN_PROGRESS',
      });
      await call('patch', `/orders/${order.id}`, 200, client.token, {
        status: 'COMPLETED',
      });
      assert.equal(
        (
          await call(
            'get',
            `/projects/${project.id}/summary`,
            200,
            client.token,
          )
        ).project.progress,
        100,
      );
      const dashboardAfter = await call(
        'get',
        '/analytics/dashboard',
        200,
        client.token,
      );
      assert.equal(dashboardAfter.completedTasks, 1);
      assert.equal(dashboardAfter.nearestDeadline, null);
      const completedList = await call(
        'get',
        '/projects?status=ACTIVE',
        200,
        client.token,
      );
      assert.equal(completedList[0].completedTasks, 1);
      assert.equal(completedList[0].progress, 100);
      await call('get', '/analytics/deadlines', 200, client.token);
      await call('get', '/analytics/workload', 200, client.token);
      if (liveAi) {
        const status = await call(
          'get',
          '/agent/status',
          200,
          freelancer.token,
        );
        assert.equal(status.configured, true);
        const answer = await call(
          'post',
          '/agent/chat',
          200,
          freelancer.token,
          {
            message: `Виклич get_project_summary з projectId ${project.id} та коротко українською повідом назву проєкту й відсоток виконання.`,
          },
        );
        assert.equal(typeof answer.answer, 'string');
        assert.ok(answer.answer.trim().length > 0);
        assert.ok(
          answer.answer.includes('100'),
          'AI should report the actual completed progress.',
        );
        assert.ok(
          answer.toolsUsed.includes('get_project_summary'),
          'AI should call MCP for project facts.',
        );
        console.log(
          'Live AI passed: API -> provider -> MCP -> PostgreSQL -> answer.',
        );
      }
      await call('get', '/admin/users', 403, client.token);
      const complaint = await call(
        'post',
        '/complaints',
        201,
        freelancer.token,
        {
          projectId: project.id,
          reason: 'Потрібна допомога',
          description:
            'Інтеграційна скарга для перевірки адміністративного процесу.',
        },
      );
      assert.equal(
        (await call('get', '/complaints', 200, freelancer.token)).length,
        1,
      );
      await call('get', '/admin/complaints', 403, client.token);
      await call(
        'patch',
        `/admin/complaints/${complaint.id}`,
        200,
        adminLogin.accessToken,
        {
          status: 'RESOLVED',
          adminNote: 'Скаргу перевірено в інтеграційному тесті.',
        },
      );
      await call('get', '/admin/report', 200, adminLogin.accessToken);
      await call(
        'patch',
        `/admin/users/${freelancer.id}`,
        400,
        adminLogin.accessToken,
        { role: null },
      );
      await call(
        'patch',
        `/admin/users/${String(admin.id)}`,
        409,
        adminLogin.accessToken,
        { status: 'BLOCKED' },
      );
      const mcpResponse = await api
        .post('/mcp')
        .set('Authorization', `Bearer ${freelancer.token}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      assert.equal(mcpResponse.status, 200, JSON.stringify(mcpResponse.body));
      assert.equal(mcpResponse.body.result.tools.length, 5);
      checks++;
      const otherProject = await call(
        'post',
        '/projects',
        201,
        outsider.token,
        { title: 'Private outsider project' },
      );
      const denied = await api
        .post('/mcp')
        .set('Authorization', `Bearer ${freelancer.token}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'get_project_summary',
            arguments: { projectId: otherProject.id },
          },
        });
      assert.equal(denied.body.result.isError, true);
      checks++;
      await call(
        'patch',
        `/admin/users/${freelancer.id}`,
        200,
        adminLogin.accessToken,
        { status: 'BLOCKED' },
      );
      await call('get', '/auth/me', 403, freelancer.token);
      await call('patch', `/projects/${project.id}`, 200, client.token, {
        status: 'COMPLETED',
      });
      await call('patch', `/projects/${project.id}`, 409, client.token, {
        title: 'Changed after completion',
      });
      const completedProject = await call(
        'get',
        `/projects/${project.id}`,
        200,
        client.token,
      );
      assert.equal(completedProject.title, project.title);
      await call(
        'post',
        `/projects/${project.id}/messages`,
        409,
        client.token,
        { content: 'Closed project' },
      );
      const swagger = await call('get', '/docs-json', 200);
      assert.ok(swagger.paths['/agent/chat']);
      assert.ok(swagger.paths['/projects/{id}/files']);
      await call('post', '/projects', 201, client.token, {
        title: 'Second owned project',
      });
      const firstPage = await call(
        'get',
        '/projects?page=1&limit=1',
        200,
        client.token,
      );
      const secondPage = await call(
        'get',
        '/projects?page=2&limit=1',
        200,
        client.token,
      );
      assert.equal(firstPage.length, 1);
      assert.equal(secondPage.length, 1);
      assert.notEqual(firstPage[0].id, secondPage[0].id);
      assert.equal(secondPage[0].id, project.id);
      assert.deepEqual(
        await call('get', '/projects?page=3&limit=1', 200, client.token),
        [],
      );
      assert.equal(
        (await call('get', '/projects?status=COMPLETED', 200, client.token))
          .length,
        1,
      );
      // AI planning uses fixed test output here and never calls a live provider.
      const planningProject = await call(
        'post',
        '/projects',
        201,
        client.token,
        {
          title: 'AI planning integration',
          description: 'Build a portfolio website',
        },
      );
      const planningDraft = {
        milestones: [
          {
            title: 'Підготовка',
            description: 'Погодження вимог',
            acceptanceCriteria: ['Вимоги погоджено'],
            tasks: [
              {
                title: 'Уточнити вимоги',
                description: 'Підготувати перелік сторінок',
                priority: 'HIGH',
                acceptanceCriteria: ['Перелік погоджено'],
              },
            ],
          },
        ],
      };
      const planningRequest = { requestId: randomUUID(), plan: planningDraft };
      const planningPath = `/projects/${planningProject.id}/ai-plan`;
      await call('post', planningPath, 401, null, {});
      await call('post', planningPath, 403, freelancer.token, {});
      await call(
        'post',
        `${planningPath}/apply`,
        403,
        freelancer.token,
        planningRequest,
      );
      await call('post', `${planningPath}/apply`, 400, client.token, {
        ...planningRequest,
        plan: { milestones: [] },
      });
      await call('post', `${planningPath}/apply`, 400, client.token, {
        ...planningRequest,
        requestId: 'invalid-id',
      });
      const appliedPlan = await call(
        'post',
        `${planningPath}/apply`,
        200,
        client.token,
        planningRequest,
      );
      assert.equal(appliedPlan.alreadyApplied, false);
      const repeatedPlan = await call(
        'post',
        `${planningPath}/apply`,
        200,
        client.token,
        planningRequest,
      );
      assert.equal(repeatedPlan.alreadyApplied, true);
      const plannedTasks = await call(
        'get',
        `/projects/${planningProject.id}/tasks`,
        200,
        client.token,
      );
      const plannedMilestones = await call(
        'get',
        `/projects/${planningProject.id}/milestones`,
        200,
        client.token,
      );
      assert.equal(plannedTasks.length, 1);
      assert.equal(plannedMilestones.length, 1);
      assert.equal(plannedTasks[0].assigneeId, null);
      assert.equal(plannedMilestones[0].amount, 0);
      assert.match(plannedTasks[0].description, /Перелік погоджено/);
      await call('post', `${planningPath}/apply`, 200, client.token, {
        ...planningRequest,
        requestId: randomUUID(),
      });
      const appendedMilestones = await call(
        'get',
        `/projects/${planningProject.id}/milestones`,
        200,
        client.token,
      );
      assert.deepEqual(
        appendedMilestones.map((item) => item.position),
        [1, 2],
      );
      await call(
        'patch',
        `/projects/${planningProject.id}`,
        200,
        client.token,
        { status: 'CANCELLED' },
      );
      await call('post', `${planningPath}/apply`, 409, client.token, {
        ...planningRequest,
        requestId: randomUUID(),
      });
      await call('post', planningPath, 409, client.token, {});

      // Exercise verification against real PostgreSQL with a local mail capture.
      smtpTesting = true;
      app.get(APP_CONFIG).emailVerificationRequired = true;
      const verificationEmail = `verify-${runId}@example.com`;
      const pendingUser = await call('post', '/auth/register', 201, null, {
        name: 'Pending client',
        email: verificationEmail,
        password,
        role: 'CLIENT',
      });
      assert.equal(pendingUser.requiresEmailVerification, true);
      assert.equal(verificationEmails.length, 1);
      await call('post', '/auth/login', 403, null, {
        email: verificationEmail,
        password,
      });
      await call('post', '/auth/resend-verification', 200, null, {
        email: verificationEmail,
      });
      assert.equal(
        verificationEmails.length,
        1,
        'Cooldown prevents a second email',
      );
      const token = verificationEmails[0].token;
      const storedTokens = await tx.orm.public.EmailVerificationToken.where({
        userId: pendingUser.id,
      }).all();
      assert.notEqual(storedTokens[0].tokenHash, token);
      await call('post', '/auth/verify-email', 400, null, { token: 'bad' });
      await call('post', '/auth/verify-email', 200, null, { token });
      await call('post', '/auth/verify-email', 400, null, { token });
      await call('post', '/auth/login', 200, null, {
        email: verificationEmail,
        password,
      });
      assert.ok(
        (await tx.orm.public.User.where({ id: pendingUser.id }).first())
          .emailVerifiedAt,
      );
      const missingResponse = await call(
        'post',
        '/auth/resend-verification',
        200,
        null,
        { email: 'missing@example.com' },
      );
      const verifiedResponse = await call(
        'post',
        '/auth/resend-verification',
        200,
        null,
        { email: verificationEmail },
      );
      assert.deepEqual(missingResponse, verifiedResponse);

      await call('post', '/auth/logout', 200, client.token);
      await call('get', '/auth/me', 401, client.token);
      await call('get', '/projects', 401, client.token);
      await call('post', '/auth/logout', 401, client.token);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(
    await db.orm.public.Project.where({ id: createdProjectId }).first(),
    null,
  );
  console.log(
    `Database integration passed: ${checks} HTTP checks. All test database writes rolled back.`,
  );
} finally {
  if (app) await app.close();
  await db.close();
  await rawClient.end();
  if (storageCreated) {
    for (const name of await readdir(storage)) {
      assert.match(name, /^[a-f0-9-]{36}\.[a-z]+$/);
      await unlink(join(storage, name));
    }
    await rmdir(storage);
  }
}
