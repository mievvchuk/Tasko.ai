import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
  private get client() {
    return this.projects.prisma.client;
  }

  async messages(user: CurrentUser, projectId: string, page: PageDto) {
    await this.projects.requireAccess(user, projectId);
    return this.client.orm.public.Message.where({ projectId })
      .orderBy((message) => message.createdAt.desc())
      .offset((page.page - 1) * page.limit)
      .limit(page.limit)
      .all();
  }
  async message(user: CurrentUser, projectId: string, data: MessageDto) {
    const project = await this.projects.requireAccess(user, projectId);
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
