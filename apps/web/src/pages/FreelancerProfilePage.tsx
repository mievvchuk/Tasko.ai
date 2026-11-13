import { useParams } from "react-router";
import { BarChart } from "../components/Charts";
import { KpiGrid } from "../components/Metrics";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { formatDate } from "../format";
import { ratingStars } from "../types";
import type { FreelancerProfile } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";

const availabilityNames = {
  AVAILABLE: "Доступний для нових проєктів",
  BUSY: "Зайнятий",
  UNAVAILABLE: "Недоступний",
} as const;

// Домен посилання портфоліо; некоректну адресу показуємо як є
function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Профіль виконавця, яким його бачить клієнт перед вибором: хто це, що вміє, як працює
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
          <section className="data-panel freelancer-hero">
            <UserAvatar name={data.name} avatarUrl={data.avatarUrl} size="xl" />
            <div className="freelancer-hero-text">
              <h1>{data.name}</h1>
              <p className="freelancer-meta">
                <span
                  className={`availability availability-${data.profile.availability}`}
                >
                  <i aria-hidden="true"></i>
                  {tr(availabilityNames[data.profile.availability])}
                </span>
                {data.averageRating !== null && (
                  <span title={tr("Середній рейтинг із 5")}>
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
              {data.skills.length > 0 && (
                <ul className="skill-chips">
                  {data.skills.map((skill) => (
                    <li className="badge" key={skill.id}>
                      {skill.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="freelancer-rate">
              <strong>
                {data.profile.hourlyRate
                  ? tr("{0} грн", data.profile.hourlyRate)
                  : "—"}
              </strong>
              <span>{tr("Ставка за годину")}</span>
            </div>
          </section>

          <div className="freelancer-columns">
            <section className="data-panel freelancer-about">
              <h2>{tr("Про себе")}</h2>
              <p>{data.profile.bio || tr("Фрілансер ще не додав опис.")}</p>
            </section>
            <KpiGrid
              compact
              label={tr("Показники роботи")}
              items={[
                {
                  label: tr("Завершено проєктів"),
                  value: data.completedProjects,
                  icon: "bi-check2-circle",
                  tone: "success",
                  hint: tr("Проєкти, які клієнти прийняли як завершені."),
                },
                {
                  label: tr("Виконано вчасно"),
                  value:
                    data.onTimePercentage !== null
                      ? `${data.onTimePercentage}%`
                      : "—",
                  icon: "bi-alarm",
                  tone: "primary",
                  hint: tr("Частка завдань, зданих до дедлайну."),
                },
                {
                  label: tr("Середній строк у днях"),
                  value: data.averageCompletionDays ?? "—",
                  icon: "bi-hourglass-split",
                  tone: "accent",
                  hint: tr("Скільки днів у середньому триває проєкт."),
                },
                {
                  label: tr("Активних завдань"),
                  value: data.activeWorkload,
                  icon: "bi-list-task",
                  tone: "muted",
                  hint: tr("Поточна завантаженість виконавця."),
                },
              ]}
            />
          </div>

          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>{tr("Портфоліо")}</h2>
              <span className="badge">{data.portfolio.length}</span>
            </div>
            {data.portfolio.length ? (
              <div className="portfolio-grid">
                {data.portfolio.map((item) => (
                  <a
                    className="portfolio-card"
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{item.title}</strong>
                    {item.description && <small>{item.description}</small>}
                    <span>
                      {hostOf(item.url)}
                      <i
                        className="bi bi-box-arrow-up-right"
                        aria-label={tr("відкриється в новій вкладці")}
                      ></i>
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>{tr("Робіт у портфоліо ще немає.")}</p>
              </div>
            )}
          </section>

          <section className="data-panel projects-panel">
            <div className="panel-heading">
              <h2>{tr("Відгуки клієнтів")}</h2>
              <span className="badge">{data.reviewCount}</span>
            </div>
            {data.reviews.length ? (
              <div className="freelancer-reviews">
                <BarChart
                  title={tr("Розподіл оцінок")}
                  items={[5, 4, 3, 2, 1].map((stars) => ({
                    label: "★".repeat(stars),
                    value: data.reviews.filter(
                      (review) => review.rating === stars,
                    ).length,
                    tone:
                      stars >= 4
                        ? "success"
                        : stars === 3
                          ? "accent"
                          : "danger",
                  }))}
                />
                <ul className="review-list">
                  {data.reviews.map((review) => (
                    <li key={review.id}>
                      <div>
                        <strong className="stars">
                          {ratingStars(review.rating)}
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
              </div>
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
