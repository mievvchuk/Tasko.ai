import { useEffect, useState } from "react";
import { Link } from "react-router";
import { errorMessage, notificationsChangedEvent, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import type { Notification } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";

// Тип події з API → підпис та іконка
const kinds: Record<string, [string, string]> = {
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
  AI_PLAN_APPLIED: ["AI-план додано", "bi-stars"],
  NEW_COMPLAINT: ["Нова скарга", "bi-flag-fill"],
};

export function NotificationsPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const { data, error, loading, refresh } = useApi<{
    items: Notification[];
    unreadCount: number;
  }>("/notifications?limit=50");
  // Нові сповіщення з'являються в списку одразу (подію шле Layout із потоку сервера)
  useEffect(() => {
    window.addEventListener(notificationsChangedEvent, refresh);
    return () => window.removeEventListener(notificationsChangedEvent, refresh);
  }, [refresh]);
  async function mark(id?: string) {
    try {
      await request(
        id ? `/notifications/${id}/read` : "/notifications/read-all",
        { method: id ? "PATCH" : "POST" },
      );
      refresh();
      window.dispatchEvent(new Event(notificationsChangedEvent));
    } catch (error) {
      alert(errorMessage(error));
    }
  }
  function toggle(item: Notification) {
    setOpenId(openId === item.id ? null : item.id);
    if (!item.readAt) void mark(item.id);
  }
  // Проєкти, про які є сповіщення, — для фільтра (у фрілансера й замовника їх може бути багато)
  const projects = [
    ...new Map(
      (data?.items ?? [])
        .filter((item) => item.projectId && item.projectTitle)
        .map((item) => [item.projectId!, item.projectTitle!]),
    ),
  ];
  const shown = (data?.items ?? []).filter(
    (item) =>
      (!unreadOnly || !item.readAt) &&
      (!projectFilter || item.projectId === projectFilter),
  );
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{tr("Сповіщення")}</h1>
          <p>{tr("Події ваших проєктів і завдань.")}</p>
        </div>
        <button className="button secondary" onClick={() => void mark()}>
          {tr("Прочитати всі")}
        </button>
      </div>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section className="data-panel">
          <div className="notification-filters">
            <div className="segmented" role="group" aria-label={tr("Показати")}>
              <button
                type="button"
                aria-pressed={!unreadOnly}
                onClick={() => setUnreadOnly(false)}
              >
                {tr("Усі")}
              </button>
              <button
                type="button"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly(true)}
              >
                {tr("Непрочитані")}
                {Boolean(data?.unreadCount) && (
                  <span className="count-badge">{data?.unreadCount}</span>
                )}
              </button>
            </div>
            {projects.length > 1 && (
              <label>
                <span className="visually-hidden">{tr("Проєкт")}</span>
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                >
                  <option value="">{tr("Усі проєкти")}</option>
                  {projects.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <ul className="notification-list">
            {shown.map((item) => {
              const [kind, icon] = kinds[item.type] ?? ["Подія", "bi-bell"];
              const open = openId === item.id;
              return (
                <li key={item.id} className={item.readAt ? "" : "unread"}>
                  <button
                    className="notification-row"
                    aria-expanded={open}
                    onClick={() => toggle(item)}
                  >
                    <span className="notification-icon" aria-hidden="true">
                      <i className={`bi ${icon}`}></i>
                    </span>
                    <span className="notification-text">
                      <strong>{item.message}</strong>
                      <small>
                        {tr(kind)}
                        {item.projectTitle && ` · ${item.projectTitle}`}
                        {" · "}
                        {formatDate(item.createdAt, true)}
                      </small>
                    </span>
                    <i
                      className={`bi bi-chevron-${open ? "up" : "down"}`}
                      aria-hidden="true"
                    ></i>
                  </button>
                  {open && (
                    <dl className="notification-details">
                      <div>
                        <dt>{tr("Подія")}</dt>
                        <dd>{tr(kind)}</dd>
                      </div>
                      {item.projectTitle && (
                        <div>
                          <dt>{tr("Проєкт")}</dt>
                          <dd>{item.projectTitle}</dd>
                        </div>
                      )}
                      {item.taskTitle && (
                        <div>
                          <dt>{tr("Завдання")}</dt>
                          <dd>{item.taskTitle}</dd>
                        </div>
                      )}
                      <div>
                        <dt>{tr("Отримано")}</dt>
                        <dd>{formatDate(item.createdAt, true)}</dd>
                      </div>
                      <div>
                        <dt>{tr("Стан")}</dt>
                        <dd>
                          {item.readAt
                            ? tr("Прочитано {0}", formatDate(item.readAt, true))
                            : tr("Прочитано щойно")}
                        </dd>
                      </div>
                      <div className="notification-links">
                        {item.taskId && (
                          <Link
                            className="button secondary"
                            to={`/tasks/${item.taskId}`}
                          >
                            <i
                              className="bi bi-check2-square"
                              aria-hidden="true"
                            ></i>
                            {tr("Відкрити завдання")}
                          </Link>
                        )}
                        {item.projectId && (
                          <Link
                            className="button secondary"
                            to={`/projects/${item.projectId}`}
                          >
                            <i className="bi bi-folder" aria-hidden="true"></i>
                            {tr("Відкрити проєкт")}
                          </Link>
                        )}
                        {item.type === "NEW_MESSAGE" && item.projectId && (
                          <Link
                            className="button secondary"
                            to={`/messages?project=${item.projectId}`}
                          >
                            <i className="bi bi-chat-dots" aria-hidden="true"></i>
                            {tr("Відкрити обговорення")}
                          </Link>
                        )}
                        {item.type === "APPLICATION_MESSAGE" && (
                          <Link className="button secondary" to="/messages">
                            <i className="bi bi-chat-dots" aria-hidden="true"></i>
                            {tr("Відкрити повідомлення")}
                          </Link>
                        )}
                        {item.type === "NEW_COMPLAINT" &&
                          user?.role === "ADMIN" && (
                            <Link
                              className="button secondary"
                              to="/admin/complaints"
                            >
                              <i className="bi bi-flag" aria-hidden="true"></i>
                              {tr("Відкрити скарги")}
                            </Link>
                          )}
                      </div>
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
          {!shown.length && (
            <div className="empty-state">
              <h3>
                {data?.items.length
                  ? tr("За цим фільтром сповіщень немає")
                  : tr("Сповіщень немає")}
              </h3>
            </div>
          )}
        </section>
      )}
    </>
  );
}
