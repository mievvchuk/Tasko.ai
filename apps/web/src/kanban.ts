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
  return column.status === "IN_PROGRESS" && column.position < 2000
    ? 2000 + column.position
    : column.position;
}

// Колонки до «На перевірці» сортуються за місцем, «На перевірці» і «Завершено» — завжди в кінці
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
  return [...placed.map((item) => item.lane), lane("REVIEW"), lane("DONE")];
}

// Порядок для сервера: id власних колонок і 'TODO', 'IN_PROGRESS' — без «На перевірці» і «Завершено»
export function laneOrder(lanes: Lane[]) {
  return lanes
    .filter((item) => item.status === "TODO" || item.status === "IN_PROGRESS")
    .map((item) => item.columnId ?? item.status);
}

// Етап колонки за її місцем: усе до стандартної «У процесі» — «До виконання»
export function stageAt(
  order: string[],
  index: number,
): "TODO" | "IN_PROGRESS" {
  return index <= order.indexOf("IN_PROGRESS") ? "TODO" : "IN_PROGRESS";
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
