import { useParams } from "react-router";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { formatDate } from "../format";
import type { FreelancerProfile } from "../types";
import { useApi } from "../useApi";

export function FreelancerProfilePage() {
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<FreelancerProfile>(
    id ? `/freelancers/${id}/profile` : null,
  );
  return (
    <>
      <button className="link-button breadcrumb" onClick={() => history.back()}>
        ← Назад
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
            <p>Профіль виконавця та відгуки клієнтів.</p>
            <p>{data.profile.bio || "Фрилансер ще не додав опис."}</p>
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
              <span>Середній рейтинг із 5</span>
            </div>
            <div>
              <strong>{data.completedProjects}</strong>
              <span>Завершено проєктів</span>
            </div>
            <div>
              <strong>{data.averageCompletionDays ?? "—"}</strong>
              <span>Середній строк у днях</span>
            </div>
            <div>
              <strong>{data.reviewCount}</strong>
              <span>Відгуків</span>
            </div>
            <div>
              <strong>
                {data.profile.hourlyRate
                  ? `${data.profile.hourlyRate} грн`
                  : "—"}
              </strong>
              <span>Ставка за годину</span>
            </div>
            <div>
              <strong>{data.activeWorkload}</strong>
              <span>Активних завдань</span>
            </div>
            <div>
              <strong>
                {data.onTimePercentage !== null
                  ? `${data.onTimePercentage}%`
                  : "—"}
              </strong>
              <span>Виконано вчасно</span>
            </div>
          </section>
          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>Портфоліо</h2>
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
                <p>Робіт у портфоліо ще немає.</p>
              </div>
            )}
          </section>
          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>Відгуки клієнтів</h2>
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
                      <span>{review.client?.name || "Клієнт"}</span>
                    </div>
                    <p>{review.comment || "Клієнт не додав коментар."}</p>
                    <small>
                      {review.project?.title || "Завершений проєкт"} ·{" "}
                      {formatDate(review.createdAt)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <h3>Відгуків ще немає</h3>
                <p>Перший відгук з’явиться після завершення проєкту.</p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
