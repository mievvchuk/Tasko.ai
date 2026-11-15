// Життєвий цикл завдання на Kanban-дошці: хто й куди може пересунути картку.
// Ці самі правила повторює фронт (apps/web/src/kanban.ts → moveRule), щоб
// підсвічувати дозволені колонки; остаточно вирішує сервер.

export const taskStatuses = [
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'REVISION',
  'DONE',
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

// Хто рухає картку відносно цього завдання
export interface MoveActor {
  isOwner: boolean; // власник проєкту (замовник)
  isAssignee: boolean; // призначений виконавець
  isMember: boolean; // фрілансер-учасник проєкту
}

export type MoveRule =
  | { allowed: true; needs?: 'comment' | 'reason'; takes?: boolean }
  | { allowed: false; reason: string };

const deny = (reason: string): MoveRule => ({ allowed: false, reason });

export function moveRule(
  task: { status: string; assigneeId: string | null },
  to: TaskStatus,
  actor: MoveActor,
): MoveRule {
  const from = task.status as TaskStatus;
  const unassigned = !task.assigneeId;
  // Замовник веде завдання без виконавця сам — тоді він і є «виконавець»
  const worker = actor.isAssignee || (actor.isOwner && unassigned);
  const working = (status: string) =>
    status === 'TODO' || status === 'IN_PROGRESS';

  // Між колонками «До виконання» / «У процесі» (зокрема власними) — виконавець або замовник
  if (working(from) && working(to)) {
    if (worker || actor.isOwner) return { allowed: true };
    // Вільне завдання фрілансер-учасник бере собі, перетягнувши в роботу
    if (from === 'TODO' && to === 'IN_PROGRESS' && unassigned && actor.isMember)
      return { allowed: true, takes: true };
    return deny('Пересувати картку може її виконавець або замовник.');
  }
  if (from === 'IN_PROGRESS' && to === 'REVIEW') {
    if (actor.isAssignee) return { allowed: true, needs: 'comment' };
    return deny('На перевірку роботу передає призначений виконавець.');
  }
  if (from === 'IN_PROGRESS' && to === 'DONE') {
    if (actor.isOwner && unassigned) return { allowed: true };
    return deny(
      'Завершити завдання можна лише після перевірки: передайте його на перевірку.',
    );
  }
  if (from === 'REVIEW' && to === 'DONE') {
    if (actor.isOwner) return { allowed: true };
    return deny('Роботу приймає замовник.');
  }
  if ((from === 'REVIEW' || from === 'DONE') && to === 'REVISION') {
    if (actor.isOwner) return { allowed: true, needs: 'reason' };
    return deny('На доопрацювання повертає замовник.');
  }
  if (from === 'REVISION' && to === 'IN_PROGRESS') {
    if (worker) return { allowed: true };
    return deny('Продовжити роботу може призначений виконавець.');
  }
  if (from === to) return deny('Картка вже в цьому етапі.');
  return deny('Такий перехід не передбачено процесом.');
}
