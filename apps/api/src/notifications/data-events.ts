import { Subject } from 'rxjs';

// «Дані змінились»: відкриті сторінки (Kanban, проєкти, адмінка) тихо перечитують свої дані.
// Подія несе лише id проєкту (null — зміна поза проєктом, напр. новий користувач чи
// проєкт на біржі). Подію проєкту отримують тільки його учасники, замовник і адмін
// (див. NotificationsController.stream).
// shortcut: події живуть у пам'яті одного процесу API; для кількох інстансів потрібен Redis pub/sub
export const dataEvents = new Subject<string | null>();

const pending = new Map<string, ReturnType<typeof setTimeout>>();

// Кілька змін поспіль в одному проєкті (напр. перенесення кількох карток) зливаються
// в одну подію. Затримка дає транзакції встигнути зберегтись, щоб клієнт уже побачив нові дані.
export function announceDataChange(projectId: string | null = null) {
  const key = projectId ?? '';
  if (pending.has(key)) return;
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      dataEvents.next(projectId);
    }, 300),
  );
}
