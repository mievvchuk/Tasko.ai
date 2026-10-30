import { errorMessage, request } from "../api";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import type { Notification } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
export function NotificationsPage() {
  const { tr } = useLanguage();
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
          <div className="simple-list">
            {data?.items.map((item) => (
              <article
                key={item.id}
                className={item.readAt ? "list-card" : "list-card unread"}
              >
                <div>
                  <strong>{item.message}</strong>
                  <small>{formatDate(item.createdAt, true)}</small>
                </div>
                {!item.readAt && (
                  <button
                    className="button secondary"
                    onClick={() => void mark(item.id)}
                  >
                    {tr("Позначити прочитаним")}
                  </button>
                )}
              </article>
            ))}
          </div>
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
