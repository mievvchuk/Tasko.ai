import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { Pagination, ResourceState } from "../components/ResourceState";
import { formatDate, parsePage } from "../format";
import { applicationStatusNames } from "../types";
import type { Project, ProjectApplication } from "../types";
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
  const project = useApi<Project>(id ? `/projects/${id}` : null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const status = project.data?.status;
  // Як isHiring в API: до першого найму або поки клієнт не закрив набір
  const hiring =
    status === "PLANNING" ||
    (status === "ACTIVE" && Boolean(project.data?.hiringOpen));
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

  async function decide(applicationId: string, action: "accept" | "reject") {
    setAcceptingId(applicationId);
    setActionError("");
    setNotice("");
    try {
      await request(`/applications/${applicationId}/${action}`, {
        method: "POST",
      });
      setNotice(
        action === "accept"
          ? tr("Фрілансера прийнято до команди.")
          : tr("Заявку відхилено."),
      );
      refresh();
      project.refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setAcceptingId(null);
    }
  }

  async function closeHiring() {
    setClosing(true);
    setActionError("");
    setNotice("");
    try {
      await request(`/projects/${id}/close-hiring`, { method: "POST" });
      setNotice(tr("Набір закрито. Проєкт більше не показується на біржі."));
      refresh();
      project.refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Заявки фрілансерів")}</h1>
        <p>
          {tr(
            "Порівняйте пропозиції, досвід, рейтинг і середній строк виконання.",
          )}
        </p>
      </div>
      {project.data && (
        <p className="notice" role="status">
          {status === "PLANNING"
            ? tr(
                "Можна прийняти кількох фрілансерів — кожен стане учасником команди.",
              )
            : hiring
              ? tr(
                  "Набір у команду відкрито: проєкт видно на біржі, нові заявки надходять.",
                )
              : tr("Набір у команду закрито.")}
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      <div className="application-tools">
        {status === "ACTIVE" && hiring && (
          <button
            className="button secondary"
            disabled={closing}
            onClick={() => void closeHiring()}
          >
            <i className="bi bi-door-closed" aria-hidden="true"></i>
            {closing ? tr("Закриваємо…") : tr("Закрити набір")}
          </button>
        )}
        <button
          className="button secondary"
          disabled={ranking || !data?.length}
          onClick={() => void rank()}
        >
          <i className="bi bi-stars" aria-hidden="true"></i>
          {ranking ? tr("AI аналізує…") : tr("Порівняти заявки через AI")}
        </button>
      </div>
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
                  <span className="application-links">
                    <Link to={`/freelancers/${application.freelancerId}`}>
                      {tr("Переглянути профіль")}
                    </Link>
                    {/* Після найму розмова продовжується в чаті проєкту, а не заявки */}
                    <Link
                      to={
                        application.status === "ACCEPTED"
                          ? `/messages?project=${application.projectId}`
                          : `/messages?application=${application.id}`
                      }
                    >
                      <i className="bi bi-chat-dots" aria-hidden="true"></i>{" "}
                      {application.status === "PENDING"
                        ? tr("Написати фрілансеру")
                        : application.status === "ACCEPTED"
                          ? tr("Чат проєкту")
                          : tr("Переписка")}
                    </Link>
                  </span>
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
                {application.status === "PENDING" && hiring && (
                  <div className="page-actions">
                    <button
                      className="button primary"
                      disabled={acceptingId !== null}
                      onClick={() => void decide(application.id, "accept")}
                    >
                      <i className="bi bi-person-check" aria-hidden="true"></i>
                      {acceptingId === application.id
                        ? tr("Зберігаємо…")
                        : tr("Прийняти в команду")}
                    </button>
                    <button
                      className="button secondary"
                      disabled={acceptingId !== null}
                      onClick={() => void decide(application.id, "reject")}
                    >
                      <i className="bi bi-x-lg" aria-hidden="true"></i>
                      {tr("Відхилити")}
                    </button>
                  </div>
                )}
              </article>
            ))}
          {!data?.length && (
            <div className="empty-state data-panel">
              <h3>{tr("Заявок ще немає")}</h3>
              <p>
                {tr(
                  "Фрілансери побачать проєкт на біржі та зможуть відгукнутися.",
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
