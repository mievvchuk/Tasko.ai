import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { Pagination, ResourceState } from "../components/ResourceState";
import { formatDate, parsePage } from "../format";
import { applicationStatusNames } from "../types";
import type { ProjectApplication } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
import { uiLocale } from "../i18n.en";
export function ProjectApplicationsPage() {
  const { tr } = useLanguage();
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
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Заявки фрилансерів")}</h1>
        <p>
          {tr(
            "Порівняйте пропозиції, досвід, рейтинг і середній строк виконання.",
          )}
        </p>
      </div>
      <button
        className="button secondary"
        disabled={ranking || !data?.length}
        onClick={() => void rank()}
      >
        {ranking ? tr("AI аналізує…") : tr("Порівняти заявки через AI")}
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
                      {tr(applicationStatusNames[application.status])}
                    </span>
                  </div>
                  <Link to={`/freelancers/${application.freelancerId}`}>
                    {tr("Переглянути профіль")}
                  </Link>
                </div>
                <p>{application.message}</p>
                {application.aiScore !== null && (
                  <p className="ai-ranking">
                    <strong>
                      {tr("AI-оцінка:")} {application.aiScore}/100
                    </strong>
                    <br />
                    {application.aiReason}
                  </p>
                )}
                <dl className="marketplace-facts application-stats">
                  <div>
                    <dt>{tr("Запропонований бюджет")}</dt>
                    <dd>
                      {application.proposedBudget.toLocaleString(uiLocale())}{" "}
                      {tr("грн")}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr("Строк")}</dt>
                    <dd>
                      {application.proposedDays} {tr("днів")}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr("Рейтинг")}</dt>
                    <dd>
                      {application.freelancer.averageRating
                        ? `${application.freelancer.averageRating} / 5`
                        : tr("Ще немає")}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr("Завершено проєктів")}</dt>
                    <dd>{application.freelancer.completedProjects}</dd>
                  </div>
                  <div>
                    <dt>{tr("Середній строк")}</dt>
                    <dd>
                      {application.freelancer.averageCompletionDays
                        ? tr(
                            "{0} днів",
                            application.freelancer.averageCompletionDays,
                          )
                        : tr("Ще немає даних")}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr("Заявка надіслана")}</dt>
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
                      ? tr("Обираємо…")
                      : tr("Обрати виконавця")}
                  </button>
                )}
              </article>
            ))}
          {!data?.length && (
            <div className="empty-state data-panel">
              <h3>{tr("Заявок ще немає")}</h3>
              <p>
                {tr(
                  "Фрилансери побачать проєкт на біржі та зможуть відгукнутися.",
                )}
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
