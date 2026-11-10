import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Subject, filter, interval, map, merge, type Observable } from 'rxjs';
import { ProjectsService } from '../projects/projects.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import type { CurrentUser } from '../users/users.service.js';
import type { PageDto } from '../projects/projects.dto.js';
import type {
  MessageDto,
  ReviewDto,
  SubmissionDto,
} from './collaboration.dto.js';

@Injectable()
export class CollaborationService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(TasksService) private readonly tasks: TasksService,
  ) {}
  // shortcut: події живуть у пам'яті одного процесу API; для кількох інстансів потрібен Redis pub/sub
  // key: `project:<id>` або `application:<id>`
  private readonly posted = new Subject<{
    key: string;
    message: unknown;
  }>();
  private stream(key: string): Observable<{ type: string; data: unknown }> {
    return merge(
      this.posted.pipe(
        filter((event) => event.key === key),
        map((event) => ({ type: 'message', data: event.message })),
      ),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }
  private get client() {
    return this.projects.prisma.client;
  }
  // Потік нових повідомлень проєкту (SSE). Пінг раз на 25 с не дає проксі закрити з'єднання.
  async messageStream(
    user: CurrentUser,
    projectId: string,
  ): Promise<Observable<{ type: string; data: unknown }>> {
    await this.projects.requireAccess(user, projectId, false);
    return this.stream(`project:${projectId}`);
  }

  async messages(user: CurrentUser, projectId: string, page: PageDto) {
    await this.projects.requireAccess(user, projectId, false);
    return this.client.orm.public.Message.where({ projectId })
      .orderBy((message) => message.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
  }
  async message(user: CurrentUser, projectId: string, data: MessageDto) {
    const project = await this.projects.requireAccess(user, projectId, false);
    this.projects.ensureWritable(project);
    const message = await this.client.orm.public.Message.create({
      id: randomUUID(),
      projectId,
      senderId: user.id,
      content: data.content,
      createdAt: new Date(),
    });
    const members = await this.client.orm.public.ProjectMember.where({
      projectId,
    }).all();
    for (const recipientId of new Set([
      project.clientId,
      ...members.map((member) => member.userId),
    ]))
      await this.projects.notify(
        recipientId,
        user.id,
        'NEW_MESSAGE',
        'Нове повідомлення у проєкті.',
        projectId,
      );
    this.posted.next({ key: `project:${projectId}`, message });
    return message;
  }

  // Чат заявки бачать лише клієнт-власник проєкту та автор заявки (адміністратор — ні)
  private async applicationChat(user: CurrentUser, applicationId: string) {
    const db = this.client.orm.public;
    const application = await db.ProjectApplication.where({
      id: applicationId,
    }).first();
    if (!application) throw new NotFoundException('Заявку не знайдено.');
    const project = await db.Project.where({
      id: application.projectId,
    }).first();
    if (!project) throw new NotFoundException('Проєкт не знайдено.');
    if (user.id !== project.clientId && user.id !== application.freelancerId)
      throw new ForbiddenException('Чат доступний клієнту й автору заявки.');
    return { application, project };
  }

  private async chatSummary(
    application: { id: string; status: string; freelancerId: string },
    project: { id: string; title: string; clientId: string },
  ) {
    const people = await this.client.orm.public.User.where((user) =>
      user.id.in([project.clientId, application.freelancerId]),
    )
      .select('id', 'name')
      .all();
    const name = (id: string) =>
      people.find((person) => person.id === id)?.name ?? null;
    return {
      id: application.id,
      status: application.status,
      projectId: project.id,
      projectTitle: project.title,
      clientId: project.clientId,
      clientName: name(project.clientId),
      freelancerId: application.freelancerId,
      freelancerName: name(application.freelancerId),
    };
  }

  async applicationChatInfo(user: CurrentUser, applicationId: string) {
    const { application, project } = await this.applicationChat(
      user,
      applicationId,
    );
    return this.chatSummary(application, project);
  }

  // Розмови щодо заявок, де вже є хоч одне повідомлення
  async applicationConversations(user: CurrentUser) {
    const db = this.client.orm.public;
    const ownProjectIds =
      user.role === 'CLIENT'
        ? (await db.Project.where({ clientId: user.id }).all()).map(
            (project) => project.id,
          )
        : [];
    const applications =
      user.role === 'FREELANCER'
        ? await db.ProjectApplication.where({ freelancerId: user.id }).all()
        : ownProjectIds.length
          ? await db.ProjectApplication.where((application) =>
              application.projectId.in(ownProjectIds),
            ).all()
          : [];
    const result = [];
    for (const application of applications) {
      const last = await db.ApplicationMessage.where({
        applicationId: application.id,
      })
        .orderBy((message) => message.createdAt.desc())
        .first();
      if (!last) continue;
      const project = await db.Project.where({
        id: application.projectId,
      }).first();
      if (!project) continue;
      result.push({
        ...(await this.chatSummary(application, project)),
        lastMessageAt: last.createdAt,
      });
    }
    return result.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  }

  async applicationMessages(
    user: CurrentUser,
    applicationId: string,
    page: PageDto,
  ) {
    await this.applicationChat(user, applicationId);
    return this.client.orm.public.ApplicationMessage.where({ applicationId })
      .orderBy((message) => message.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
  }

  async applicationMessageStream(user: CurrentUser, applicationId: string) {
    await this.applicationChat(user, applicationId);
    return this.stream(`application:${applicationId}`);
  }

  async applicationMessage(
    user: CurrentUser,
    applicationId: string,
    data: MessageDto,
  ) {
    const { application, project } = await this.applicationChat(
      user,
      applicationId,
    );
    if (application.status !== 'PENDING')
      throw new ConflictException(
        application.status === 'ACCEPTED'
          ? 'Фрілансера вже прийнято — спілкуйтеся в чаті проєкту.'
          : 'Заявку відхилено, переписку закрито.',
      );
    const message = await this.client.orm.public.ApplicationMessage.create({
      id: randomUUID(),
      applicationId,
      senderId: user.id,
      content: data.content,
      createdAt: new Date(),
    });
    await this.projects.notify(
      user.id === project.clientId ? application.freelancerId : project.clientId,
      user.id,
      'APPLICATION_MESSAGE',
      `Нове повідомлення щодо заявки на «${project.title}».`,
      // без projectId: до найму фрілансер не має доступу до сторінки проєкту
    );
    this.posted.next({ key: `application:${applicationId}`, message });
    return message;
  }
  async submissions(user: CurrentUser, taskId: string, page: PageDto) {
    await this.tasks.find(user, taskId);
    const submissions = await this.client.orm.public.WorkSubmission.where({
      taskId,
    })
      .orderBy((submission) => submission.submittedAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
    return Promise.all(
      submissions.map(async (submission) => ({
        ...submission,
        files: await this.client.orm.public.FileAttachment.where({
          submissionId: submission.id,
        })
          .select('id', 'fileName', 'mimeType', 'size')
          .all(),
      })),
    );
  }
  async submit(user: CurrentUser, taskId: string, data: SubmissionDto) {
    const task = await this.tasks.find(user, taskId);
    const project = await this.projects.requireAccess(user, task.projectId);
    if (project.status !== 'ACTIVE')
      throw new ConflictException('Проєкт має бути активним.');
    if (task.assigneeId !== user.id)
      throw new ForbiddenException('Роботу здає призначений виконавець.');
    if (task.status !== 'IN_PROGRESS')
      throw new ConflictException('Здати можна лише завдання у виконанні.');
    return this.client.transaction(async (tx) => {
      const updated = await tx.orm.public.Task.where({
        id: taskId,
        status: 'IN_PROGRESS',
        assigneeId: user.id,
      }).update({ status: 'REVIEW', updatedAt: new Date() });
      if (!updated) throw new ConflictException('Стан завдання вже змінився.');
      const submission = await tx.orm.public.WorkSubmission.create({
        id: randomUUID(),
        taskId,
        submittedBy: user.id,
        description: data.description,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewerId: null,
        feedback: null,
      });
      for (const fileId of data.fileIds ?? []) {
        const file = await tx.orm.public.FileAttachment.where({
          id: fileId,
          projectId: task.projectId,
          uploadedBy: user.id,
          submissionId: null,
        }).first();
        if (!file)
          throw new BadRequestException(
            'Файл недоступний або вже прикріплений до іншої роботи.',
          );
        const attached = await tx.orm.public.FileAttachment.where({
          id: fileId,
          submissionId: null,
        }).update({ submissionId: submission.id });
        if (!attached) throw new ConflictException('Файл уже використано.');
      }
      await tx.orm.public.Notification.create({
        id: randomUUID(),
        userId: project.clientId,
        type: 'WORK_SUBMITTED',
        message: `Передано результат завдання «${task.title}».`,
        projectId: task.projectId,
        taskId,
        readAt: null,
        createdAt: new Date(),
      });
      await tx.orm.public.ActivityLog.create({
        id: randomUUID(),
        actorId: user.id,
        projectId: task.projectId,
        type: 'WORK_SUBMITTED',
        message: `Передано результат завдання «${task.title}».`,
        createdAt: new Date(),
      });
      return submission;
    });
  }
  async review(user: CurrentUser, id: string, data: ReviewDto) {
    const submission = await this.client.orm.public.WorkSubmission.where({
      id,
    }).first();
    if (!submission)
      throw new NotFoundException('Результат роботи не знайдено.');
    const task = await this.tasks.find(user, submission.taskId);
    this.projects.ensureWritable(
      await this.projects.requireOwner(user, task.projectId),
    );
    if (submission.status !== 'SUBMITTED' || task.status !== 'REVIEW')
      throw new ConflictException('Цю роботу вже перевірено.');
    return this.client.transaction(async (tx) => {
      const reviewed = await tx.orm.public.WorkSubmission.where({
        id,
        status: 'SUBMITTED',
      }).update({
        status: data.decision === 'APPROVE' ? 'APPROVED' : 'NEEDS_REVISION',
        feedback: data.feedback,
        reviewerId: user.id,
        reviewedAt: new Date(),
      });
      if (!reviewed) throw new ConflictException('Цю роботу вже перевірено.');
      const updated = await tx.orm.public.Task.where({
        id: task.id,
        status: 'REVIEW',
      }).update({
        status: data.decision === 'APPROVE' ? 'DONE' : 'IN_PROGRESS',
        updatedAt: new Date(),
      });
      if (!updated) throw new ConflictException('Стан завдання вже змінився.');
      await tx.orm.public.Notification.create({
        id: randomUUID(),
        userId: submission.submittedBy,
        type: 'WORK_REVIEWED',
        message:
          data.decision === 'APPROVE'
            ? 'Результат роботи прийнято.'
            : 'Роботу повернуто на доопрацювання.',
        projectId: task.projectId,
        taskId: task.id,
        readAt: null,
        createdAt: new Date(),
      });
      await tx.orm.public.ActivityLog.create({
        id: randomUUID(),
        actorId: user.id,
        projectId: task.projectId,
        type: 'WORK_REVIEWED',
        message:
          data.decision === 'APPROVE'
            ? 'Результат роботи прийнято.'
            : 'Роботу повернуто на доопрацювання.',
        createdAt: new Date(),
      });
      return reviewed;
    });
  }
}
