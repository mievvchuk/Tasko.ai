import { Link, useParams } from "react-router";
import { KpiGrid } from "../components/Metrics";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { formatDate } from "../format";
import { ratingStars } from "../types";
import { useApi } from "../useApi";
import { useLanguage } from "../i18n";

interface ClientProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  projectsTotal: number;
  completedProjects: number;
  activeProjects: number;
  hiredFreelancers: number;
  averageRating: number | null;
  reviewCount: number;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    freelancer: { id: string; name: string } | null;
    project: { id: string; title: string | null };
  }[];
  openProjects: {
    id: string;
    title: string;
    budgetMin: number | null;
    budgetMax: number | null;
    deadline: string | null;
  }[];
}

// Профіль клієнта очима фрілансера: чи варто з ним працювати
export function ClientProfilePage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<ClientProfile>(
    id ? `/clients/${id}/profile` : null,
  );
  return (
    <>
      <button className="link-button breadcrumb" onClick={() => history.back()}>
        {tr("← Назад")}
      </button>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {data && (
        <>
          <section className="data-panel freelancer-hero">
            <UserAvatar name={data.name} avatarUrl={data.avatarUrl} size="xl" />
            <div className="freelancer-hero-text">
              <h1>{data.name}</h1>
              <p className="freelancer-meta">
                <span className="availability availability-AVAILABLE">
                  <i aria-hidden="true"></i>
                  {tr("Клієнт")}
                </span>
                {data.averageRating !== null && (
                  <span>
                    <b className="stars">
                      {ratingStars(Math.round(data.averageRating))}
                    </b>{" "}
                    {data.averageRating} ·{" "}
                    {tr("{0} відгуків", data.reviewCount)}
                  </span>
                )}
                <span>
                  <i className="bi bi-calendar3" aria-hidden="true"></i>{" "}
                  {tr("На платформі з {0}", formatDate(data.createdAt))}
                </span>
              </p>
            </div>
          </section>

          <div className="client-kpis">
            <KpiGrid
              compact
              label={tr("Показники клієнта")}
              items={[
                {
                  label: tr("Опубліковано проєктів"),
                  value: data.projectsTotal,
                  icon: "bi-folder",
                  tone: "primary",
                  hint: tr("Проєкти, що пройшли модерацію."),
                },
                {
                  label: tr("Завершено проєктів"),
                  value: data.completedProjects,
                  icon: "bi-check2-circle",
                  tone: "success",
                  hint: tr("Роботу прийнято, проєкт закрито."),
                },
                {
                  label: tr("У роботі"),
                  value: data.activeProjects,
                  icon: "bi-lightning-charge",
                  tone: "accent",
                  hint: tr("Проєкти, над якими зараз працюють виконавці."),
                },
                {
                  label: tr("Найнято фрілансерів"),
                  value: data.hiredFreelancers,
                  icon: "bi-people",
                  tone: "muted",
                  hint: tr("Скільки різних виконавців клієнт обирав."),
                },
              ]}
            />
          </div>

          <section className="data-panel projects-panel client-open-projects">
            <div className="panel-heading">
              <h2>{tr("Відкриті проєкти")}</h2>
              <span className="badge">{data.openProjects.length}</span>
            </div>
            {data.openProjects.length ? (
              <ul className="record-list padded">
                {data.openProjects.map((project) => (
                  <li key={project.id} className="complaint-item-head">
                    <Link to={`/marketplace/${project.id}`}>
                      <strong>{project.title}</strong>
                    </Link>
                    <small>
                      {project.budgetMax
                        ? tr(
                            "{0}–{1} грн",
                            project.budgetMin ?? 0,
                            project.budgetMax,
                          )
                        : tr("Бюджет не вказано")}{" "}
                      · {formatDate(project.deadline)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <p>{tr("Зараз клієнт не шукає виконавців.")}</p>
              </div>
            )}
          </section>

          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>{tr("Відгуки фрілансерів")}</h2>
              <span className="badge">{data.reviewCount}</span>
            </div>
            {data.reviews.length ? (
              <ul className="review-list">
                {data.reviews.map((review) => (
                  <li key={review.id}>
                    <div>
                      <strong className="stars">
                        {ratingStars(review.rating)}
                      </strong>
                      <span>
                        {review.freelancer ? (
                          <Link to={`/freelancers/${review.freelancer.id}`}>
                            {review.freelancer.name}
                          </Link>
                        ) : (
                          tr("Фрілансер")
                        )}
                      </span>
                    </div>
                    <p>
                      {review.comment || tr("Фрілансер не додав коментар.")}
                    </p>
                    <small>
                      {review.project.title || tr("Завершений проєкт")} ·{" "}
                      {formatDate(review.createdAt)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <h3>{tr("Відгуків ще немає")}</h3>
                <p>
                  {tr(
                    "Фрілансери оцінюють клієнта після завершення спільного проєкту.",
                  )}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
