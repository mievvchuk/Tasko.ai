import type { BoardColumn, Task, TaskStatus } from "./types";

// Колонка дошки: статус завдань у ній і, для власних колонок, id колонки.
// Власні колонки — це етапи всередині «У процесі», тож їхній статус IN_PROGRESS.
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

// Порядок: До виконання → У процесі → власні колонки → На перевірці → Завершено
export function boardLanes(columns: BoardColumn[]): Lane[] {
  return [
    lane("TODO"),
    lane("IN_PROGRESS"),
    ...columns.map((column) => ({
      key: column.id,
      status: "IN_PROGRESS" as const,
      columnId: column.id,
      title: column.title,
    })),
    lane("REVIEW"),
    lane("DONE"),
  ];
}

export function tasksInLane(tasks: Task[], { status, columnId }: Lane) {
  return tasks.filter(
    (task) =>
      task.status === status &&
      // Розрізняємо колонки лише всередині «У процесі»
      (status !== "IN_PROGRESS" || (task.columnId ?? null) === columnId),
  );
}

// Прострочене — це незавершене завдання, дедлайн якого вже минув.
export function isOverdue(task: Task) {
  if (!task.deadline || task.status === "DONE") return false;
  return new Date(task.deadline) < new Date();
}
