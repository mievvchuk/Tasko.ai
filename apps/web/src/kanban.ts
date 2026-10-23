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
