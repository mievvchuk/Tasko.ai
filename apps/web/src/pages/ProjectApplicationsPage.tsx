import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { Pagination, ResourceState } from "../components/ResourceState";
import { formatDate, parsePage } from "../format";
import { applicationStatusNames } from "../types";
import type { ProjectApplication } from "../types";
import { useApi } from "../useApi";

export function ProjectApplicationsPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const { data, error, loading, refresh } = useApi<ProjectApplication[]>(
    id ? `/projects/${id}/applications?page=${page}&limit=10` : null,
  );
  const [actionError, setActionError] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [ranking, setRanking] = useState(false);

  async function rank() {
    setRanking(true);
    setActionError("");
    try {
      await request(`/projects/${id}/applications/ai-rank`, {
        method: "POST",
        timeoutMs: 35000,
      });
      refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setRanking(false);
    }
  }

  async function accept(applicationId: string) {
    setAcceptingId(applicationId);
    setActionError("");
    try {
      await request(`/applications/${applicationId}/accept`, {
        method: "POST",
      });
      refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / ВІДГУКИ НА ПРОЄКТ</span>
        <h1>Заявки фрилансерів</h1>
        <p>
          Порівняйте пропозиції, досвід, рейтинг і середній строк виконання.
        </p>
      </div>
      <button
        className="button secondary"
        disabled={ranking || !data?.length}
        onClick={() => void rank()}
      >
        {ranking ? "AI аналізує…" : "Порівняти заявки через AI"}
      </button>
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section className="application-list">
          {[...(data || [])]
            .sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1))
            .map((application) => (
              <article className="application-card" key={application.id}>
                <div className="application-person">
                  <div>
                    <h2>{application.freelancer.name}</h2>
                    <span
                      className={`project-status status-${application.status}`}
                    >
                      {applicationStatusNames[application.status]}
                    </span>
                  </div>
                  <Link to={`/freelancers/${application.freelancerId}`}>
                    Переглянути профіль
                  </Link>
                </div>
                <p>{application.message}</p>
                {application.aiScore !== null && (
                  <p className="ai-ranking">
                    <strong>AI-оцінка: {application.aiScore}/100</strong>
                    <br />
                    {application.aiReason}
                  </p>
                )}
                <dl className="marketplace-facts application-stats">
                  <div>
                    <dt>Запропонований бюджет</dt>
                    <dd>
                      {application.proposedBudget.toLocaleString("uk-UA")} грн
                    </dd>
                  </div>
                  <div>
                    <dt>Строк</dt>
                    <dd>{application.proposedDays} днів</dd>
                  </div>
                  <div>
                    <dt>Рейтинг</dt>
                    <dd>
                      {application.freelancer.averageRating
                        ? `${application.freelancer.averageRating} / 5`
                        : "Ще немає"}
                    </dd>
                  </div>
                  <div>
                    <dt>Завершено проєктів</dt>
                    <dd>{application.freelancer.completedProjects}</dd>
                  </div>
                  <div>
                    <dt>Середній строк</dt>
                    <dd>
                      {application.freelancer.averageCompletionDays
                        ? `${application.freelancer.averageCompletionDays} днів`
                        : "Ще немає даних"}
                    </dd>
                  </div>
                  <div>
                    <dt>Заявка надіслана</dt>
                    <dd>{formatDate(application.createdAt, true)}</dd>
                  </div>
                </dl>
                {application.status === "PENDING" && (
                  <button
                    className="button primary"
                    disabled={acceptingId !== null}
                    onClick={() => void accept(application.id)}
                  >
                    {acceptingId === application.id
                      ? "Обираємо…"
                      : "Обрати виконавця"}
                  </button>
                )}
              </article>
            ))}
          {!data?.length && (
            <div className="empty-state data-panel">
              <h3>Заявок ще немає</h3>
              <p>
                Фрилансери побачать проєкт на біржі та зможуть відгукнутися.
              </p>
            </div>
          )}
        </section>
      )}
      {!loading && !error && (
        <Pagination
          page={page}
          count={data?.length || 0}
          size={10}
          onChange={(value) =>
            setParams(value === 1 ? {} : { page: String(value) })
          }
        />
      )}
    </>
  );
}
