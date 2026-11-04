import { useState } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import type { Notification } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";

// Тип події з API → підпис та іконка
const kinds: Record<string, [string, string]> = {
  NEW_APPLICATION: ["Нова заявка", "bi-person-plus"],
  APPLICATION_ACCEPTED: ["Заявку прийнято", "bi-check2-circle"],
  NEW_MESSAGE: ["Нове повідомлення", "bi-chat-dots"],
  TASK_ASSIGNED: ["Призначено завдання", "bi-check2-square"],
  WORK_SUBMITTED: ["Роботу здано", "bi-upload"],
  WORK_REVIEWED: ["Роботу перевірено", "bi-clipboard-check"],
  MILESTONE_CREATED: ["Новий етап", "bi-flag"],
  MILESTONE_UPDATED: ["Етап оновлено", "bi-flag"],
  PROJECT_MEMBER: ["Учасник проєкту", "bi-people"],
  PROJECT_UPDATED: ["Проєкт оновлено", "bi-folder"],
  AI_PLAN_APPLIED: ["AI-план додано", "bi-stars"],
};

export function NotificationsPage() {
  const { tr } = useLanguage();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, error, loading, refresh } = useApi<{
    items: Notification[];
    unreadCount: number;
  }>("/notifications?limit=50");
  async function mark(id?: string) {
    try {
      await request(
        id ? `/notifications/${id}/read` : "/notifications/read-all",
        { method: id ? "PATCH" : "POST" },
      );
      refresh();
    } catch (error) {
      alert(errorMessage(error));
    }
  }
  function toggle(item: Notification) {
    setOpenId(openId === item.id ? null : item.id);
    if (!item.readAt) void mark(item.id);
  }
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
          <ul className="notification-list">
            {data?.items.map((item) => {
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
                        {tr(kind)} · {formatDate(item.createdAt, true)}
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
                      </div>
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
          {!data?.items.length && (
            <div className="empty-state">
              <h3>{tr("Сповіщень немає")}</h3>
            </div>
          )}
        </section>
      )}
    </>
  );
}
