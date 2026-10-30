import type { Task, TaskStatus } from "./types";

export const kanbanStatuses: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export function groupTasksByStatus(tasks: Task[]) {
  return Object.fromEntries(
    kanbanStatuses.map((status) => [
      status,
      tasks.filter((task) => task.status === status),
    ]),
  ) as Record<TaskStatus, Task[]>;
}

// Прострочене — це незавершене завдання, дедлайн якого вже минув.
export function isOverdue(task: Task) {
  if (!task.deadline || task.status === "DONE") return false;
  return new Date(task.deadline) < new Date();
}
