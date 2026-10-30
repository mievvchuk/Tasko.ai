import { useParams } from "react-router";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { formatDate } from "../format";
import type { FreelancerProfile } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
export function FreelancerProfilePage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<FreelancerProfile>(
    id ? `/freelancers/${id}/profile` : null,
  );
  return (
    <>
      <button className="link-button breadcrumb" onClick={() => history.back()}>
        {tr("← Назад")}
      </button>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && data && (
        <>
          <div className="page-heading">
            <div className="person-heading">
              <UserAvatar
                name={data.name}
                avatarUrl={data.avatarUrl}
                size="xl"
              />
              <h1>{data.name}</h1>
            </div>
            <p>{tr("Профіль виконавця та відгуки клієнтів.")}</p>
            <p>{data.profile.bio || tr("Фрилансер ще не додав опис.")}</p>
            <p className="skill-list">
              {data.skills.map((skill) => (
                <span className="badge" key={skill.id}>
                  {skill.name}
                </span>
              ))}
            </p>
          </div>
          <section className="profile-summary data-panel">
            <div>
              <strong>{data.averageRating ?? "—"}</strong>
              <span>{tr("Середній рейтинг із 5")}</span>
            </div>
            <div>
              <strong>{data.completedProjects}</strong>
              <span>{tr("Завершено проєктів")}</span>
            </div>
            <div>
              <strong>{data.averageCompletionDays ?? "—"}</strong>
              <span>{tr("Середній строк у днях")}</span>
            </div>
            <div>
              <strong>{data.reviewCount}</strong>
              <span>{tr("Відгуків")}</span>
            </div>
            <div>
              <strong>
                {data.profile.hourlyRate
                  ? tr("{0} грн", data.profile.hourlyRate)
                  : "—"}
              </strong>
              <span>{tr("Ставка за годину")}</span>
            </div>
            <div>
              <strong>{data.activeWorkload}</strong>
              <span>{tr("Активних завдань")}</span>
            </div>
            <div>
              <strong>
                {data.onTimePercentage !== null
                  ? `${data.onTimePercentage}%`
                  : "—"}
              </strong>
              <span>{tr("Виконано вчасно")}</span>
            </div>
          </section>
          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>{tr("Портфоліо")}</h2>
            </div>
            <div className="simple-list">
              {data.portfolio.map((item) => (
                <article className="list-card" key={item.id}>
                  <div>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                    </a>
                    <small>{item.description}</small>
                  </div>
                </article>
              ))}
            </div>
            {!data.portfolio.length && (
              <div className="empty-state">
                <p>{tr("Робіт у портфоліо ще немає.")}</p>
              </div>
            )}
          </section>
          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>{tr("Відгуки клієнтів")}</h2>
            </div>
            {data.reviews.length ? (
              <ul className="review-list">
                {data.reviews.map((review) => (
                  <li key={review.id}>
                    <div>
                      <strong>
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </strong>
                      <span>{review.client?.name || tr("Клієнт")}</span>
                    </div>
                    <p>{review.comment || tr("Клієнт не додав коментар.")}</p>
                    <small>
                      {review.project?.title || tr("Завершений проєкт")} ·{" "}
                      {formatDate(review.createdAt)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <h3>{tr("Відгуків ще немає")}</h3>
                <p>{tr("Перший відгук з’явиться після завершення проєкту.")}</p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
