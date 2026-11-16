import type { BoardColumn, Task, TaskStatus } from "./types";

// Колонка дошки: статус завдань у ній і, для власних колонок, id колонки.
// Власні колонки — етапи «До виконання» (напр. Беклог) або «У процесі» (напр. Тестування).
export interface Lane {
  key: string;
  status: TaskStatus;
  columnId: string | null;
  title?: string; // назва власної колонки; у стандартних береться зі статусу
}

const lane = (status: TaskStatus): Lane => ({
  key: status,
  status,
  columnId: null,
});

// Місце колонки на дошці (так само рахує сервер, tasks.service.ts → columnKey):
// стандартні «До виконання» й «У процесі» стоять на 1000 і 2000, власні — між ними за позицією.
export function columnKey(column: Pick<BoardColumn, "status" | "position">) {
  return column.status === "IN_PROGRESS" && column.position < 2000 ? 2000 + column.position : column.position;
}

// Колонки до «На перевірці» сортуються за місцем; «На перевірці», «На доопрацюванні» й «Завершено» — завжди в кінці
export function boardLanes(columns: BoardColumn[]): Lane[] {
  const placed = [
    ...columns.map((column) => ({
      at: columnKey(column),
      lane: {
        key: column.id,
        status: (column.status ?? "IN_PROGRESS") as TaskStatus,
        columnId: column.id,
        title: column.title,
      },
    })),
    { at: 1000, lane: lane("TODO") },
    { at: 2000, lane: lane("IN_PROGRESS") },
  ].sort((a, b) => a.at - b.at);
  return [...placed.map((item) => item.lane), lane("REVIEW"), lane("REVISION"), lane("DONE")];
}

// Порядок для сервера: id власних колонок і 'TODO', 'IN_PROGRESS' — без «На перевірці» і «Завершено»
export function laneOrder(lanes: Lane[]) {
  return lanes.filter((item) => item.status === "TODO" || item.status === "IN_PROGRESS").map((item) => item.columnId ?? item.status);
}

// Етап колонки за її місцем: усе до стандартної «У процесі» — «До виконання»
export function stageAt(order: string[], index: number): "TODO" | "IN_PROGRESS" {
  return index <= order.indexOf("IN_PROGRESS") ? "TODO" : "IN_PROGRESS";
}

export function tasksInLane(tasks: Task[], { status, columnId }: Lane) {
  return tasks.filter(
    (task) =>
      task.status === status &&
      // Власні колонки бувають лише в «До виконання» і «У процесі»
      (!["TODO", "IN_PROGRESS"].includes(status) || (task.columnId ?? null) === columnId),
  );
}

// Прострочене — це незавершене завдання, дедлайн якого вже минув.
export function isOverdue(task: Task) {
  if (!task.deadline || task.status === "DONE") return false;
  return new Date(task.deadline) < new Date();
}

// Хто рухає картку відносно завдання
export interface MoveActor {
  isOwner: boolean; // замовник (власник проєкту)
  isAssignee: boolean; // призначений виконавець
  isMember: boolean; // фрілансер-учасник проєкту
}

export type MoveRule = { allowed: true; needs?: "comment" | "reason"; takes?: boolean } | { allowed: false; reason: string };

const deny = (reason: string): MoveRule => ({ allowed: false, reason });

// Ті самі правила, що на сервері (apps/api/src/tasks/task-workflow.ts → moveRule).
// Тут вони лише підказують, які колонки доступні; остаточно вирішує сервер.
export function moveRule(task: Pick<Task, "status" | "assigneeId">, to: TaskStatus, actor: MoveActor): MoveRule {
  const from = task.status;
  const unassigned = !task.assigneeId;
  const worker = actor.isAssignee || (actor.isOwner && unassigned);
  const working = (status: TaskStatus) => status === "TODO" || status === "IN_PROGRESS";
  if (working(from) && working(to)) {
    if (worker || actor.isOwner) return { allowed: true };
    if (from === "TODO" && to === "IN_PROGRESS" && unassigned && actor.isMember) return { allowed: true, takes: true };
    return deny("Пересувати картку може її виконавець або замовник.");
  }
  if (from === "IN_PROGRESS" && to === "REVIEW")
    return actor.isAssignee ? { allowed: true, needs: "comment" } : deny("На перевірку роботу передає призначений виконавець.");
  if (from === "IN_PROGRESS" && to === "DONE")
    return actor.isOwner && unassigned
      ? { allowed: true }
      : deny("Завершити завдання можна лише після перевірки: передайте його на перевірку.");
  if (from === "REVIEW" && to === "DONE") return actor.isOwner ? { allowed: true } : deny("Роботу приймає замовник.");
  if ((from === "REVIEW" || from === "DONE") && to === "REVISION")
    return actor.isOwner ? { allowed: true, needs: "reason" } : deny("На доопрацювання повертає замовник.");
  if (from === "REVISION" && to === "IN_PROGRESS")
    return worker ? { allowed: true } : deny("Продовжити роботу може призначений виконавець.");
  if (from === to) return deny("Картка вже в цьому етапі.");
  return deny("Такий перехід не передбачено процесом.");
}

// Правило для конкретної колонки: та сама колонка — не переміщення
export function laneRule(task: Task, target: Lane, actor: MoveActor): MoveRule {
  if (tasksInLane([task], target).length) return deny("Картка вже в цій колонці.");
  return moveRule(task, target.status, actor);
}

// Картка після переміщення (для миттєвого показу до відповіді сервера)
export function movedTask(task: Task, target: Lane, takerId?: string): Task {
  return {
    ...task,
    status: target.status,
    columnId: target.columnId,
    ...(takerId ? { assigneeId: takerId } : {}),
  };
}
