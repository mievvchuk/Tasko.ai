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

// Порядок: власні «До виконання» (Беклог) → До виконання → У процесі →
// власні «У процесі» → На перевірці → Завершено
export function boardLanes(columns: BoardColumn[]): Lane[] {
  const custom = (status: BoardColumn["status"]) =>
    columns
      .filter((column) => (column.status ?? "IN_PROGRESS") === status)
      .map((column) => ({
        key: column.id,
        status,
        columnId: column.id,
        title: column.title,
      }));
  return [
    ...custom("TODO"),
    lane("TODO"),
    lane("IN_PROGRESS"),
    ...custom("IN_PROGRESS"),
    lane("REVIEW"),
    lane("DONE"),
  ];
}

export function tasksInLane(tasks: Task[], { status, columnId }: Lane) {
  return tasks.filter(
    (task) =>
      task.status === status &&
      // Власні колонки бувають лише в «До виконання» і «У процесі»
      (!["TODO", "IN_PROGRESS"].includes(status) ||
        (task.columnId ?? null) === columnId),
  );
}

// Прострочене — це незавершене завдання, дедлайн якого вже минув.
export function isOverdue(task: Task) {
  if (!task.deadline || task.status === "DONE") return false;
  return new Date(task.deadline) < new Date();
}
