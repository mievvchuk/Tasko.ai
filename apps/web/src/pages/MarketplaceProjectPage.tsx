import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { formatDate } from "../format";
import { useApi } from "../useApi";
import { applicationStatusNames } from "../types";
import type { ApplicationStatus, MarketplaceProject } from "../types";
import { useLanguage } from "../i18n";
import { budgetText } from "./MarketplacePage";

interface Bid {
  id: string;
  freelancer: { id: string; name: string; avatarUrl: string | null } | null;
  proposedBudget: number;
  proposedDays: number;
  status: ApplicationStatus;
  createdAt: string;
  mine: boolean;
  message: string | null;
}

// Сторінка проєкту на біржі: опис, форма заявки й ставки інших фрілансерів
export function MarketplaceProjectPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<
    MarketplaceProject & { bids: Bid[] }
  >(id ? `/marketplace/projects/${id}` : null);
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === "CLIENT") return <Navigate to="/projects" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await request(`/projects/${id}/applications`, {
        method: "POST",
        body: {
          message,
          proposedBudget: Number(budget),
          proposedDays: Number(days),
        },
      });
      refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }
  async function toggleFavorite() {
    if (!data) return;
    try {
      await request(`/projects/${data.id}/favorite`, {
        method: data.isFavorite ? "DELETE" : "POST",
      });
      refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <>
      <Link className="breadcrumb" to="/marketplace">
        {tr("← До біржі")}
      </Link>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {data && (
        <div className="market-project">
          <div className="market-project-main">
            <section className="data-panel market-project-info">
              <div className="market-project-title">
                <h1>{data.title}</h1>
                <button
                  type="button"
                  className={
                    data.isFavorite
                      ? "favorite-button active"
                      : "favorite-button"
                  }
                  aria-pressed={data.isFavorite}
                  aria-label={
                    data.isFavorite
                      ? tr("Видалити з обраного")
                      : tr("Додати в обране")
                  }
                  onClick={() => void toggleFavorite()}
                >
                  <i
                    className={`bi ${data.isFavorite ? "bi-star-fill" : "bi-star"}`}
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
              <p className="preserve-lines">
                {data.description || tr("Клієнт не додав опис.")}
              </p>
              {!!data.skills.length && (
                <ul className="skill-chips">
                  {data.skills.map((skill) => (
                    <li className="badge" key={skill.id}>
                      {skill.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="data-panel market-apply">
              <h2>{tr("Ваша заявка")}</h2>
              {data.applicationStatus ? (
                <p className="application-notice">
                  {tr("Статус заявки:")}{" "}
                  {tr(applicationStatusNames[data.applicationStatus])}
                  {data.applicationId && (
                    <>
                      {" · "}
                      <Link to={`/messages?application=${data.applicationId}`}>
                        {data.applicationStatus === "PENDING"
                          ? tr("Написати клієнту")
                          : tr("Переписка з клієнтом")}
                      </Link>
                    </>
                  )}
                </p>
              ) : (
                <form
                  className="application-form"
                  onSubmit={(e) => void submit(e)}
                >
                  <label>
                    {tr("Супровідне повідомлення")}
                    <textarea
                      value={message}
                      minLength={10}
                      maxLength={2000}
                      required
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={tr(
                        "Коротко опишіть досвід і спосіб виконання",
                      )}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      {tr("Бюджет, грн")}
                      {/* Більше за максимум клієнта не можна: поле підсвітиться й підкаже ліміт */}
                      <input
                        type="number"
                        min="1"
                        max={data.budgetMax ?? 10000000}
                        required
                        value={budget}
                        onChange={(event) => setBudget(event.target.value)}
                      />
                      {data.budgetMax !== null && (
                        <small className="field-hint">
                          {tr("Не більше {0} грн", data.budgetMax)}
                        </small>
                      )}
                    </label>
                    <label>
                      {tr("Строк, днів")}
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={days}
                        onChange={(event) => setDays(event.target.value)}
                      />
                    </label>
                  </div>
                  {formError && <p className="form-error">{formError}</p>}
                  <button className="button primary" disabled={submitting}>
                    <i className="bi bi-send" aria-hidden="true"></i>
                    {submitting ? tr("Надсилаємо…") : tr("Надіслати заявку")}
                  </button>
                </form>
              )}
            </section>

            <section className="data-panel projects-panel">
              <div className="panel-heading">
                <h2>{tr("Заявки фрілансерів")}</h2>
                <span className="badge">{data.bids.length}</span>
              </div>
              {data.bids.length ? (
                <ul className="record-list padded bid-list">
                  {data.bids.map((bid) => (
                    <li key={bid.id} className={bid.mine ? "own" : undefined}>
                      <UserAvatar
                        name={bid.freelancer?.name || "?"}
                        avatarUrl={bid.freelancer?.avatarUrl}
                        size="small"
                      />
                      <div>
                        <strong>
                          {bid.freelancer ? (
                            <Link to={`/freelancers/${bid.freelancer.id}`}>
                              {bid.freelancer.name}
                            </Link>
                          ) : (
                            tr("Фрілансер")
                          )}
                          {bid.mine && (
                            <span className="badge">{tr("Ваша")}</span>
                          )}
                        </strong>
                        <small>
                          {formatDate(bid.createdAt, true)} ·{" "}
                          {tr(applicationStatusNames[bid.status])}
                        </small>
                        {bid.message && (
                          <p className="preserve-lines">{bid.message}</p>
                        )}
                      </div>
                      <span className="bid-offer">
                        <strong>{tr("{0} грн", bid.proposedBudget)}</strong>
                        <small>{tr("{0} дн.", bid.proposedDays)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <p>{tr("Заявок ще немає — ваша може бути першою.")}</p>
                </div>
              )}
            </section>
          </div>

          <aside className="data-panel market-project-aside">
            <dl>
              <dt>{tr("Бюджет")}</dt>
              <dd>{budgetText(data, tr)}</dd>
              <dt>{tr("Дедлайн")}</dt>
              <dd>{formatDate(data.deadline)}</dd>
              <dt>{tr("Категорія")}</dt>
              <dd>{data.category?.name || tr("Без категорії")}</dd>
              <dt>{tr("Клієнт")}</dt>
              <dd>{data.client?.name || tr("Клієнт")}</dd>
              <dt>{tr("Опубліковано")}</dt>
              <dd>{formatDate(data.createdAt)}</dd>
              <dt>{tr("Заявок")}</dt>
              <dd>{data.bids.length}</dd>
            </dl>
          </aside>
        </div>
      )}
    </>
  );
}
