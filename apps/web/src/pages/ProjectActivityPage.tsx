import { Link, useParams } from "react-router";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import type { ActivityLog } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
export function ProjectActivityPage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<ActivityLog[]>(
    id ? `/projects/${id}/activity?limit=50` : null,
  );
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Історія активності")}</h1>
      </div>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section className="data-panel simple-list">
          {data?.map((item) => (
            <article className="list-card" key={item.id}>
              <div>
                <strong>{item.message}</strong>
                <small>
                  {item.actor?.name || tr("Система")} ·{" "}
                  {formatDate(item.createdAt, true)}
                </small>
              </div>
            </article>
          ))}
          {!data?.length && (
            <div className="empty-state">
              <h3>{tr("Подій ще немає")}</h3>
            </div>
          )}
        </section>
      )}
    </>
  );
}
