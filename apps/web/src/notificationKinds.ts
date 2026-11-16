import type { Notification } from "./types";

export const notificationToastEvent = "tasko:notification-toast";

// Тип події з API → підпис та іконка (спільне для сторінки сповіщень і спливаючих повідомлень)
export const notificationKinds: Record<string, [string, string]> = {
  NEW_APPLICATION: ["Нова заявка", "bi-person-plus"],
  APPLICATION_ACCEPTED: ["Заявку прийнято", "bi-check2-circle"],
  APPLICATION_REJECTED: ["Заявку відхилено", "bi-x-circle"],
  NEW_MESSAGE: ["Нове повідомлення", "bi-chat-dots"],
  APPLICATION_MESSAGE: ["Повідомлення щодо заявки", "bi-chat-left-text"],
  TASK_ASSIGNED: ["Призначено завдання", "bi-check2-square"],
  WORK_SUBMITTED: ["Роботу здано", "bi-upload"],
  WORK_REVIEWED: ["Роботу перевірено", "bi-clipboard-check"],
  MILESTONE_CREATED: ["Новий етап", "bi-flag"],
  MILESTONE_UPDATED: ["Етап оновлено", "bi-flag"],
  PROJECT_MEMBER: ["Учасник проєкту", "bi-people"],
  PROJECT_UPDATED: ["Проєкт оновлено", "bi-folder"],
  PROJECT_COMPLETED: ["Проєкт завершено", "bi-trophy"],
  AI_PLAN_APPLIED: ["AI-план додано", "bi-stars"],
  NEW_COMPLAINT: ["Нова скарга", "bi-flag-fill"],
};

export const notificationKind = (type: string): [string, string] => notificationKinds[type] ?? ["Сповіщення", "bi-bell"];

// Куди веде сповіщення: найконкретніше місце події
export function notificationTarget(item: Notification, isAdmin: boolean) {
  if (item.type === "NEW_COMPLAINT" && isAdmin) return "/admin/complaints";
  if (item.type === "NEW_MESSAGE" && item.projectId) return `/messages?project=${item.projectId}`;
  if (item.type === "APPLICATION_MESSAGE") return "/messages";
  if (item.taskId) return `/tasks/${item.taskId}`;
  if (item.projectId) return `/projects/${item.projectId}`;
  return "/notifications";
}
