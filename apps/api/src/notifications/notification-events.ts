import { Subject } from 'rxjs';

// Кому щойно додалось сповіщення: інтерфейс одразу оновлює лічильники, без перезавантаження.
// shortcut: події живуть у пам'яті одного процесу API; для кількох інстансів потрібен Redis pub/sub
export const notificationEvents = new Subject<string>();

// Викликати після створення сповіщення. Коротка затримка дає транзакції навколо встигнути зберегтись,
// щоб клієнт, перечитавши лічильники, уже побачив новий запис.
export function announce(userId: string) {
  setTimeout(() => notificationEvents.next(userId), 300);
}
