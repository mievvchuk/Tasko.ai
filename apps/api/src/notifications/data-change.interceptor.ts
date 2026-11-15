import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { from, switchMap, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { announceDataChange } from './data-events.js';

const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Вхід, вихід, 2FA і прочитання сповіщень нічого не змінюють на сторінках інших людей.
// Реєстрація (зокрема через Google) додає користувача, тож її адмінка має побачити.
const quiet = /^\/(notifications|auth\/(?!register|google))/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Request = {
  method: string;
  path?: string;
  url: string;
  params?: Record<string, string>;
};

// Після кожної успішної зміни даних повідомляє відкриті сторінки, що варто оновитись.
// Проєкт визначаємо ДО виконання запиту: після видалення колонки її вже не знайти.
@Injectable()
export class DataChangeInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? request.url.split('?')[0];
    if (!mutating.has(request.method) || quiet.test(path)) return next.handle();
    return from(this.projectOf(path, request.params?.id)).pipe(
      switchMap((projectId) =>
        next
          .handle()
          .pipe(tap({ complete: () => announceDataChange(projectId) })),
      ),
    );
  }

  // До якого проєкту належить змінюваний запис; null — зміна поза проєктом
  async projectOf(path: string, id?: string): Promise<string | null> {
    const [, kind] = path.split('/');
    if (!id || !uuid.test(id)) return null;
    const db = this.prisma.client.orm.public;
    try {
      switch (kind) {
        case 'projects':
          return id;
        case 'tasks':
          return (await db.Task.where({ id }).first())?.projectId ?? null;
        case 'columns':
          return (
            (await db.BoardColumn.where({ id }).first())?.projectId ?? null
          );
        case 'milestones':
          return (
            (await db.ProjectMilestone.where({ id }).first())?.projectId ?? null
          );
        case 'applications':
          return (
            (await db.ProjectApplication.where({ id }).first())?.projectId ??
            null
          );
        case 'submissions': {
          const submission = await db.WorkSubmission.where({ id }).first();
          if (!submission) return null;
          return (
            (await db.Task.where({ id: submission.taskId }).first())
              ?.projectId ?? null
          );
        }
        default:
          return null;
      }
    } catch {
      // Не змогли визначити проєкт — краще оновити всіх, ніж нікого
      return null;
    }
  }
}
