import { ConflictException, ForbiddenException } from '@nestjs/common';
import { firstValueFrom, take } from 'rxjs';
import { CollaborationService } from '../../../src/collaboration/collaboration.service.js';
import type { ProjectsService } from '../../../src/projects/projects.service.js';
import type { TasksService } from '../../../src/tasks/tasks.service.js';
import type { CurrentUser } from '../../../src/users/users.service.js';

const person = (id: string, role: CurrentUser['role']): CurrentUser => ({
  id,
  name: id,
  email: `${id}@example.com`,
  role,
  sessionId: 's',
  twoFactorEnabled: false,
});

describe('application chat', () => {
  const client = person('client', 'CLIENT');
  const applicant = person('applicant', 'FREELANCER');
  const stranger = person('stranger', 'FREELANCER');
  let application: { id: string; projectId: string; freelancerId: string; status: string };
  let notify: ReturnType<typeof vi.fn>;
  let created: unknown[];
  let service: CollaborationService;

  beforeEach(() => {
    application = {
      id: 'app',
      projectId: 'project',
      freelancerId: applicant.id,
      status: 'PENDING',
    };
    created = [];
    notify = vi.fn();
    const one = (value: () => unknown) => ({
      first: vi.fn(async () => value()),
    });
    const db = {
      ProjectApplication: { where: vi.fn(() => one(() => application)) },
      Project: {
        where: vi.fn(() =>
          one(() => ({ id: 'project', title: 'Сайт', clientId: client.id })),
        ),
      },
      ApplicationMessage: {
        create: vi.fn(async (data: unknown) => {
          created.push(data);
          return data;
        }),
      },
    };
    service = new CollaborationService(
      {
        prisma: { client: { orm: { public: db } } },
        notify,
      } as unknown as ProjectsService,
      {} as TasksService,
    );
  });

  it('lets the client and the applicant write, and notifies the other side', async () => {
    await service.applicationMessage(client, 'app', { content: 'Уточніть строки' });
    await service.applicationMessage(applicant, 'app', { content: '10 днів' });
    expect(created).toHaveLength(2);
    expect(notify.mock.calls.map((call) => call[0])).toEqual([
      applicant.id,
      client.id,
    ]);
  });

  it('keeps other freelancers out', async () => {
    await expect(
      service.applicationMessage(stranger, 'app', { content: 'привіт' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.applicationMessageStream(stranger, 'app'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('closes writing once the application is decided', async () => {
    application.status = 'ACCEPTED';
    await expect(
      service.applicationMessage(client, 'app', { content: 'ще питання' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('pushes a new message only into its own application stream', async () => {
    const stream = await service.applicationMessageStream(applicant, 'app');
    const next = firstValueFrom(stream.pipe(take(1)));
    await service.applicationMessage(client, 'app', { content: 'Є питання' });
    expect(await next).toMatchObject({
      type: 'message',
      data: { applicationId: 'app', content: 'Є питання' },
    });
  });
});
